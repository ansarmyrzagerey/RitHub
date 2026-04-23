const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth, requireAdmin } = require('../middleware/auth');
const policyService = require('../services/policyService');
const retentionService = require('../services/retentionService');

// All admin routes require authentication and admin role
router.use(auth);
router.use(requireAdmin);

// Study Management Routes (from upstream)
/**
 * GET /api/admin/studies - Get all studies (admin dashboard)
 * Returns all studies from all researchers with detailed information
 */
router.get('/studies', async (req, res) => {
  try {
    const { status, search, sort = 'created_at', order = 'DESC' } = req.query;

    // Build query
    let query = `
      SELECT 
        s.id, 
        s.title, 
        s.description, 
        s.status, 
        s.deadline,
        s.participant_capacity,
        s.enrolled_count,
        s.cancelled_by,
        s.cancelled_at,
        s.cancellation_reason,
        s.created_at,
        s.updated_at,
        u.id as researcher_id,
        u.first_name as researcher_first_name,
        u.last_name as researcher_last_name,
        u.email as researcher_email,
        u.organization as researcher_organization,
        (SELECT COUNT(*) FROM evaluation_tasks WHERE study_id = s.id) as task_count
      FROM studies s
      JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

    const params = [];

    // Filter by status
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    // Search by title or researcher name
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        s.title ILIKE $${params.length} OR 
        u.first_name ILIKE $${params.length} OR 
        u.last_name ILIKE $${params.length} OR
        u.email ILIKE $${params.length}
      )`;
    }

    // Sorting
    const allowedSortFields = ['created_at', 'updated_at', 'title', 'status', 'enrolled_count', 'deadline'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY s.${sortField} ${sortOrder}`;

    const result = await pool.query(query, params);

    // Format response
    const studies = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      deadline: row.deadline,
      participant_capacity: row.participant_capacity,
      enrolled_count: row.enrolled_count,
      task_count: parseInt(row.task_count, 10),
      cancelled_by: row.cancelled_by,
      cancelled_at: row.cancelled_at,
      cancellation_reason: row.cancellation_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
      researcher: {
        id: row.researcher_id,
        first_name: row.researcher_first_name,
        last_name: row.researcher_last_name,
        email: row.researcher_email,
        organization: row.researcher_organization
      }
    }));

    res.json({
      success: true,
      studies,
      total: studies.length
    });

  } catch (error) {
    console.error('Error fetching admin studies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch studies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================================================
// STUDY TRASH BIN MANAGEMENT (Admin) - Must come before /studies/:id route
// ============================================================================

/**
 * GET /api/admin/studies/trash - Get all deleted studies (admin trash bin view)
 * Returns all deleted studies from all researchers
 */
router.get('/studies/trash', async (req, res) => {
  try {
    const { search, sort = 'deleted_at', order = 'DESC' } = req.query;
    const Study = require('../models/study');

    // Get all deleted studies
    const deletedStudies = await Study.findDeleted();

    // Apply search filter if provided
    let filteredStudies = deletedStudies;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredStudies = deletedStudies.filter(study => 
        study.title.toLowerCase().includes(searchLower) ||
        study.creator_first_name.toLowerCase().includes(searchLower) ||
        study.creator_last_name.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    const allowedSortFields = ['deleted_at', 'title', 'creator_first_name', 'days_in_trash'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'deleted_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 1 : -1;

    filteredStudies.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'deleted_at') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (aVal < bVal) return -sortOrder;
      if (aVal > bVal) return sortOrder;
      return 0;
    });

    res.json({
      success: true,
      studies: filteredStudies,
      total: filteredStudies.length
    });

  } catch (error) {
    console.error('Error fetching deleted studies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch deleted studies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/studies/:id - Get detailed study information
 * Returns comprehensive study details including participants and evaluations
 */
router.get('/studies/:id', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id, 10);

    // Get study with researcher info
    const studyQuery = `
      SELECT 
        s.*,
        u.id as researcher_id,
        u.first_name as researcher_first_name,
        u.last_name as researcher_last_name,
        u.email as researcher_email,
        u.organization as researcher_organization
      FROM studies s
      JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `;

    const studyResult = await pool.query(studyQuery, [studyId]);

    if (studyResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Study not found'
      });
    }

    const study = studyResult.rows[0];

    // Get participants
    const participantsQuery = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        sp.enrolled_at,
        COUNT(DISTINCT tp.task_id) FILTER (WHERE tp.status = 'completed') as completed_tasks,
        COUNT(DISTINCT et.id) as total_tasks
      FROM study_participants sp
      JOIN users u ON sp.participant_id = u.id
      LEFT JOIN evaluation_tasks et ON et.study_id = sp.study_id
      LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = u.id
      WHERE sp.study_id = $1
      GROUP BY u.id, u.first_name, u.last_name, u.email, sp.enrolled_at
      ORDER BY sp.enrolled_at DESC
    `;

    const participantsResult = await pool.query(participantsQuery, [studyId]);

    // Get task count
    const taskCountQuery = `SELECT COUNT(*) as count FROM evaluation_tasks WHERE study_id = $1`;
    const taskCountResult = await pool.query(taskCountQuery, [studyId]);

    res.json({
      success: true,
      study: {
        id: study.id,
        title: study.title,
        description: study.description,
        status: study.status,
        deadline: study.deadline,
        participant_capacity: study.participant_capacity,
        enrolled_count: study.enrolled_count,
        task_count: parseInt(taskCountResult.rows[0].count, 10),
        cancelled_by: study.cancelled_by,
        cancelled_at: study.cancelled_at,
        cancellation_reason: study.cancellation_reason,
        created_at: study.created_at,
        updated_at: study.updated_at,
        researcher: {
          id: study.researcher_id,
          first_name: study.researcher_first_name,
          last_name: study.researcher_last_name,
          email: study.researcher_email,
          organization: study.researcher_organization
        },
        participants: participantsResult.rows.map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          enrolled_at: p.enrolled_at,
          completed_tasks: parseInt(p.completed_tasks, 10),
          total_tasks: parseInt(p.total_tasks, 10)
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching admin study details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/statistics - Get platform-wide statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM studies) as total_studies,
        (SELECT COUNT(*) FROM studies WHERE status = 'active') as active_studies,
        (SELECT COUNT(*) FROM studies WHERE status = 'draft') as draft_studies,
        (SELECT COUNT(*) FROM studies WHERE status = 'completed') as completed_studies,
        (SELECT COUNT(*) FROM studies WHERE status = 'cancelled') as cancelled_studies,
        (SELECT COUNT(*) FROM users WHERE role = 'researcher') as total_researchers,
        (SELECT COUNT(*) FROM users WHERE role = 'participant') as total_participants,
        (SELECT COUNT(*) FROM study_participants) as total_enrollments,
        (SELECT COUNT(*) FROM evaluations) as total_evaluations,
        (SELECT COUNT(*) FROM evaluations WHERE reflagged = true) as reflagged_evaluations
    `);

    res.json({
      success: true,
      statistics: stats.rows[0]
    });

  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/flagged-evaluations - Get all reflagged evaluations with full details
 */
router.get('/flagged-evaluations', async (req, res) => {
  try {
    // First, get the flagged evaluations with basic info
    const flaggedEvalsQ = await pool.query(`
      SELECT DISTINCT
        e.participant_id,
        e.completed_at,
        et.study_id,
        s.title as study_title,
        researcher.id as researcher_id,
        researcher.first_name as researcher_first_name,
        researcher.last_name as researcher_last_name,
        researcher.email as researcher_email,
        participant.id as participant_id,
        participant.first_name as participant_first_name,
        participant.last_name as participant_last_name,
        participant.email as participant_email,
        participant.suspended_until as participant_suspended_until
      FROM evaluations e
      JOIN evaluation_tasks et ON e.task_id = et.id
      JOIN studies s ON et.study_id = s.id
      JOIN users researcher ON s.created_by = researcher.id
      JOIN users participant ON e.participant_id = participant.id
      WHERE COALESCE(e.reflagged, false) = true
      ORDER BY e.completed_at DESC
    `);

    // For each flagged evaluation, get all tasks from that study with that participant's responses
    const evaluationsWithTasks = await Promise.all(flaggedEvalsQ.rows.map(async (evalRow) => {
      // Get all tasks for this study
      const tasksQ = await pool.query(`
        SELECT id, task_type, instructions, answer_type, answer_options, 
               artifact1_id, artifact2_id, artifact3_id
        FROM evaluation_tasks
        WHERE study_id = $1
        ORDER BY created_at
      `, [evalRow.study_id]);

      // Get all evaluations by this participant for these tasks
      const participantEvalsQ = await pool.query(`
        SELECT e.id, e.task_id, e.ratings, e.annotations, e.comments, e.completed_at
        FROM evaluations e
        WHERE e.task_id = ANY($1::int[]) AND e.participant_id = $2
      `, [tasksQ.rows.map(t => t.id), evalRow.participant_id]);

      // Build tasks array with artifacts and evaluation data
      const tasks = await Promise.all(tasksQ.rows.map(async (task) => {
        // Find the evaluation for this task
        const evaluation = participantEvalsQ.rows.find(e => e.task_id === task.id);

        // Fetch artifacts
        let artifact1 = null, artifact2 = null, artifact3 = null;
        
        if (task.artifact1_id) {
          const a1Q = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = $1', [task.artifact1_id]);
          artifact1 = a1Q.rows[0] || null;
        }
        if (task.artifact2_id) {
          const a2Q = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = $1', [task.artifact2_id]);
          artifact2 = a2Q.rows[0] || null;
        }
        if (task.artifact3_id) {
          const a3Q = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = $1', [task.artifact3_id]);
          artifact3 = a3Q.rows[0] || null;
        }

        return {
          evaluationId: evaluation?.id || null,
          taskId: task.id,
          taskType: task.task_type,
          instructions: task.instructions,
          answerType: task.answer_type,
          answerOptions: task.answer_options,
          artifact1,
          artifact2,
          artifact3,
          ratings: evaluation?.ratings || [],
          choice: evaluation?.annotations?.choice || null,
          text: evaluation?.annotations?.text || null,
          annotations: evaluation?.annotations || {},
          comments: evaluation?.comments || ''
        };
      }));

      return {
        study_id: evalRow.study_id,
        study_title: evalRow.study_title,
        researcher_id: evalRow.researcher_id,
        researcher_first_name: evalRow.researcher_first_name,
        researcher_last_name: evalRow.researcher_last_name,
        researcher_email: evalRow.researcher_email,
        participant_id: evalRow.participant_id,
        participant_first_name: evalRow.participant_first_name,
        participant_last_name: evalRow.participant_last_name,
        participant_email: evalRow.participant_email,
        participant_suspended_until: evalRow.participant_suspended_until,
        completedAt: evalRow.completed_at,
        tasks
      };
    }));

    res.json({
      success: true,
      evaluations: evaluationsWithTasks
    });

  } catch (error) {
    console.error('Error fetching flagged evaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flagged evaluations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PATCH /api/admin/evaluations/:id/unflag - Admin unflag evaluation (clears both flagged and reflagged)
 */
router.patch('/evaluations/:id/unflag', async (req, res) => {
  try {
    const evaluationId = parseInt(req.params.id, 10);
    
    // Find the study for this evaluation
    const studyQ = await pool.query(
      `SELECT et.study_id FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE ev.id = $1`,
      [evaluationId]
    );
    const studyId = studyQ.rows[0]?.study_id;
    
    // Update evaluation flag status (clear both flagged and reflagged)
    await pool.query('UPDATE evaluations SET flagged = false, reflagged = false WHERE id = $1', [evaluationId]);
    
    // Check if any other flagged evaluations remain in this study
    if (studyId) {
      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM evaluations ev
         JOIN evaluation_tasks et ON ev.task_id = et.id
         WHERE et.study_id = $1 AND (ev.flagged = true OR ev.reflagged = true)`,
        [studyId]
      );
      const stillFlagged = remaining.rows[0]?.cnt || 0;
      
      // If no flagged evaluations remain, delete the study-level notifications for all reviewers
      if (stillFlagged === 0) {
        await pool.query(
          `DELETE FROM notifications n
           USING users u
           WHERE n.user_id = u.id
             AND u.role = 'reviewer'
             AND n.link = $1`,
          [`/studies/${studyId}`]
        );
      }
    }
    
    res.json({ success: true, flagged: false, reflagged: false });
  } catch (err) {
    console.error('Error unflagging evaluation:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to unflag evaluation',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Policy Management Routes (from stashed changes)

// File Policy Management
router.get('/file-policies', async (req, res) => {
  try {
    const policies = await policyService.getFilePolicies();
    res.json({ success: true, policies });
  } catch (error) {
    console.error('Error fetching file policies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch file policies' });
  }
});

router.post('/file-policies', async (req, res) => {
  try {
    const { policyName, policyType, targetId, allowedFileTypes, maxFileSize } = req.body;

    if (!policyName || !policyType || !allowedFileTypes) {
      return res.status(400).json({
        success: false,
        message: 'Policy name, type, and allowed file types are required'
      });
    }

    const policy = await policyService.createFilePolicy({
      policyName,
      policyType,
      targetId: targetId || null,
      allowedFileTypes,
      maxFileSize: maxFileSize || 52428800, // Default 50MB
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, policy });
  } catch (error) {
    console.error('Error creating file policy:', error);
    res.status(500).json({ success: false, message: 'Failed to create file policy' });
  }
});

router.put('/file-policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log('Received update request for policy:', id, 'with updates:', JSON.stringify(updates));

    const policy = await policyService.updateFilePolicy(id, updates);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    res.json({ success: true, policy });
  } catch (error) {
    console.error('Error updating file policy:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update file policy' });
  }
});

