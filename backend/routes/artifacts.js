const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Artifact = require('../models/artifact');
const Tag = require('../models/tag');
const Study = require('../models/study');
const Collection = require('../models/collection');
const { auth, requireResearcher } = require('../middleware/auth');
const { upload, bulkImportUpload } = require('../config/upload');
const pool = require('../config/database');
const retentionService = require('../services/retentionService');
const importJobManager = require('../services/importJobManager');

// GET /api/artifacts - Get all artifacts with filtering
router.get('/', auth, async (req, res) => {
  try {
    const { tags, studyId, type, search, dateRange, researcherId, includeDeleted, includeCollections } = req.query;

    // Check if we have any filters that require the new system
    const hasAdvancedFilters = tags || studyId || search || dateRange || researcherId;
    let artifacts;

    if (hasAdvancedFilters) {
      // Use advanced filtering
      try {
        const filters = {};
        if (tags) {
          filters.tags = Array.isArray(tags) ? tags : tags.split(',');
        }
        if (studyId) filters.studyId = parseInt(studyId);
        if (type) filters.type = type;
        if (search) filters.search = search;
        if (dateRange) filters.dateRange = dateRange;
        if (researcherId) filters.researcherId = parseInt(researcherId);
        filters.includeDeleted = includeDeleted === 'true';

        artifacts = await Artifact.findWithFilters(filters, req.user.id, req.user.role);
      } catch (filterError) {
        console.warn('Advanced filtering failed, falling back:', filterError.message);
        artifacts = await Artifact.findByUserId(req.user.id, includeDeleted === 'true');
      }
    } else {
      // Use simple query for basic requests
      if (type) {
        // Filter by type using simple query
        const allArtifacts = await Artifact.findByUserId(req.user.id, includeDeleted === 'true');
        artifacts = allArtifacts.filter(artifact => artifact.type === type);
      } else {
        artifacts = await Artifact.findByUserId(req.user.id, includeDeleted === 'true');
      }
    }

    // Filter out artifacts that belong to collections (unless explicitly requested)
    if (includeCollections !== 'true') {
      artifacts = artifacts.filter(artifact => !artifact.collection_id);
    }

    // Add tags and studies info to each artifact
    for (const artifact of artifacts) {
      try {
        artifact.tags = await Tag.getArtifactTags(artifact.id);
      } catch (tagError) {
        // Fallback to legacy tags from metadata
        artifact.tags = artifact.metadata?.tags || [];
      }

      try {
        artifact.studies = await Artifact.getStudiesForArtifact(artifact.id);
      } catch (studyError) {
        artifact.studies = [];
      }
    }

    res.json({ success: true, artifacts });
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artifacts' });
  }
});

// GET /api/artifacts/:id - Get specific artifact
router.get('/:id', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check if user owns the artifact or is admin
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, artifact });
  } catch (error) {
    console.error('Error fetching artifact:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artifact' });
  }
});

