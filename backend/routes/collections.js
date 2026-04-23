const express = require('express');
const router = express.Router();
const Collection = require('../models/collection');
const { auth, requireResearcher } = require('../middleware/auth');

// GET /api/collections - Get all collections for current user  
router.get('/', auth, async (req, res) => {
    try {
        let collections;

        if (req.user.role === 'admin') {
            collections = await Collection.findAll();
        } else {
            collections = await Collection.findByUserId(req.user.id);
        }

        res.json({ success: true, collections });
    } catch (error) {
        console.error('Error fetching collections:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch collections' });
    }
});

// GET /api/collections/:id - Get specific collection
router.get('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ success: false, message: 'Collection not found' });
        }

        // Check ownership
        if (collection.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, collection });
    } catch (error) {
        console.error('Error fetching collection:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch collection' });
    }
});

// GET /api/collections/:id/artifacts - Get artifacts in collection with pagination
router.get('/:id/artifacts', auth, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ success: false, message: 'Collection not found' });
        }

        // Check ownership
        if (collection.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const artifacts = await Collection.getArtifacts(req.params.id, parseInt(limit), parseInt(offset));
        const totalCount = await Collection.getArtifactCount(req.params.id);

        res.json({
            success: true,
            artifacts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching collection artifacts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch artifacts' });
    }
});

// PUT /api/collections/:id - Update collection
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, description } = req.body;

        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ success: false, message: 'Collection not found' });
        }

        // Check ownership
        if (collection.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const updated = await Collection.update(req.params.id, { name, description });

        res.json({ success: true, collection: updated });
    } catch (error) {
        console.error('Error updating collection:', error);
        res.status(500).json({ success: false, message: 'Failed to update collection' });
    }
});

// DELETE /api/collections/:id - Delete collection
router.delete('/:id', auth, async (req, res) => {
    try {
        const { deleteArtifacts } = req.query;
        const collection = await Collection.findById(req.params.id);

        if (!collection) {
            return res.status(404).json({ success: false, message: 'Collection not found' });
        }

        // Check ownership
        if (collection.created_by !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Convert deleteArtifacts to boolean
        const shouldDeleteArtifacts = deleteArtifacts === 'true';

        await Collection.delete(req.params.id, shouldDeleteArtifacts);

        res.json({
            success: true,
            message: shouldDeleteArtifacts
                ? 'Collection and artifacts deleted successfully'
                : 'Collection deleted successfully (artifacts preserved)'
        });
    } catch (error) {
        console.error('Error deleting collection:', error);
        res.status(500).json({ success: false, message: 'Failed to delete collection' });
    }
});

module.exports = router;
