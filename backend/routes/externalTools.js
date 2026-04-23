const express = require('express');
const router = express.Router();
const multer = require('multer');
const Artifact = require('../models/artifact');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { externalApiLimiter } = require('../middleware/rateLimiter');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * POST /api/external/artifacts
 * Push artifact with metadata via external tool API
 * US 2.9: External Tool API
 */
router.post('/artifacts', apiKeyAuth, externalApiLimiter, upload.single('file'), async (req, res) => {
    try {
        const { name, type, metadata } = req.body;

        // Validate required fields
        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name and type are required'
            });
        }

        // Validate artifact type
        const validTypes = ['source_code', 'test_case', 'uml_diagram', 'requirements', 'documentation'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid artifact type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Check if file is provided
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'File is required'
            });
        }

        // Parse metadata if provided as string
        let parsedMetadata = {};
        if (metadata) {
            try {
                parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid metadata format. Must be valid JSON.'
                });
            }
        }

        // Add external API source to metadata
        parsedMetadata.source = 'external_api';
        parsedMetadata.api_key_name = req.apiKey.name;
        parsedMetadata.uploaded_via = 'api';

        // Read file content for text files
        let content = null;
        const textTypes = ['.java', '.py', '.md', '.txt'];
        const fileName = req.file.originalname || 'file';
        const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

        if (textTypes.includes(ext)) {
            try {
                content = req.file.buffer.toString('utf8');
            } catch (error) {
                console.error('Error reading file content:', error);
            }
        }

        // Create artifact using buffer
        const artifact = await Artifact.createFromBuffer({
            name: name,
            type: type,
            fileBuffer: req.file.buffer,
            fileName: fileName,
            mimeType: req.file.mimetype,
            content: content,
            metadata: parsedMetadata,
            uploaded_by: req.apiKey.createdBy // Use the API key creator as the uploader
        });

        res.status(201).json({
            success: true,
            message: 'Artifact created successfully',
            artifact: {
                id: artifact.id,
                name: artifact.name,
                type: artifact.type,
                file_size: artifact.file_size,
                created_at: artifact.created_at
            }
        });

    } catch (error) {
        console.error('Error creating artifact via external API:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create artifact',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/external/metrics/:artifactId
 * Push metrics for an existing artifact
 * US 2.9: External Tool API
 */
router.post('/metrics/:artifactId', apiKeyAuth, externalApiLimiter, async (req, res) => {
    try {
        const { artifactId } = req.params;
        const { metrics } = req.body;

        // Validate metrics array
        if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Metrics array is required and must not be empty'
            });
        }

        // Check if artifact exists
        const artifact = await Artifact.findById(artifactId);
        if (!artifact) {
            return res.status(404).json({
                success: false,
                error: 'Artifact not found'
            });
        }

        // Validate and store each metric
        const metricIds = [];
        for (const metric of metrics) {
            // Validate metric structure
            if (!metric.type || metric.value === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Each metric must have "type" and "value" fields'
                });
            }

            // Add metadata about the source
            const metricData = metric.data || {};
            metricData.source = 'external_api';
            metricData.api_key_name = req.apiKey.name;

            // Store metric
            const result = await Artifact.addMetric(
                artifactId,
                metric.type,
                metric.value,
                metricData
            );

            metricIds.push(result.id);
        }

        res.status(201).json({
            success: true,
            message: `${metrics.length} metric(s) stored successfully`,
            metricIds: metricIds,
            artifactId: parseInt(artifactId)
        });

    } catch (error) {
        console.error('Error storing metrics via external API:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to store metrics',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