// POST /api/artifacts/generate - Generate artifact with AI
router.post('/generate', auth, requireResearcher, async (req, res) => {
  const { artifactGenerationLimiter } = require('../middleware/rateLimiter');

  // Apply rate limiting
  artifactGenerationLimiter(req, res, async (err) => {
    if (err) return; // Rate limiter already sent response

    try {
      const { prompt, type, name, language = 'java' } = req.body;

      // Validate required fields
      if (!prompt || !type) {
        return res.status(400).json({
          success: false,
          message: 'Prompt and artifact type are required'
        });
      }

      // Validate artifact type
      const validTypes = ['source_code', 'test_case', 'requirements', 'documentation', 'uml_diagram', 'bug_report', 'code_clone'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid artifact type. Must be one of: ${validTypes.join(', ')}`
        });
      }

      // Generate artifact using AI
      const artifactGenerationService = require('../services/artifactGenerationService');

      const generationResult = await artifactGenerationService.generateArtifact({
        prompt,
        type,
        name: name || 'Generated Artifact',
        language
      });

      if (!generationResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate artifact. Please try again.'
        });
      }

      // Create artifact from generated content
      const metadata = {
        ...generationResult.metadata,
        description: `AI-generated ${type}`,
        tags: ['ai-generated'],
        originalName: generationResult.fileName,
        size: Buffer.byteLength(generationResult.content, 'utf8')
      };

      // Save as file buffer (database storage)
      const fileBuffer = Buffer.from(generationResult.content, 'utf8');

      const artifact = await Artifact.createFromBuffer({
        name: generationResult.fileName,
        type: type,
        fileBuffer: fileBuffer,
        fileName: generationResult.fileName,
        mimeType: 'text/plain',
        content: generationResult.content,
        metadata: metadata,
        uploaded_by: req.user.id
      });

      // Auto-assign 'ai-generated' tag to the artifact
      // Add to both metadata.tags AND artifact_tags table for consistency
      try {
        const Tag = require('../models/tag');
        const aiTag = await Tag.findByName('ai-generated');
        if (aiTag && aiTag.status === 'approved') {
          // Add to artifact_tags table (for filtering)
          await Tag.setArtifactTags(artifact.id, [aiTag.id]);

          // Also update metadata to include the tag (for display)
          const updatedMetadata = {
            ...metadata,
            tags: Array.isArray(metadata.tags) ? [...metadata.tags] : ['ai-generated']
          };
          await pool.query(
            'UPDATE artifacts SET metadata = $1 WHERE id = $2',
            [JSON.stringify(updatedMetadata), artifact.id]
          );
        }
      } catch (tagError) {
        // Don't fail the request if tagging fails, but log detailed error
        console.error('Failed to auto-assign ai-generated tag:', tagError);
        console.error('Error details:', {
          message: tagError.message,
          stack: tagError.stack,
          artifactId: artifact.id
        });
      }

      res.status(201).json({
        success: true,
        message: 'Artifact generated successfully',
        artifact: {
          id: artifact.id,
          name: artifact.name,
          type: artifact.type,
          content: generationResult.content,
          imageUrl: generationResult.imageUrl, // Pass through the image URL for UML diagrams
          file_size: artifact.file_size,
          metadata: artifact.metadata,
          created_at: artifact.created_at
        }
      });

    } catch (error) {
      console.error('Error generating artifact:', error);

      // User-friendly error message (don't expose API cost details)
      const userMessage = error.message.includes('API')
        ? 'Unable to generate artifact at this time. Please try again later.'
        : 'Failed to generate artifact. Please try again.';

      res.status(500).json({
        success: false,
        message: userMessage
      });
    }
  });
});

// POST /api/artifacts/upload - Upload new artifact

router.post('/upload', auth, requireResearcher, upload.single('file'), async (req, res) => {
  try {
    const { title, type, tags, description, storageMethod = 'database' } = req.body;

    // Validate required fields
    if (!title || !type) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Title and type are required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Policy validation (US 2.7)
    const policyService = require('../services/policyService');
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    const violations = await policyService.validateFileUpload(
      req.user.id,
      req.file.originalname,
      req.file.size,
      fileExtension
    );

    if (violations.length > 0) {
      // Clean up uploaded file
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }

      // Log policy violations
      for (const violation of violations) {
        await policyService.logPolicyViolation(
          req.user.id,
          violation.type,
          `Upload attempt: ${req.file.originalname}`,
          req.file.originalname,
          req.file.size,
          fileExtension,
          violation.message
        );
      }

      return res.status(400).json({
        success: false,
        message: violations[0].message, // Return first violation message
        violations: violations
      });
    }

    // Parse tags if provided
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    // Prepare metadata
    const metadata = {
      tags: parsedTags,
      description: description || '',
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    };

    // Read file content for text files - expanded to cover all programming languages
    let content = null;
    const textTypes = [
      // Programming Languages
      '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.c', '.cpp', '.cc', '.h', '.hpp',
      '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala', '.r',
      '.m', '.mm', '.pl', '.sh', '.bash', '.ps1', '.lua', '.dart', '.groovy', '.sql',
      // Web Technologies
      '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
      // Data & Config
      '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.csv',
      // Documentation
      '.md', '.txt', '.rtf', '.tex',
      // Diagrams
      '.uml',
      // Code-related
      '.diff', '.patch', '.log'
    ];
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (textTypes.includes(ext)) {
      try {
        content = fs.readFileSync(req.file.path, 'utf8');
      } catch (error) {
        console.error('Error reading file content:', error);
      }
    }

    let artifact;

    if (storageMethod === 'database') {
      // Store in database as BYTEA
      const fileBuffer = fs.readFileSync(req.file.path);

      artifact = await Artifact.createFromBuffer({
        name: title,
        type: type,
        fileBuffer: fileBuffer,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        content: content,
        metadata: metadata,
        uploaded_by: req.user.id
      });

      // Clean up temporary file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });

    } else {
      // Store in filesystem (legacy method)
      artifact = await Artifact.create({
        name: title,
        type: type,
        file_path: req.file.path,
        file_data: null,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        content: content,
        metadata: metadata,
        uploaded_by: req.user.id
      });
    }

    // Update storage usage tracking (US 2.7)
    try {
      await policyService.updateStorageUsage(req.user.id, artifact.file_size, artifact.id, 'upload');
    } catch (usageError) {
      console.error('Error updating storage usage:', usageError);
      // Don't fail the upload for usage tracking errors
    }

    res.status(201).json({
      success: true,
      message: 'Artifact uploaded successfully',
      artifact: {
        id: artifact.id,
        name: artifact.name,
        type: artifact.type,
        storage_type: artifact.storage_type,
        file_size: artifact.file_size,
        mime_type: artifact.mime_type,
        metadata: artifact.metadata,
        created_at: artifact.created_at
      }
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    console.error('Error uploading artifact:', error);

    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 50MB limit'
      });
    }

    if (error.message.includes('File type')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload artifact'
    });
  }
});

// PUT /api/artifacts/:id - Update artifact metadata
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, type, tags, description } = req.body;

    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Parse tags if provided
    let parsedTags = artifact.metadata?.tags || [];
    if (tags !== undefined) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    // Update metadata
    const updatedMetadata = {
      ...artifact.metadata,
      tags: parsedTags,
      description: description !== undefined ? description : artifact.metadata?.description || ''
    };

    const updateData = {};
    if (title !== undefined) updateData.name = title;
    if (type !== undefined) updateData.type = type;
    updateData.metadata = updatedMetadata;

    const updatedArtifact = await Artifact.update(req.params.id, updateData, req.user.id);

    res.json({
      success: true,
      message: 'Artifact updated successfully',
      artifact: updatedArtifact
    });

  } catch (error) {
    console.error('Error updating artifact:', error);
    res.status(500).json({ success: false, message: 'Failed to update artifact' });
  }
});

// GET /api/artifacts/:id/versions - Get version history
router.get('/:id/versions', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check access (owner, admin, or reviewer)
    if (artifact.uploaded_by !== req.user.id && !['admin', 'reviewer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const versions = await Artifact.getVersionHistory(req.params.id);

    res.json({
      success: true,
      versions: versions
    });

  } catch (error) {
    console.error('Error fetching version history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch version history' });
  }
});

// POST /api/artifacts/:id/revert/:version - Revert to specific version
router.post('/:id/revert/:version', auth, async (req, res) => {
  try {
    const { id, version } = req.params;

    const artifact = await Artifact.findById(id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership (only owner or admin can revert)
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const revertedArtifact = await Artifact.revertToVersion(id, parseInt(version), req.user.id);

    res.json({
      success: true,
      message: `Reverted to version ${version}`,
      artifact: revertedArtifact
    });

  } catch (error) {
    console.error('Error reverting artifact:', error);
    res.status(500).json({ success: false, message: 'Failed to revert artifact' });
  }
});

// GET /api/artifacts/:id/download - Download artifact file
router.get('/:id/download', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findByIdWithoutFileData(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check access permissions
    // Allow participants if they're enrolled in a study with this artifact
    const isOwner = artifact.uploaded_by === req.user.id;
    const isAdminOrReviewer = ['admin', 'reviewer'].includes(req.user.role);

    // For participants, check if artifact is in their assigned tasks
    let hasParticipantAccess = false;
    if (req.user.role === 'participant' && !isOwner && !isAdminOrReviewer) {
      const accessCheck = await pool.query(
        `SELECT 1 
         FROM evaluation_tasks et
         JOIN study_participants sp ON sp.study_id = et.study_id AND sp.participant_id = $1
         WHERE (et.artifact1_id = $2 OR et.artifact2_id = $2 OR et.artifact3_id = $2)
         LIMIT 1`,
        [req.user.id, req.params.id]
      );
      hasParticipantAccess = accessCheck.rowCount > 0;
    }

    if (!isOwner && !isAdminOrReviewer && !hasParticipantAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if this file should be viewable in browser (images or PDFs)
    const isViewableInBrowser = req.query.display === 'true' ||
      (artifact.mime_type && (artifact.mime_type.startsWith('image/') || artifact.mime_type === 'application/pdf')) ||
      (artifact.type && (artifact.type.includes('image') || artifact.type === 'ui_snapshot'));

    if (artifact.storage_type === 'database') {
      // Get file data from database
      const fileData = await Artifact.getFileData(req.params.id);
      if (!fileData || !fileData.file_data) {
        return res.status(404).json({ success: false, message: 'File data not found' });
      }

      // Set appropriate headers
      const metadata = typeof artifact.metadata === 'string' ?
        JSON.parse(artifact.metadata) : artifact.metadata;
      const mimeType = fileData.mime_type || artifact.mime_type || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileData.file_size);

      // For viewable files (images, PDFs), allow browser to display inline
      if (isViewableInBrowser) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const filename = metadata?.originalName || `${artifact.name}.bin`;
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      } else {
        const filename = metadata?.originalName || `${artifact.name}.bin`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      // Send the binary data
      res.send(fileData.file_data);

    } else if (artifact.storage_type === 'filesystem') {
      // Serve from filesystem (legacy)
      if (!artifact.file_path || !fs.existsSync(artifact.file_path)) {
        return res.status(404).json({ success: false, message: 'File not found on filesystem' });
      }

      const metadata = typeof artifact.metadata === 'string' ?
        JSON.parse(artifact.metadata) : artifact.metadata;
      const mimeType = artifact.mime_type || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);

      // For viewable files (images, PDFs), allow browser to display inline
      if (isViewableInBrowser) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const filename = metadata?.originalName || path.basename(artifact.file_path);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      } else {
        const filename = metadata?.originalName || path.basename(artifact.file_path);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      res.sendFile(path.resolve(artifact.file_path));

    } else {
      return res.status(404).json({ success: false, message: 'No file data available' });
    }

  } catch (error) {
    console.error('Error downloading artifact:', error);
    res.status(500).json({ success: false, message: 'Failed to download artifact' });
  }
});

// GET /api/artifacts/:id/details - Get artifact with full details (for reviewers)
router.get('/:id/details', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findByIdWithDetails(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check access (owner, admin, or reviewer)
    if (artifact.uploaded_by !== req.user.id && !['admin', 'reviewer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get metrics
    const metrics = await Artifact.getMetrics(req.params.id);

    // Get version history
    const versions = await Artifact.getVersionHistory(req.params.id);

    res.json({
      success: true,
      artifact: {
        ...artifact,
        metrics: metrics,
        versions: versions
      }
    });

  } catch (error) {
    console.error('Error fetching artifact details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artifact details' });
  }
});

// POST /api/artifacts/bulk-import - Bulk import artifacts from ZIP or manifest
router.post('/bulk-import', auth, requireResearcher, bulkImportUpload.single('file'), async (req, res) => {
  try {
    const { errorPolicy = 'continue', collectionName } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const AdmZip = require('adm-zip');
    const fs = require('fs');
    const path = require('path');
    const Collection = require('../models/collection');

    const results = {
      total: 0,
      imported: 0,
      failed: 0,
      errors: [],
      collectionId: null
    };

    let fetchResults = null; // For bug report metadata imports

    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    // Create a collection for this import
    const collection = await Collection.create({
      name: collectionName || `Bulk Import - ${req.file.originalname}`,
      description: `Bulk imported from ${fileExtension} file on ${new Date().toLocaleString()}`,
      importSource: fileExtension.substring(1), // Remove the dot
      createdBy: req.user.id
    });

    results.collectionId = collection.id;

    try {
      if (fileExtension === '.zip') {
        // Handle ZIP file import
        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();

        results.total = zipEntries.length;

        for (const entry of zipEntries) {
          if (entry.isDirectory) continue;

          try {
            // Extract file info
            const fileName = path.basename(entry.entryName);
            const fileExt = path.extname(fileName).toLowerCase();

            // Validate file type - comprehensive list matching frontend
            const allowedTypes = [
              // Programming Languages
              '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.c', '.cpp', '.cc', '.h', '.hpp',
              '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala', '.r',
              '.m', '.mm', '.pl', '.sh', '.bash', '.ps1', '.lua', '.dart', '.groovy', '.sql',
              // Web Technologies
              '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
              // Data & Config
              '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.csv',
              // Documentation
              '.md', '.txt', '.pdf', '.rtf', '.tex',
              // Diagrams & Images
              '.uml', '.drawio', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
              // Code-related
              '.diff', '.patch', '.log'
            ];
            if (!allowedTypes.includes(fileExt)) {
              results.failed++;
              results.errors.push({
                item: fileName,
                message: `File type ${fileExt} is not allowed`
              });
              if (errorPolicy === 'abort') break;
              continue;
            }

            // Extract file content
            const fileBuffer = entry.getData();
            const fileSize = fileBuffer.length;

            // Check file size
            if (fileSize > 50 * 1024 * 1024) {
              results.failed++;
              results.errors.push({
                item: fileName,
                message: 'File size exceeds 50MB limit'
              });
              if (errorPolicy === 'abort') break;
              continue;
            }

            // Save extracted file
            const extractedPath = path.join(__dirname, '../uploads', `extracted_${Date.now()}_${fileName}`);
            fs.writeFileSync(extractedPath, fileBuffer);

            // Prepare metadata
            const metadata = {
              tags: [],
              description: `Imported from ZIP: ${req.file.originalname}`,
              originalName: fileName,
              size: fileSize,
              mimeType: 'application/octet-stream'
            };

            // Determine artifact type based on extension
            let artifactType = 'documentation';
            if (['.java', '.py'].includes(fileExt)) artifactType = 'source_code';
            else if (fileExt === '.uml') artifactType = 'uml_diagram';
            else if (['.md', '.txt'].includes(fileExt)) artifactType = 'requirements';
            else if (['.diff', '.patch'].includes(fileExt)) artifactType = 'code_clone_diff';
            else if (['.png', '.jpg', '.jpeg'].includes(fileExt)) artifactType = 'ui_snapshot';
            else if (fileExt === '.json') artifactType = 'documentation';
            // Read content for text files
            let content = null;
            const textTypes = [
              // Programming Languages
              '.java', '.py', '.js', '.jsx', '.ts', '.tsx', '.c', '.cpp', '.cc', '.h', '.hpp',
              '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.kts', '.scala', '.r',
              '.m', '.mm', '.pl', '.sh', '.bash', '.ps1', '.lua', '.dart', '.groovy', '.sql',
              // Web Technologies
              '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue', '.svelte',
              // Data & Config
              '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env', '.csv',
              // Documentation
              '.md', '.txt', '.rtf', '.tex',
              // Diagrams
              '.uml',
              // Code-related
              '.diff', '.patch', '.log'
            ];
            if (textTypes.includes(fileExt)) {
              try {
                content = fileBuffer.toString('utf8');
              } catch (error) {
                console.error('Error reading file content:', error);
              }
            }

            // Create artifact
            const artifact = await Artifact.create({
              name: path.parse(fileName).name,
              type: artifactType,
              file_path: extractedPath,
              content: content,
              metadata: metadata,
              uploaded_by: req.user.id,
              collection_id: collection.id
            });

            results.imported++;

          } catch (error) {
            console.error('Error processing ZIP entry:', error);
            results.failed++;
            results.errors.push({
              item: entry.entryName,
              message: error.message
            });

            if (errorPolicy === 'abort') break;
          }
        }

      } else if (fileExtension === '.csv') {
        // Handle CSV manifest import
        const csvContent = fs.readFileSync(req.file.path, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          return res.status(400).json({
            success: false,
            message: 'CSV file must have at least a header and one data row'
          });
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['title', 'type'];

        for (const required of requiredHeaders) {
          if (!headers.includes(required)) {
            return res.status(400).json({
              success: false,
              message: `CSV must include '${required}' column`
            });
          }
        }

        results.total = lines.length - 1;

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            if (!row.title || !row.type) {
              results.failed++;
              results.errors.push({
                item: `Row ${i + 1}`,
                message: 'Missing required fields: title or type'
              });
              if (errorPolicy === 'abort') break;
              continue;
            }

            // Parse tags
            const tags = row.tags ? row.tags.split(';').map(t => t.trim()).filter(t => t) : [];

            const metadata = {
              tags: tags,
              description: row.description || `Imported from CSV: ${req.file.originalname}`,
              originalName: row.file_path || row.title,
              size: 0,
              mimeType: 'text/plain'
            };

            // Create artifact (without actual file for CSV import)
            const artifact = await Artifact.create({
              name: row.title,
              type: row.type,
              file_path: null,
              content: row.content || '', // Use empty string instead of null to satisfy storage constraint
              metadata: metadata,
              uploaded_by: req.user.id
            });

            results.imported++;

          } catch (error) {
            console.error('Error processing CSV row:', error);
            results.failed++;
            results.errors.push({
              item: `Row ${i + 1}`,
              message: error.message
            });

            if (errorPolicy === 'abort') break;
          }
        }

      } else if (fileExtension === '.json') {
        // Handle JSON manifest import
        const jsonContent = fs.readFileSync(req.file.path, 'utf8');
        let data = JSON.parse(jsonContent);

        // Detect SOLID violations format (code_examples wrapper)
        const isSOLIDFormat = data.code_examples && Array.isArray(data.code_examples);
        if (isSOLIDFormat) {
          console.log(`Detected SOLID violations format with ${data.code_examples.length} code examples`);
          // Transform to create TWO artifacts per example: one for input, one for output
          const transformedData = [];
          data.code_examples.forEach((example, index) => {
            // Input artifact (violating code)
            transformedData.push({
              title: `${example.violation} Violation (Input) - ${example.level} #${index + 1}`,
              type: 'source_code',
              content: example.input,
              tags: [example.violation, example.level, example.language, 'input', 'violating'],
              description: `SOLID ${example.violation} violation - violating code (${example.level} difficulty)`,
              violation: example.violation,
              level: example.level,
              language: example.language,
              codeType: 'input'
            });

            // Output artifact (fixed code)
            transformedData.push({
              title: `${example.violation} Violation (Output) - ${example.level} #${index + 1}`,
              type: 'source_code',
              content: example.output,
              tags: [example.violation, example.level, example.language, 'output', 'fixed'],
              description: `SOLID ${example.violation} violation - fixed code (${example.level} difficulty)`,
              violation: example.violation,
              level: example.level,
              language: example.language,
              codeType: 'output'
            });
          });
          data = transformedData;
          console.log(`Transformed into ${data.length} artifacts (${data.length / 2} input + ${data.length / 2} output)`);
        }

        if (!Array.isArray(data)) {
          return res.status(400).json({
            success: false,
            message: 'JSON file must contain an array of artifact objects or a code_examples array'
          });
        }

        results.total = data.length;

        // Check if this is bug report metadata (has bug_url fields)
        const isBugReportMetadata = data.some(item => item.bug_url);
        fetchResults = null;

        if (isBugReportMetadata) {
          console.log(`Detected bug report metadata with ${data.length} items. Fetching from URLs...`);

          const { fetchBugReportsBatch } = require('../services/bugReportFetcher');
          fetchResults = await fetchBugReportsBatch(data);

          // Log fetch results
          if (fetchResults.errors.length > 0) {
            console.log(`Failed to fetch ${fetchResults.errors.length} bug reports:`);
            fetchResults.errors.forEach(err => {
              console.log(`  - ${err.defects4j_id}: ${err.error}`);
            });
          }
        }

        for (let i = 0; i < data.length; i++) {
          try {
            const item = data[i];

            // Determine artifact name and type
            let artifactName;
            let artifactType;
            let content = item.content;

            if (isBugReportMetadata) {
              // Bug report metadata format
              artifactName = item.defects4j_id || item.title || `Bug #${item.bug_id || i + 1}`;
              artifactType = 'bug_report';

              // Use fetched content if available
              if (fetchResults && fetchResults.fetched[i] && fetchResults.fetched[i].content) {
                content = fetchResults.fetched[i].content;
              }

              // If fetch failed or no content, provide placeholder with URL
              if (!content && item.bug_url) {
                content = `Bug Report: ${artifactName}\n\nOriginal URL: ${item.bug_url}\n\n[Content could not be fetched automatically. This may be due to access restrictions on the source website. Please visit the URL above to view the full bug report.]`;
              } else if (!content) {
                // No URL and no content
                content = `Bug Report: ${artifactName}\n\n[No content or URL available for this bug report.]`;
              }
            } else {
              // Standard manifest format
              if (!item.title || !item.type) {
                results.failed++;
                results.errors.push({
                  item: `Item ${i + 1}`,
                  message: 'Missing required fields: title or type'
                });
                if (errorPolicy === 'abort') break;
                continue;
              }
              artifactName = item.title;
              artifactType = item.type;

              // Ensure content has some value for non-bug-report artifacts
              if (!content && item.content) {
                content = item.content;
              }
            }

            const tags = Array.isArray(item.tags) ? item.tags :
              (item.tags ? item.tags.split(',').map(t => t.trim()) : []);

            // Preserve ALL metadata from JSON
            const metadata = {
              ...item, // Preserve all original fields
              tags: tags,
              description: item.description || `Imported from JSON: ${req.file.originalname}`,
              originalName: item.file_path || item.title || artifactName,
              source: isSOLIDFormat ? 'solid_violations' : (isBugReportMetadata ? 'bug_report_metadata' : 'json_manifest'),
              importedAt: new Date().toISOString()
            };

            // Create artifact
            const artifact = await Artifact.create({
              name: artifactName,
              type: artifactType,
              file_path: null,
              content: content || '', // Use empty string instead of null to satisfy storage constraint
              metadata: metadata,
              uploaded_by: req.user.id,
              collection_id: collection.id
            });

            results.imported++;

          } catch (error) {
            console.error('Error processing JSON item:', error);
            results.failed++;
            results.errors.push({
              item: `Item ${i + 1}`,
              message: error.message
            });

            if (errorPolicy === 'abort') break;
          }
        }
      }

      // If abort policy and there were errors, rollback would happen here
      // For now, we'll just report the results

      // Include fetch errors for bug report metadata imports
      const response = {
        success: true,
        message: `Import completed: ${results.imported} imported, ${results.failed} failed`,
        ...results
      };

      if (fetchResults && fetchResults.errors.length > 0) {
        response.fetchErrors = fetchResults.errors;
        response.message += `. ${fetchResults.errors.length} URLs could not be fetched.`;
      }

      res.json(response);

    } catch (error) {
      console.error('Error processing import file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process import file: ' + error.message
      });
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      }
    }

  } catch (error) {
    console.error('Error in bulk import:', error);
    res.status(500).json({
      success: false,
      message: 'Bulk import failed'
    });
  }
});