router.delete('/file-policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await policyService.deleteFilePolicy(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    res.json({ success: true, message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting file policy:', error);
    res.status(500).json({ success: false, message: 'Failed to delete file policy' });
  }
});

// Storage Quota Management
router.get('/storage-quotas', async (req, res) => {
  try {
    const quotas = await policyService.getStorageQuotas();
    res.json({ success: true, quotas });
  } catch (error) {
    console.error('Error fetching storage quotas:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch storage quotas' });
  }
});

router.post('/storage-quotas', async (req, res) => {
  try {
    const { quotaType, targetId, maxStorageBytes, maxArtifacts } = req.body;

    if (!quotaType || !maxStorageBytes) {
      return res.status(400).json({
        success: false,
        message: 'Quota type and max storage bytes are required'
      });
    }

    const quota = await policyService.createStorageQuota({
      quotaType,
      targetId: targetId || null,
      maxStorageBytes,
      maxArtifacts: maxArtifacts || null,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, quota });
  } catch (error) {
    console.error('Error creating storage quota:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ success: false, message: 'Quota already exists for this target' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create storage quota' });
    }
  }
});

router.put('/storage-quotas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const quota = await policyService.updateStorageQuota(id, updates);
    if (!quota) {
      return res.status(404).json({ success: false, message: 'Quota not found' });
    }

    res.json({ success: true, quota });
  } catch (error) {
    console.error('Error updating storage quota:', error);
    res.status(500).json({ success: false, message: 'Failed to update storage quota' });
  }
});

