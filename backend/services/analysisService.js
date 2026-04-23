const OpenAIClientFactory = require('./openai/client-factory');
const config = require('../config/openai.config');
const pool = require('../config/database');

class AnalysisService {
  constructor() {
    // Use the same client factory as quiz generation for consistency
    this.client = OpenAIClientFactory.createClient();
    this.analysisQueue = new Map(); // Simple in-memory queue for now
    console.log(`[AnalysisService] Initialized with model: ${config.defaultModel}`);
  }

  async queueAnalysis(artifactId, userId) {
    const jobId = `analysis_${artifactId}_${Date.now()}`;

    // Store job in database
    const result = await pool.query(
      `INSERT INTO analysis_jobs (job_id, artifact_id, user_id, status, created_at) 
       VALUES ($1, $2, $3, 'queued', NOW()) RETURNING *`,
      [jobId, artifactId, userId]
    );

    // Add to processing queue
    this.analysisQueue.set(jobId, {
      artifactId,
      userId,
      status: 'queued',
      createdAt: new Date()
    });

    // Process immediately (in production, you'd use a proper job queue)
    setImmediate(() => this.processAnalysis(jobId));

    return { jobId, status: 'queued' };
  }

  async processAnalysis(jobId) {
    try {
      // Update status to processing
      await this.updateJobStatus(jobId, 'processing');

      const job = this.analysisQueue.get(jobId);
      if (!job) {
        throw new Error('Job not found in queue');
      }

      // Get artifact data
      const artifactResult = await pool.query(
        'SELECT * FROM artifacts WHERE id = $1',
        [job.artifactId]
      );

      if (artifactResult.rows.length === 0) {
        throw new Error('Artifact not found');
      }

      const artifact = artifactResult.rows[0];

      // Perform analysis based on artifact type
      const metrics = await this.analyzeArtifact(artifact);

      // Store metrics in database
      for (const metric of metrics) {
        await pool.query(
          `INSERT INTO artifact_metrics (artifact_id, metric_type, metric_value, metric_data, calculated_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [job.artifactId, metric.type, metric.value, JSON.stringify(metric.data)]
        );
      }

      // Update job status to completed
      await this.updateJobStatus(jobId, 'completed', { metrics });

      // Remove from queue
      this.analysisQueue.delete(jobId);

    } catch (error) {
      console.error('Analysis failed:', error);
      await this.updateJobStatus(jobId, 'failed', { error: error.message });
      this.analysisQueue.delete(jobId);
    }
  }

  async analyzeArtifact(artifact) {
    const metrics = [];

    try {
      if (artifact.type === 'source_code' && artifact.content) {
        // Analyze source code
        const codeMetrics = await this.analyzeSourceCode(artifact.content, artifact.name);
        metrics.push(...codeMetrics);
      } else if (artifact.type === 'requirements' && artifact.content) {
        // Analyze requirements document
        const reqMetrics = await this.analyzeRequirements(artifact.content);
        metrics.push(...reqMetrics);
      } else if (artifact.type === 'uml_diagram') {
        // Basic file analysis for UML diagrams
        const basicMetrics = await this.analyzeBasicFile(artifact);
        metrics.push(...basicMetrics);
      }

      // Add basic file metrics for all types
      const basicMetrics = this.calculateBasicMetrics(artifact);
      metrics.push(...basicMetrics);

    } catch (error) {
      console.error('Error in artifact analysis:', error);
      // Return basic metrics even if AI analysis fails
      const basicMetrics = this.calculateBasicMetrics(artifact);
      metrics.push(...basicMetrics);
    }

    return metrics;
  }

  async analyzeSourceCode(content, filename) {
    const metrics = [];

    try {
      // Basic code metrics (without AI)
      const lines = content.split('\n');
      const nonEmptyLines = lines.filter(line => line.trim().length > 0);
      const commentLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#');
      });

      metrics.push({
        type: 'lines_of_code',
        value: lines.length,
        data: { total: lines.length, nonEmpty: nonEmptyLines.length, comments: commentLines.length }
      });

      // AI-powered analysis using unified client
      if (this.client) {
        const prompt = `Analyze this ${this.getLanguageFromFilename(filename)} code and provide metrics:

${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

Please provide:
1. Cyclomatic complexity estimate (1-10 scale)
2. Code quality score (1-10 scale)
3. Maintainability score (1-10 scale)
4. Key issues or suggestions

Respond in JSON format:
{
  "complexity": number,
  "quality": number,
  "maintainability": number,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

        try {
          const response = await this.client.generateCompletion({
            prompt,
            model: config.defaultModel,
            maxTokens: 500,
            temperature: 0.1
          });

          const analysis = JSON.parse(response.content);

          metrics.push({
            type: 'ai_complexity',
            value: analysis.complexity,
            data: { source: 'openai', model: response.model }
          });

          metrics.push({
            type: 'ai_quality_score',
            value: analysis.quality,
            data: {
              source: 'openai',
              model: response.model,
              maintainability: analysis.maintainability,
              issues: analysis.issues,
              suggestions: analysis.suggestions
            }
          });

        } catch (parseError) {
          console.error('Error parsing AI response:', parseError);
        }
      }

    } catch (error) {
      console.error('Error analyzing source code:', error);
    }

    return metrics;
  }

  async analyzeRequirements(content) {
    const metrics = [];

    try {
      const lines = content.split('\n');
      const words = content.split(/\s+/).filter(word => word.length > 0);

      metrics.push({
        type: 'document_length',
        value: words.length,
        data: { words: words.length, lines: lines.length, characters: content.length }
      });

      // AI analysis for requirements using unified client
      if (this.client) {
        const prompt = `Analyze this requirements document and provide metrics:

${content.substring(0, 1500)}${content.length > 1500 ? '...' : ''}

Please evaluate:
1. Clarity score (1-10)
2. Completeness score (1-10)
3. Number of functional requirements (estimate)
4. Number of non-functional requirements (estimate)

Respond in JSON format:
{
  "clarity": number,
  "completeness": number,
  "functional_requirements": number,
  "non_functional_requirements": number,
  "issues": ["issue1", "issue2"]
}`;

        try {
          const response = await this.client.generateCompletion({
            prompt,
            model: config.defaultModel,
            maxTokens: 400,
            temperature: 0.1
          });

          const analysis = JSON.parse(response.content);

          metrics.push({
            type: 'requirements_clarity',
            value: analysis.clarity,
            data: {
              source: 'openai',
              model: response.model,
              completeness: analysis.completeness,
              functional_count: analysis.functional_requirements,
              non_functional_count: analysis.non_functional_requirements,
              issues: analysis.issues
            }
          });

        } catch (parseError) {
          console.error('Error parsing requirements AI response:', parseError);
        }
      }

    } catch (error) {
      console.error('Error analyzing requirements:', error);
    }

    return metrics;
  }

  calculateBasicMetrics(artifact) {
    const metrics = [];

    // File size metric
    const fileSize = artifact.file_size || (artifact.metadata?.size) || 0;
    metrics.push({
      type: 'file_size',
      value: fileSize,
      data: { bytes: fileSize, kb: Math.round(fileSize / 1024 * 100) / 100 }
    });

    // Creation date metric (age in days)
    const createdAt = new Date(artifact.created_at);
    const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    metrics.push({
      type: 'artifact_age',
      value: ageInDays,
      data: { days: ageInDays, created_at: artifact.created_at }
    });

    return metrics;
  }

  getLanguageFromFilename(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap = {
      'java': 'Java',
      'py': 'Python',
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'rb': 'Ruby',
      'php': 'PHP',
      'go': 'Go'
    };
    return languageMap[ext] || 'code';
  }

  async updateJobStatus(jobId, status, data = {}) {
    await pool.query(
      `UPDATE analysis_jobs 
       SET status = $1, result_data = $2, updated_at = NOW() 
       WHERE job_id = $3`,
      [status, JSON.stringify(data), jobId]
    );

    // Update in-memory queue if exists
    if (this.analysisQueue.has(jobId)) {
      const job = this.analysisQueue.get(jobId);
      job.status = status;
      job.data = data;
    }
  }

  async getJobStatus(jobId) {
    const result = await pool.query(
      'SELECT * FROM analysis_jobs WHERE job_id = $1',
      [jobId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async retryAnalysis(jobId) {
    const job = await this.getJobStatus(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.status === 'processing') {
      throw new Error('Job is already processing');
    }

    // Reset status and retry
    await this.updateJobStatus(jobId, 'queued');
    this.analysisQueue.set(jobId, {
      artifactId: job.artifact_id,
      userId: job.user_id,
      status: 'queued',
      createdAt: new Date()
    });

    setImmediate(() => this.processAnalysis(jobId));
    return { jobId, status: 'queued' };
  }
}

module.exports = new AnalysisService();