// POST /api/artifacts/export - Export selected artifacts to CSV/XLSX
router.post('/export', auth, async (req, res) => {
  try {
    const { artifactIds, format = 'csv' } = req.body;

    if (!artifactIds || !Array.isArray(artifactIds) || artifactIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No artifacts selected for export' });
    }

    if (artifactIds.length > 1000) {
      return res.status(400).json({ success: false, message: 'Cannot export more than 1000 artifacts at once' });
    }

    // Get artifacts with details
    const artifacts = await Artifact.getArtifactsForExport(artifactIds, req.user.id, req.user.role);

    if (artifacts.length === 0) {
      return res.status(404).json({ success: false, message: 'No accessible artifacts found' });
    }

    // Generate export based on format
    if (format === 'xlsx') {
      const XLSX = require('xlsx');

      // Prepare data for Excel
      const exportData = artifacts.map(artifact => {
        const metadata = artifact.metadata || {};
        return {
          ID: artifact.id,
          Title: artifact.name,
          Type: artifact.type?.replace('_', ' '),
          Tags: (metadata.tags || []).join(', '),
          Description: metadata.description || '',
          'Upload Date': new Date(artifact.created_at).toLocaleDateString(),
          'Uploaded By': `${artifact.first_name} ${artifact.last_name}`,
          'File Size (bytes)': metadata.size || '',
          'Original Filename': metadata.originalName || ''
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, 'Artifacts');

      // Generate buffer
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="artifacts_export_${Date.now()}.xlsx"`);
      res.send(buffer);

    } else {
      // CSV export
      const createCsvWriter = require('csv-writer').createObjectCsvWriter;
      const path = require('path');
      const fs = require('fs');

      const filename = `artifacts_export_${Date.now()}.csv`;
      const filepath = path.join(__dirname, '../temp', filename);

      // Ensure temp directory exists
      const tempDir = path.dirname(filepath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const csvWriter = createCsvWriter({
        path: filepath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'name', title: 'Title' },
          { id: 'type', title: 'Type' },
          { id: 'tags', title: 'Tags' },
          { id: 'description', title: 'Description' },
          { id: 'created_at', title: 'Upload Date' },
          { id: 'uploaded_by', title: 'Uploaded By' },
          { id: 'file_size', title: 'File Size (bytes)' },
          { id: 'original_filename', title: 'Original Filename' }
        ]
      });

      // Prepare data for CSV
      const exportData = artifacts.map(artifact => {
        const metadata = artifact.metadata || {};
        return {
          id: artifact.id,
          name: artifact.name,
          type: artifact.type?.replace('_', ' '),
          tags: (metadata.tags || []).join(', '),
          description: metadata.description || '',
          created_at: new Date(artifact.created_at).toLocaleDateString(),
          uploaded_by: `${artifact.first_name} ${artifact.last_name}`,
          file_size: metadata.size || '',
          original_filename: metadata.originalName || ''
        };
      });

      await csvWriter.writeRecords(exportData);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(filepath);
      fileStream.pipe(res);

      // Clean up temp file after sending
      fileStream.on('end', () => {
        fs.unlink(filepath, (err) => {
          if (err) console.error('Error deleting temp file:', err);
        });
      });
    }

  } catch (error) {
    console.error('Error exporting artifacts:', error);
    res.status(500).json({ success: false, message: 'Failed to export artifacts' });
  }
});

// POST /api/artifacts/migrate-to-database - Migrate all filesystem artifacts to database
router.post('/migrate-to-database', auth, async (req, res) => {
  try {
    // Only allow admins to run migration
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const results = await Artifact.migrateAllFilesToDatabase();

    res.json({
      success: true,
      message: `Migration completed: ${results.migrated} migrated, ${results.failed} failed`,
      ...results
    });

  } catch (error) {
    console.error('Error migrating artifacts:', error);
    res.status(500).json({ success: false, message: 'Migration failed' });
  }
});

// POST /api/artifacts/:id/migrate-to-database - Migrate specific artifact to database
router.post('/:id/migrate-to-database', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findByIdWithoutFileData(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership or admin
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (artifact.storage_type !== 'filesystem') {
      return res.status(400).json({
        success: false,
        message: `Artifact is already stored in ${artifact.storage_type}`
      });
    }

    const result = await Artifact.migrateFileToDatabase(req.params.id);

    res.json({
      success: true,
      message: 'Artifact migrated to database successfully',
      migratedSize: result.migratedSize
    });

  } catch (error) {
    console.error('Error migrating artifact:', error);
    res.status(500).json({ success: false, message: 'Migration failed: ' + error.message });
  }
});

// PUT /api/artifacts/:id/tags - Update artifact tags
router.put('/:id/tags', auth, async (req, res) => {
  try {
    const { tags } = req.body;

    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, message: 'Tags must be an array' });
    }

    // Get or create tags (auto-approve for admins)
    const autoApprove = req.user.role === 'admin';
    const tagObjects = await Tag.getOrCreateTags(tags, req.user.id, autoApprove);
    const tagIds = tagObjects.map(tag => tag.id);

    // Set artifact tags
    const assignedTags = await Tag.setArtifactTags(req.params.id, tagIds);

    res.json({
      success: true,
      message: 'Tags updated successfully',
      tags: assignedTags
    });
  } catch (error) {
    console.error('Error updating artifact tags:', error);
    res.status(500).json({ success: false, message: 'Failed to update tags' });
  }
});

// GET /api/artifacts/:id/tags - Get artifact tags
router.get('/:id/tags', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check access
    if (artifact.uploaded_by !== req.user.id && !['admin', 'reviewer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const tags = await Tag.getArtifactTags(req.params.id);
    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error fetching artifact tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tags' });
  }
});

// PUT /api/artifacts/:id/studies - Assign artifact to studies
router.put('/:id/studies', auth, async (req, res) => {
  try {
    const { studyIds } = req.body;

    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!Array.isArray(studyIds)) {
      return res.status(400).json({ success: false, message: 'Study IDs must be an array' });
    }

    // Validate that user owns or has access to the studies
    for (const studyId of studyIds) {
      const study = await Study.findById(studyId);
      if (!study) {
        return res.status(404).json({
          success: false,
          message: `Study with ID ${studyId} not found`
        });
      }

      if (study.created_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: `Access denied to study: ${study.title}`
        });
      }
    }

    // Assign to studies
    const results = await Artifact.assignToStudies(req.params.id, studyIds, req.user.id);

    res.json({
      success: true,
      message: `Assigned to ${results.assigned.length} studies, ${results.failed.length} failed`,
      results
    });
  } catch (error) {
    console.error('Error assigning artifact to studies:', error);
    res.status(500).json({ success: false, message: 'Failed to assign to studies' });
  }
});

// GET /api/artifacts/:id/studies - Get studies for artifact
router.get('/:id/studies', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check access
    if (artifact.uploaded_by !== req.user.id && !['admin', 'reviewer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const studies = await Artifact.getStudiesForArtifact(req.params.id);
    res.json({ success: true, studies });
  } catch (error) {
    console.error('Error fetching artifact studies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch studies' });
  }
});

// POST /api/artifacts/bulk-assign - Bulk assign artifacts to studies/tags
router.post('/bulk-assign', auth, async (req, res) => {
  try {
    const { artifactIds, studyIds, tags, action } = req.body;

    if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Artifact IDs must be a non-empty array'
      });
    }

    if (!action || !['assign-studies', 'assign-tags', 'remove-studies'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be assign-studies, assign-tags, or remove-studies'
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: []
    };

    for (const artifactId of artifactIds) {
      try {
        const artifact = await Artifact.findById(artifactId);
        if (!artifact) {
          results.failed++;
          results.errors.push({ artifactId, message: 'Artifact not found' });
          continue;
        }

        // Check ownership
        if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
          results.failed++;
          results.errors.push({ artifactId, message: 'Access denied' });
          continue;
        }

        if (action === 'assign-studies' && studyIds) {
          await Artifact.assignToStudies(artifactId, studyIds, req.user.id);
        } else if (action === 'remove-studies' && studyIds) {
          await Artifact.removeFromStudies(artifactId, studyIds);
        } else if (action === 'assign-tags' && tags) {
          const autoApprove = req.user.role === 'admin';
          const tagObjects = await Tag.getOrCreateTags(tags, req.user.id, autoApprove);
          const tagIds = tagObjects.map(tag => tag.id);
          await Tag.setArtifactTags(artifactId, tagIds);
        }

        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({ artifactId, message: error.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk operation completed: ${results.processed} processed, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('Error in bulk assign:', error);
    res.status(500).json({ success: false, message: 'Bulk operation failed' });
  }
});

// DELETE /api/artifacts/:id - Delete artifact
router.delete('/:id', auth, async (req, res) => {
  try {
    const artifact = await Artifact.findByIdWithoutFileData(req.params.id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Delete file from filesystem if stored there
    if (artifact.storage_type === 'filesystem' && artifact.file_path && fs.existsSync(artifact.file_path)) {
      fs.unlink(artifact.file_path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    // For database storage, file_data will be deleted automatically with the row

    // Delete from database
    const deleted = await Artifact.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    res.json({ success: true, message: 'Artifact deleted successfully' });

  } catch (error) {
    console.error('Error deleting artifact:', error);
    res.status(500).json({ success: false, message: 'Failed to delete artifact' });
  }
});

// DELETE /api/artifacts/:id/soft - Soft delete artifact (US 2.8)
router.delete('/:id/soft', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const artifact = await Artifact.findById(id);
    if (!artifact) {
      return res.status(404).json({ success: false, message: 'Artifact not found' });
    }

    // Check ownership (only owner or admin can delete)
    if (artifact.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (artifact.is_deleted) {
      return res.status(400).json({ success: false, message: 'Artifact is already deleted' });
    }

    const result = await retentionService.softDeleteArtifact(
      parseInt(id),
      req.user.id,
      reason || 'User requested deletion'
    );

    res.json({
      success: true,
      message: 'Artifact moved to trash successfully',
      deletedArtifactId: result.deletedArtifactId,
      scheduledPurgeAt: result.scheduledPurgeAt
    });

  } catch (error) {
    console.error('Error soft deleting artifact:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete artifact' });
  }
});

// POST /api/artifacts/:id/restore - Restore soft-deleted artifact
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the deleted artifact record
    const deletedArtifacts = await retentionService.getDeletedArtifacts({
      userId: req.user.role === 'admin' ? undefined : req.user.id
    });

    const deletedArtifact = deletedArtifacts.find(da => da.original_artifact_id === parseInt(id));
    if (!deletedArtifact) {
      return res.status(404).json({ success: false, message: 'Deleted artifact not found' });
    }

    if (deletedArtifact.is_restored) {
      return res.status(400).json({ success: false, message: 'Artifact is already restored' });
    }

    // Check ownership (only owner or admin can restore)
    const originalArtifactData = deletedArtifact.artifact_data;
    if (originalArtifactData.uploaded_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const restoredArtifactId = await retentionService.restoreArtifact(deletedArtifact.id, req.user.id);

    res.json({
      success: true,
      message: 'Artifact restored successfully',
      artifactId: restoredArtifactId
    });

  } catch (error) {
    console.error('Error restoring artifact:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to restore artifact' });
  }
});

// POST /api/artifacts/bulk-import-async - Async bulk import with cancellation support
router.post('/bulk-import-async', auth, requireResearcher, bulkImportUpload.single('file'), async (req, res) => {
  try {
    const { errorPolicy = 'continue', collectionName } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const path = require('path');
    const fs = require('fs');

    // Determine total items for job tracking
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let totalItems = 1;

    // Estimate total items based on file type
    if (fileExtension === '.zip') {
      const AdmZip = require('adm-zip');
      try {
        const zip = new AdmZip(req.file.path);
        totalItems = zip.getEntries().filter(e => !e.isDirectory).length;
      } catch (e) {
        totalItems = 1;
      }
    } else if (fileExtension === '.json') {
      try {
        const jsonContent = fs.readFileSync(req.file.path, 'utf8');
        const data = JSON.parse(jsonContent);
        totalItems = Array.isArray(data) ? data.length : 1;
      } catch (e) {
        totalItems = 1;
      }
    }

    // Create import job
    const job = importJobManager.createJob(req.user.id, req.file.originalname, totalItems);

    // Start async processing
    const { processBulkImport } = require('../services/bulkImportProcessor');
    processBulkImport(job, req.file, req.user, errorPolicy, collectionName).catch(err => {
      console.error('Bulk import error:', err);
      job.setError(err.message);
    });

    // Return job ID immediately for progress tracking
    res.json({
      success: true,
      jobId: job.id,
      message: `Import started with ${totalItems} items`,
      totalItems: totalItems
    });

  } catch (error) {
    console.error('Error starting async bulk import:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start import: ' + error.message
    });
  }
});

module.exports = router;