router.delete('/storage-quotas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await policyService.deleteStorageQuota(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Quota not found' });
    }

    res.json({ success: true, message: 'Quota deleted successfully' });
  } catch (error) {
    console.error('Error deleting storage quota:', error);
    res.status(500).json({ success: false, message: 'Failed to delete storage quota' });
  }
});

// Storage Analytics and Dashboard
router.get('/storage-analytics', async (req, res) => {
  try {
    const analytics = await policyService.getStorageAnalytics();
    res.json({ success: true, analytics });
  } catch (error) {
    console.error('Error fetching storage analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch storage analytics' });
  }
});

// User Storage Stats (for individual user lookup)
router.get('/users/:userId/storage', async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await policyService.getUserStorageStats(userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching user storage stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user storage stats' });
  }
});

// Get all researchers for quota assignment
/**
 * GET /api/admin/researchers - Get all researchers with detailed information
 */
router.get('/researchers', async (req, res) => {
  try {
    const pool = require('../config/database');

    // Get all researchers with counts
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at,
        u.suspended_until,
        COUNT(DISTINCT s.id) as owned_studies_count,
        COUNT(DISTINCT a.id) as artifacts_count
      FROM users u
      LEFT JOIN studies s ON u.id = s.created_by
      LEFT JOIN artifacts a ON u.id = a.uploaded_by
      WHERE u.role = 'researcher'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, researchers: result.rows });
  } catch (error) {
    console.error('Error fetching researchers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch researchers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/researchers/:id - Get detailed info for a specific researcher
 */
router.get('/researchers/:id', async (req, res) => {
  try {
    const pool = require('../config/database');
    const userId = parseInt(req.params.id);

    // Get user basic info
    const userResult = await pool.query(`
      SELECT 
        id, username, first_name, last_name, email, created_at, role
      FROM users 
      WHERE id = $1 AND role = 'researcher'
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Researcher not found' });
    }

    const user = userResult.rows[0];

    // Get owned studies
    const studiesResult = await pool.query(`
      SELECT 
        s.id, s.title, s.status, s.created_at,
        COUNT(DISTINCT et.id) as task_count,
        COUNT(DISTINCT sp.participant_id) as enrolled_count
      FROM studies s
      LEFT JOIN evaluation_tasks et ON s.id = et.study_id
      LEFT JOIN study_participants sp ON s.id = sp.study_id
      WHERE s.created_by = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [userId]);

    // Get artifacts
    const artifactsResult = await pool.query(`
      SELECT id, name, type, created_at
      FROM artifacts
      WHERE uploaded_by = $1
      ORDER BY created_at DESC
    `, [userId]);

    res.json({
      success: true,
      user: {
        ...user,
        owned_studies: studiesResult.rows,
        artifacts: artifactsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching researcher details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch researcher details'
    });
  }
});

/**
 * GET /api/admin/participants - Get all participants with detailed information
 */
router.get('/participants', async (req, res) => {
  try {
    const pool = require('../config/database');

    // Get all participants with counts
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at,
        u.suspended_until,
        COUNT(DISTINCT sp.study_id) as assigned_studies_count,
        COUNT(DISTINCT e.id) as completed_evaluations_count
      FROM users u
      LEFT JOIN study_participants sp ON u.id = sp.participant_id
      LEFT JOIN evaluations e ON u.id = e.participant_id
      WHERE u.role = 'participant'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, participants: result.rows });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participants'
    });
  }
});

