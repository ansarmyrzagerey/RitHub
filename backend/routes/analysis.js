const express = require('express');
const router = express.Router();
const { auth, requireResearcher } = require('../middleware/auth');
const analysisService = require('../services/analysisService');
const Artifact = require('../models/artifact');

// POST /api/analysis/start - Start analysis for an artifact
router.post('/start', auth, requireResearcher, async (req, res) => {
  try {
    const { artifactId } = req.body;
    
    if (!artifactId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Artifact ID is required' 
      });
    }

    // Check if artifact exists and user has access
    const artifact = await Artifact.findById(artifactId);
    if (!artifact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Artifact not found' 
      });
    }

    // Check ownership (only owner or admin can request analysis)
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Queue the analysis
    const result = await analysisService.queueAnalysis(artifactId, req.user.id);
    
    res.json({
      success: true,
      message: 'Analysis queued successfully',
      jobId: result.jobId,
      status: result.status
    });

  } catch (error) {
    console.error('Error starting analysis:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start analysis' 
    });
  }
});

// GET /api/analysis/status/:jobId - Get analysis job status
router.get('/status/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await analysisService.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }

    // Check if user has access to this job
    if (job.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    res.json({
      success: true,
      job: {
        jobId: job.job_id,
        artifactId: job.artifact_id,
        status: job.status,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        resultData: job.result_data,
        errorMessage: job.error_message
      }
    });

  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get job status' 
    });
  }
});

// POST /api/analysis/retry/:jobId - Retry failed analysis
router.post('/retry/:jobId', auth, requireResearcher, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await analysisService.getJobStatus(jobId);
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }

    // Check if user has access to this job
    if (job.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const result = await analysisService.retryAnalysis(jobId);
    
    res.json({
      success: true,
      message: 'Analysis retry queued successfully',
      jobId: result.jobId,
      status: result.status
    });

  } catch (error) {
    console.error('Error retrying analysis:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to retry analysis' 
    });
  }
});

// GET /api/analysis/artifact/:artifactId - Get all analysis results for an artifact
router.get('/artifact/:artifactId', auth, async (req, res) => {
  try {
    const { artifactId } = req.params;
    
    // Check if artifact exists and user has access
    const artifact = await Artifact.findById(artifactId);
    if (!artifact) {
      return res.status(404).json({ 
        success: false, 
        message: 'Artifact not found' 
      });
    }

    // Check access (owner, admin, or reviewer)
    if (artifact.uploaded_by !== req.user.id && !['admin', 'reviewer'].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get metrics for the artifact
    const metrics = await Artifact.getMetrics(artifactId);
    
    res.json({
      success: true,
      artifactId: parseInt(artifactId),
      metrics: metrics
    });

  } catch (error) {
    console.error('Error getting artifact metrics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get artifact metrics' 
    });
  }
});

module.exports = router;