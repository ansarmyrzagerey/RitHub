const express = require('express');
const router = express.Router();
const ArtifactSet = require('../models/artifactSet');
const { auth, requireResearcher } = require('../middleware/auth');

// GET /api/artifact-sets - Get all artifact sets for current user
router.get('/', auth, requireResearcher, async (req, res) => {
  try {
    const artifactSets = await ArtifactSet.findByCreator(req.user.id);
    res.json({ success: true, artifactSets });
  } catch (error) {
    console.error('Error fetching artifact sets:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artifact sets' });
  }
});

// GET /api/artifact-sets/:id - Get specific artifact set
router.get('/:id', auth, requireResearcher, async (req, res) => {
  try {
    const artifactSet = await ArtifactSet.findById(req.params.id);
    
    if (!artifactSet) {
      return res.status(404).json({ success: false, message: 'Artifact set not found' });
    }
    
    // Check ownership
    if (artifactSet.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    res.json({ success: true, artifactSet });
  } catch (error) {
    console.error('Error fetching artifact set:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch artifact set' });
  }
});

// POST /api/artifact-sets - Create new artifact set
router.post('/', auth, requireResearcher, async (req, res) => {
  try {
    const { name, description, artifact_ids } = req.body;
    
    if (!name || !artifact_ids) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and artifact_ids are required' 
      });
    }
    
    const artifactSet = await ArtifactSet.create({
      name,
      description,
      created_by: req.user.id,
      artifact_ids
    });
    
    // Fetch full details
    const fullSet = await ArtifactSet.findById(artifactSet.id);
    
    res.status(201).json({ 
      success: true, 
      message: 'Artifact set created successfully',
      artifactSet: fullSet
    });
  } catch (error) {
    console.error('Error creating artifact set:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to create artifact set' 
    });
  }
});

// DELETE /api/artifact-sets/:id - Delete artifact set
router.delete('/:id', auth, requireResearcher, async (req, res) => {
  try {
    const deleted = await ArtifactSet.delete(req.params.id, req.user.id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Artifact set not found' });
    }
    
    res.json({ success: true, message: 'Artifact set deleted successfully' });
  } catch (error) {
    console.error('Error deleting artifact set:', error);
    res.status(403).json({ 
      success: false, 
      message: error.message || 'Failed to delete artifact set' 
    });
  }
});

module.exports = router;