/**
 * GET /api/admin/participants/:id - Get detailed info for a specific participant
 */
router.get('/participants/:id', async (req, res) => {
  try {
    const pool = require('../config/database');
    const userId = parseInt(req.params.id);

    // Get user basic info
    const userResult = await pool.query(`
      SELECT 
        id, username, first_name, last_name, email, created_at, role
      FROM users 
      WHERE id = $1 AND role = 'participant'
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    const user = userResult.rows[0];

    // Get assigned studies with task completion info
    const studiesResult = await pool.query(`
      SELECT 
        s.id, s.title, s.status, sp.enrolled_at,
        COUNT(DISTINCT et.id) as total_tasks,
        COUNT(DISTINCT e.id) as completed_tasks
      FROM study_participants sp
      JOIN studies s ON sp.study_id = s.id
      LEFT JOIN evaluation_tasks et ON s.id = et.study_id
      LEFT JOIN evaluations e ON et.id = e.task_id AND e.participant_id = sp.participant_id
      WHERE sp.participant_id = $1
      GROUP BY s.id, sp.enrolled_at
      ORDER BY sp.enrolled_at DESC
    `, [userId]);

    res.json({
      success: true,
      user: {
        ...user,
        assigned_studies: studiesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching participant details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participant details'
    });
  }
});

// Retention Policy Management (US 2.8)
router.get('/retention-policies', async (req, res) => {
  try {
    const policies = await retentionService.getRetentionPolicies();
    res.json({ success: true, policies });
  } catch (error) {
    console.error('Error fetching retention policies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch retention policies' });
  }
});

router.post('/retention-policies', async (req, res) => {
  try {
    const { policyName, policyType, targetId, targetArtifactType, retentionDays, autoDelete } = req.body;

    if (!policyName || !policyType || !retentionDays) {
      return res.status(400).json({
        success: false,
        message: 'Policy name, type, and retention days are required'
      });
    }

    const policy = await retentionService.createRetentionPolicy({
      policyName,
      policyType,
      targetId: targetId || null,
      targetArtifactType: targetArtifactType || null,
      retentionDays,
      autoDelete: autoDelete !== false, // Default to true
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, policy });
  } catch (error) {
    console.error('Error creating retention policy:', error);
    res.status(500).json({ success: false, message: 'Failed to create retention policy' });
  }
});

router.put('/retention-policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const policy = await retentionService.updateRetentionPolicy(id, updates);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    res.json({ success: true, policy });
  } catch (error) {
    console.error('Error updating retention policy:', error);
    res.status(500).json({ success: false, message: 'Failed to update retention policy' });
  }
});

router.delete('/retention-policies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await retentionService.deleteRetentionPolicy(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }

    res.json({ success: true, message: 'Policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting retention policy:', error);
    res.status(500).json({ success: false, message: 'Failed to delete retention policy' });
  }
});

// Deleted Artifacts Management
router.get('/deleted-artifacts', async (req, res) => {
  try {
    const { userId, includeRestored, limit, offset } = req.query;
    const options = {
      userId: userId ? parseInt(userId) : undefined,
      includeRestored: includeRestored === 'true',
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    };

    const deletedArtifacts = await retentionService.getDeletedArtifacts(options);
    res.json({ success: true, deletedArtifacts });
  } catch (error) {
    console.error('Error fetching deleted artifacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch deleted artifacts' });
  }
});

router.post('/deleted-artifacts/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const restoredArtifactId = await retentionService.restoreArtifact(parseInt(id), req.user.id);

    res.json({
      success: true,
      message: 'Artifact restored successfully',
      restoredArtifactId
    });
  } catch (error) {
    console.error('Error restoring artifact:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to restore artifact' });
  }
});

router.delete('/deleted-artifacts/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    await retentionService.permanentlyDeleteArtifact(parseInt(id), req.user.id);

    res.json({
      success: true,
      message: 'Artifact permanently deleted successfully'
    });
  } catch (error) {
    console.error('Error permanently deleting artifact:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to permanently delete artifact' });
  }
});

// Cleanup Operations
router.post('/cleanup/run-retention', async (req, res) => {
  try {
    const result = await retentionService.runRetentionCleanup();

    res.json({
      success: true,
      message: 'Retention cleanup completed',
      result
    });
  } catch (error) {
    console.error('Error running retention cleanup:', error);
    res.status(500).json({ success: false, message: 'Failed to run retention cleanup' });
  }
});

// Retention Statistics and Audit
router.get('/retention-stats', async (req, res) => {
  try {
    const stats = await retentionService.getRetentionStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching retention stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch retention stats' });
  }
});

router.get('/retention-audit', async (req, res) => {
  try {
    const { artifactId, operation, limit, offset } = req.query;
    const options = {
      artifactId: artifactId ? parseInt(artifactId) : undefined,
      operation,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    };

    const auditLog = await retentionService.getAuditLog(options);
    res.json({ success: true, auditLog });
  } catch (error) {
    console.error('Error fetching retention audit log:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audit log' });
  }
});

// ====================
// API Key Management Routes (US 2.9)
// ====================

/**
 * POST /api/admin/api-keys
 * Generate a new API key for external tool integration
 */
router.post('/api-keys', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'API key name is required'
      });
    }

    const crypto = require('crypto');

    // Generate a random API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 8);

    // Store the hashed key in database
    const result = await pool.query(
      `INSERT INTO api_keys (key_hash, key_prefix, name, description, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, description, key_prefix, created_at`,
      [keyHash, keyPrefix, name, description || null, req.user.id]
    );

    const apiKeyRecord = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      apiKey: apiKey, // Return the plain key ONLY on creation - it won't be shown again
      keyInfo: {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        description: apiKeyRecord.description,
        keyPrefix: apiKeyRecord.key_prefix,
        createdAt: apiKeyRecord.created_at
      },
      warning: 'Store this API key securely. It will not be shown again.'
    });

  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create API key'
    });
  }
});

/**
 * GET /api/admin/api-keys
 * List all API keys (without revealing the actual keys)
 */
router.get('/api-keys', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ak.id,
        ak.key_prefix,
        ak.name,
        ak.description,
        ak.is_active,
        ak.last_used_at,
        ak.created_at,
        ak.revoked_at,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM api_keys ak
       LEFT JOIN users u ON ak.created_by = u.id
       ORDER BY ak.created_at DESC`
    );

    const apiKeys = result.rows.map(row => ({
      id: row.id,
      keyPrefix: row.key_prefix + '...',
      name: row.name,
      description: row.description,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
      createdBy: row.created_by_name
    }));

    res.json({
      success: true,
      apiKeys: apiKeys,
      total: apiKeys.length
    });

  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API keys'
    });
  }
});

