const express = require('express');
const router = express.Router();
const TaskGenerationService = require('../services/taskGenerationService');
const { auth, requireResearcher } = require('../middleware/auth');

// GET /api/studies/:id/task-generation-status - Get task generation status
router.get('/:id/task-generation-status', auth, requireResearcher, async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    const status = await TaskGenerationService.getTaskGenerationStatus(studyId);
    
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('Error getting task generation status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get task generation status'
    });
  }
});

// POST /api/studies/:id/generate-tasks - Manually generate tasks (for draft studies)
router.post('/:id/generate-tasks', auth, requireResearcher, async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    
    // Verify ownership
    const pool = require('../config/database');
    const studyRes = await pool.query(
      'SELECT created_by, status FROM studies WHERE id = $1',
      [studyId]
    );
    
    if (!studyRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }
    
    if (studyRes.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (studyRes.rows[0].status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only generate tasks for draft studies'
      });
    }
    
    const result = await TaskGenerationService.regenerateTasks(studyId);
    
    res.json({
      success: true,
      message: `Successfully generated ${result.tasksCreated} tasks`,
      ...result
    });
  } catch (error) {
    console.error('Error generating tasks:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to generate tasks'
    });
  }
});

// POST /api/studies/:id/regenerate-tasks - Regenerate tasks (for draft studies)
router.post('/:id/regenerate-tasks', auth, requireResearcher, async (req, res) => {
  try {
    const studyId = parseInt(req.params.id);
    
    // Verify ownership
    const pool = require('../config/database');
    const studyRes = await pool.query(
      'SELECT created_by, status FROM studies WHERE id = $1',
      [studyId]
    );
    
    if (!studyRes.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }
    
    if (studyRes.rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    if (studyRes.rows[0].status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only regenerate tasks for draft studies'
      });
    }
    
    const result = await TaskGenerationService.regenerateTasks(studyId);
    
    res.json({
      success: true,
      message: `Successfully regenerated ${result.tasksCreated} tasks`,
      ...result
    });
  } catch (error) {
    console.error('Error regenerating tasks:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to regenerate tasks'
    });
  }
});

module.exports = router;
