const express = require('express');
const router = express.Router();
const Tag = require('../models/tag');
const { auth, requireAdmin } = require('../middleware/auth');

// GET /api/tags - Get all approved tags
router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;
    const filters = { status: 'approved' };

    if (search) {
      filters.search = search;
    }

    const tags = await Tag.findAll(filters);
    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tags' });
  }
});

// GET /api/tags/pending - Get pending tags for admin approval
router.get('/pending', auth, requireAdmin, async (req, res) => {
  try {
    const pendingTags = await Tag.getPending();
    res.json({ success: true, tags: pendingTags });
  } catch (error) {
    console.error('Error fetching pending tags:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending tags' });
  }
});

// POST /api/tags - Create new tag
router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tag name is required'
      });
    }

    // Check if tag already exists
    const existingTag = await Tag.findByName(name);
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: 'Tag already exists'
      });
    }

    // Auto-approve for admins only, otherwise pending
    const autoApprove = req.user.role === 'admin';

    const tag = await Tag.create({
      name,
      description: description || null,
      created_by: req.user.id
    }, autoApprove);

    const message = autoApprove
      ? 'Tag created and approved successfully'
      : 'Tag created and submitted for approval';

    res.status(201).json({
      success: true,
      message,
      tag
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ success: false, message: 'Failed to create tag' });
  }
});

// POST /api/tags/:id/approve - Approve pending tag
router.post('/:id/approve', auth, requireAdmin, async (req, res) => {
  try {
    const tag = await Tag.approve(req.params.id, req.user.id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found or not pending'
      });
    }

    res.json({
      success: true,
      message: 'Tag approved successfully',
      tag
    });
  } catch (error) {
    console.error('Error approving tag:', error);
    res.status(500).json({ success: false, message: 'Failed to approve tag' });
  }
});

// POST /api/tags/:id/reject - Reject pending tag
router.post('/:id/reject', auth, requireAdmin, async (req, res) => {
  try {
    const tag = await Tag.reject(req.params.id, req.user.id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found or not pending'
      });
    }

    res.json({
      success: true,
      message: 'Tag rejected successfully',
      tag
    });
  } catch (error) {
    console.error('Error rejecting tag:', error);
    res.status(500).json({ success: false, message: 'Failed to reject tag' });
  }
});

// DELETE /api/tags/:id - Delete tag
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const deleted = await Tag.delete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Tag not found'
      });
    }

    res.json({
      success: true,
      message: 'Tag deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tag:', error);

    if (error.message.includes('used by artifacts')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({ success: false, message: 'Failed to delete tag' });
  }
});

module.exports = router;