/**
 * DELETE /api/admin/api-keys/:id
 * Revoke an API key (soft delete)
 */
router.delete('/api-keys/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE api_keys 
       SET is_active = false, revoked_at = NOW(), revoked_by = $1
       WHERE id = $2
       RETURNING id, name`,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully',
      revokedKey: result.rows[0]
    });

  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke API key'
    });
  }
});

/**
 * POST /api/admin/users/:id/suspend - Suspend a user account (admin only)
 * Requires a suspended_until timestamp in the request body
 */
router.post('/users/:id/suspend', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { suspended_until } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!suspended_until) {
      return res.status(400).json({
        success: false,
        message: 'suspended_until timestamp is required'
      });
    }

    // Validate that suspended_until is a valid future date
    const suspendDate = new Date(suspended_until);
    if (isNaN(suspendDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for suspended_until'
      });
    }

    if (suspendDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'suspended_until must be a future date'
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, role, first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Prevent suspending other admins
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot suspend admin users'
      });
    }

    // Suspend the user
    const User = require('../models/user');
    const updatedUser = await User.suspend(userId, suspendDate);

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to suspend user'
      });
    }

    res.json({
      success: true,
      message: `User ${user.first_name} ${user.last_name} (${user.email}) has been suspended until ${suspendDate.toISOString()}`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/admin/users/:id/unsuspend - Unsuspend a user account (admin only)
 */
router.post('/users/:id/unsuspend', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, role, first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Unsuspend the user
    const User = require('../models/user');
    const updatedUser = await User.unsuspend(userId);

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to unsuspend user'
      });
    }

    res.json({
      success: true,
      message: `User ${user.first_name} ${user.last_name} (${user.email}) has been unsuspended`,
      user: updatedUser
    });

  } catch (error) {
    console.error('Error unsuspending user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsuspend user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * DELETE /api/admin/users/:id - Delete a user (admin only)
 * Handles foreign key constraints appropriately
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, role, first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Prevent deleting other admins
    if (user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    // Check for dependent data that would prevent deletion
    const dependencies = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM studies WHERE created_by = $1) as owned_studies,
        (SELECT COUNT(*) FROM artifacts WHERE uploaded_by = $1) as uploaded_artifacts,
        (SELECT COUNT(*) FROM artifact_sets WHERE created_by = $1) as created_artifact_sets
    `, [userId]);

    const deps = dependencies.rows[0];

    // If user has created studies or uploaded artifacts, we need to handle these references
    // We'll cancel their studies and set other references to NULL
    if (deps.owned_studies > 0 || deps.uploaded_artifacts > 0 || deps.created_artifact_sets > 0) {
      // Start a transaction to handle all updates atomically
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Cancel all active/draft studies owned by this user
        if (deps.owned_studies > 0) {
          await client.query(`
            UPDATE studies
            SET status = 'cancelled',
                cancelled_by = $2,
                cancelled_at = NOW(),
                cancellation_reason = 'Researcher account deleted by administrator'
            WHERE created_by = $1 AND status IN ('draft', 'active')
          `, [userId, req.user.id]);

          // Transfer ownership of all studies to the admin
          await client.query('UPDATE studies SET created_by = $2 WHERE created_by = $1', [userId, req.user.id]);
        }

        // Clear cancelled_by references to this user (for any studies they cancelled)
        await client.query('UPDATE studies SET cancelled_by = NULL WHERE cancelled_by = $1', [userId]);

        // Update artifacts to set uploaded_by to NULL
        if (deps.uploaded_artifacts > 0) {
          await client.query('UPDATE artifacts SET uploaded_by = NULL WHERE uploaded_by = $1', [userId]);
        }

        // Update artifact_sets to set created_by to NULL
        if (deps.created_artifact_sets > 0) {
          await client.query('UPDATE artifact_sets SET created_by = NULL WHERE created_by = $1', [userId]);
        }

        // Clear other foreign key references to this user
        await client.query('UPDATE quizzes SET created_by = NULL WHERE created_by = $1', [userId]);
        await client.query('UPDATE quiz_attempts SET graded_by = NULL WHERE graded_by = $1', [userId]);
        await client.query('UPDATE study_state_transitions SET changed_by = NULL WHERE changed_by = $1', [userId]);
        await client.query('UPDATE evaluations SET participant_id = NULL WHERE participant_id = $1', [userId]);
        await client.query('UPDATE competency_assessments SET participant_id = NULL WHERE participant_id = $1', [userId]);
        await client.query('UPDATE artifact_metadata_versions SET edited_by = NULL WHERE edited_by = $1', [userId]);

        // Clear admin policy table references
        await client.query('UPDATE admin_file_policies SET created_by = NULL WHERE created_by = $1', [userId]);
        await client.query('UPDATE storage_quotas SET created_by = NULL WHERE created_by = $1', [userId]);

        // Clear retention policy references
        await client.query('UPDATE retention_policies SET created_by = NULL WHERE created_by = $1', [userId]);
        await client.query('UPDATE deleted_artifacts SET deleted_by = NULL WHERE deleted_by = $1', [userId]);
        await client.query('UPDATE deleted_artifacts SET restored_by = NULL WHERE restored_by = $1', [userId]);
        await client.query('UPDATE retention_audit_log SET user_id = NULL WHERE user_id = $1', [userId]);
        await client.query('UPDATE artifacts SET deleted_by = NULL WHERE deleted_by = $1', [userId]);

        // Note: api_keys table may not exist in all environments, skip if it doesn't exist

        // Delete the user (CASCADE will handle related tables)
        await client.query('DELETE FROM users WHERE id = $1', [userId]);

        await client.query('COMMIT');

        res.json({
          success: true,
          message: `User ${user.first_name} ${user.last_name} (${user.email}) has been deleted successfully`,
          note: deps.owned_studies > 0 ?
            `Ownership of ${deps.owned_studies} studies transferred to you. Active and draft studies have been cancelled. Associated artifacts and artifact sets have been updated to remove the user reference.` :
            'Associated artifacts and artifact sets have been updated to remove the user reference'
        });

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Simple deletion - no dependencies to handle
      const deleteResult = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

      if (deleteResult.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: `User ${user.first_name} ${user.last_name} (${user.email}) has been deleted successfully`
      });
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/admin/studies/:id/restore - Admin restore study from trash
 */
router.post('/studies/:id/restore', async (req, res) => {
  try {
    const Study = require('../models/study');
    const restoredStudy = await Study.restore(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Study restored from trash bin successfully',
      study: restoredStudy
    });

  } catch (error) {
    console.error('Error restoring study:', error);

    if (error.message.includes('not deleted') || error.message.includes('not found') || error.message.includes('previous status')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to restore study'
    });
  }
});

/**
 * DELETE /api/admin/studies/:id/permanent - Admin permanently delete study
 */
router.delete('/studies/:id/permanent', async (req, res) => {
  try {
    const Study = require('../models/study');
    const deleted = await Study.permanentDelete(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to permanently delete study'
      });
    }

    res.json({
      success: true,
      message: 'Study permanently deleted successfully'
    });

  } catch (error) {
    console.error('Error permanently deleting study:', error);

    if (error.message.includes('trash bin')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete study'
    });
  }
});

/**
 * POST /api/admin/studies/cleanup - Run manual cleanup of expired deleted studies
 */
router.post('/studies/cleanup', async (req, res) => {
  try {
    const { retentionDays = 20 } = req.body;
    const Study = require('../models/study');
    
    const results = await Study.runCleanup(retentionDays);

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      results: {
        processed: results.processed,
        deleted: results.deleted,
        errors: results.errors.length,
        errorDetails: results.errors
      }
    });

  } catch (error) {
    console.error('Error running cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run cleanup',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/studies/trash/stats - Get trash bin statistics
 */
router.get('/studies/trash/stats', async (req, res) => {
  try {
    const Study = require('../models/study');
    
    // Get all deleted studies
    const deletedStudies = await Study.findDeleted();
    
    // Get studies expiring soon (within 5 days)
    const expiringSoon = deletedStudies.filter(study => study.days_in_trash >= 15);
    
    // Get expired studies
    const expired = await Study.findExpiredDeleted(20);

    const stats = {
      total_in_trash: deletedStudies.length,
      expiring_soon: expiringSoon.length,
      expired: expired.length,
      by_days: {
        '0-5': deletedStudies.filter(s => s.days_in_trash <= 5).length,
        '6-10': deletedStudies.filter(s => s.days_in_trash > 5 && s.days_in_trash <= 10).length,
        '11-15': deletedStudies.filter(s => s.days_in_trash > 10 && s.days_in_trash <= 15).length,
        '16-20': deletedStudies.filter(s => s.days_in_trash > 15 && s.days_in_trash <= 20).length,
        'over_20': deletedStudies.filter(s => s.days_in_trash > 20).length
      }
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching trash stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trash statistics'
    });
  }
});

// GET /api/admin/participants/:participantId/studies/:studyId/evaluations - Get a specific participant's evaluations for a study
router.get('/participants/:participantId/studies/:studyId/evaluations', async (req, res) => {
  try {
    const participantId = parseInt(req.params.participantId, 10);
    const studyId = parseInt(req.params.studyId, 10);

    // Get study details
    const studyQ = await pool.query(
      `SELECT s.id, s.title, u.id as researcher_id, u.first_name as researcher_first_name, 
              u.last_name as researcher_last_name, u.email as researcher_email
       FROM studies s
       JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [studyId]
    );

    if (studyQ.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }

    const study = studyQ.rows[0];

    // Get participant details
    const participantQ = await pool.query(
      `SELECT id, first_name, last_name, email FROM users WHERE id = $1`,
      [participantId]
    );

    const participant = participantQ.rows[0];

    // Get all tasks for this study
    const tasksQ = await pool.query(
      `SELECT id, task_type, instructions, answer_type, answer_options, 
              artifact1_id, artifact2_id, artifact3_id
       FROM evaluation_tasks
       WHERE study_id = $1
       ORDER BY created_at`,
      [studyId]
    );

    if (tasksQ.rows.length === 0) {
      return res.json({ tasks: [] });
    }

    // Get all evaluations by this participant for these tasks
    const taskIds = tasksQ.rows.map(t => t.id);
    const participantEvalsQ = await pool.query(
      `SELECT e.id, e.task_id, e.ratings, e.annotations, e.comments, e.completed_at
       FROM evaluations e
       WHERE e.task_id = ANY($1::int[]) AND e.participant_id = $2`,
      [taskIds, participantId]
    );

    // Build tasks array with artifacts and evaluation data
    const tasks = await Promise.all(tasksQ.rows.map(async (task) => {
      // Find the evaluation for this task
      const evaluation = participantEvalsQ.rows.find(e => e.task_id === task.id);

      // Fetch artifacts
      let artifact1 = null, artifact2 = null, artifact3 = null;
      
      if (task.artifact1_id) {
        const a1Q = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = $1', [task.artifact1_id]);
        artifact1 = a1Q.rows[0] || null;
      }
      if (task.artifact2_id) {
        const a2Q = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = $1', [task.artifact2_id]);
        artifact2 = a2Q.rows[0] || null;
      }
      if (task.artifact3_id) {
        const a3Q = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = $1', [task.artifact3_id]);
        artifact3 = a3Q.rows[0] || null;
      }

      return {
        taskId: task.id,
        taskType: task.task_type,
        instructions: task.instructions,
        answerType: task.answer_type,
        answerOptions: task.answer_options,
        artifact1,
        artifact2,
        artifact3,
        ratings: evaluation?.ratings || [],
        choice: evaluation?.annotations?.choice || null,
        text: evaluation?.annotations?.text || null,
        annotations: evaluation?.annotations || {},
        comments: evaluation?.comments || '',
        completed_at: evaluation?.completed_at
      };
    }));

    // Return in the same format as flagged-evaluations endpoint
    res.json({
      study_id: study.id,
      study_title: study.title,
      researcher_id: study.researcher_id,
      researcher_first_name: study.researcher_first_name,
      researcher_last_name: study.researcher_last_name,
      researcher_email: study.researcher_email,
      participant_id: participantId,
      participant_first_name: participant.first_name,
      participant_last_name: participant.last_name,
      participant_email: participant.email,
      tasks: tasks,
      completedAt: tasks[0]?.completed_at
    });

  } catch (err) {
    console.error('[Admin Get Participant Evaluations] Error:', err);
    res.status(500).json({ error: 'Failed to fetch participant evaluations' });
  }
});

module.exports = router;
