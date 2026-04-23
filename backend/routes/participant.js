const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');
const { imageUpload } = require('../config/upload');
const path = require('path');
const fs = require('fs');
const Study = require('../models/study');
const Artifact = require('../models/artifact');

// All participant endpoints require authentication and participant role (or admin)
router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== 'participant' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: participants only' });
  }
  next();
});

/**
 * Helper function to check study completion and update status/send notifications
 * Called after a participant completes an evaluation or task
 */
async function checkAndUpdateStudyCompletion(studyId, client = null) {
  const shouldReleaseClient = !client;
  if (!client) {
    client = await pool.connect();
  }

  try {
    // Get total tasks for study
    const tasksQ = await client.query(
      'SELECT COUNT(*)::int AS total FROM evaluation_tasks WHERE study_id = $1',
      [studyId]
    );
    const totalTasks = tasksQ.rows[0]?.total || 0;

    if (totalTasks === 0) {
      if (shouldReleaseClient) client.release();
      return;
    }

    // Get enrolled participants count
    const enrolledQ = await client.query(
      'SELECT COUNT(*)::int AS enrolled FROM study_participants WHERE study_id = $1',
      [studyId]
    );
    const enrolledCount = enrolledQ.rows[0]?.enrolled || 0;

    if (enrolledCount === 0) {
      if (shouldReleaseClient) client.release();
      return;
    }

    // Get participants who have completed all tasks (exclude deleted evaluations)
    const completedParticipantsQ = await client.query(
      `SELECT ev.participant_id, COUNT(DISTINCT ev.task_id)::int AS completed_tasks
       FROM evaluations ev
       JOIN evaluation_tasks et ON ev.task_id = et.id
       WHERE et.study_id = $1
       AND ev.deleted_at IS NULL
       GROUP BY ev.participant_id
       HAVING COUNT(DISTINCT ev.task_id) = $2`,
      [studyId, totalTasks]
    );
    const completedCount = completedParticipantsQ.rows.length;

    // Calculate completion percentage
    const completionPercentage = Math.round((completedCount / enrolledCount) * 100);

    // Get study details
    const studyQ = await client.query(
      'SELECT id, title, created_by, status FROM studies WHERE id = $1',
      [studyId]
    );
    const study = studyQ.rows[0];

    if (!study) {
      if (shouldReleaseClient) client.release();
      return;
    }

    // Check for milestone notifications (50% and 100%)
    // We'll track which milestones have been sent using a simple check
    // First, check if we've already sent these notifications
    const existingNotificationsQ = await client.query(
      `SELECT title FROM notifications 
       WHERE user_id = $1 
       AND link LIKE $2 
       AND (title LIKE '%50% complete%' OR title LIKE '%complete!')`,
      [study.created_by, `%/researcher/studies/${studyId}%`]
    );

    const has50Notification = existingNotificationsQ.rows.some(n => n.title.includes('50%'));
    const has100Notification = existingNotificationsQ.rows.some(n => n.title.includes('complete!'));

    // Send 50% notification
    if (completionPercentage >= 50 && !has50Notification) {
      await client.query(
        `INSERT INTO notifications (user_id, title, body, link, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          study.created_by,
          `Study "${study.title}" is 50% complete`,
          `Your study "${study.title}" has reached 50% completion.`,
          `/researcher/studies/${studyId}`
        ]
      );
    }

    // Send 100% notification and update status
    if (completionPercentage >= 100 && !has100Notification) {
      // Update study status to 'completed'
      if (study.status === 'active') {
        await client.query(
          'UPDATE studies SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', studyId]
        );
      }

      // Send completion notification
      await client.query(
        `INSERT INTO notifications (user_id, title, body, link, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [
          study.created_by,
          `Study "${study.title}" is complete!`,
          `All participants have completed your study "${study.title}".`,
          `/researcher/studies/${studyId}`
        ]
      );
    }

    if (shouldReleaseClient) {
      client.release();
    }
  } catch (err) {
    console.error('[checkAndUpdateStudyCompletion] Error:', err);
    if (shouldReleaseClient) {
      client.release();
    }
    // Don't throw - we don't want to fail the main request if notifications fail
  }
}

// GET /api/participant/notifications
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const q = `SELECT id, title, body, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`;
    const { rows } = await pool.query(q, [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PATCH /api/participant/notifications/:id/read
router.patch('/notifications/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    const q = `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id, is_read`;
    const { rows } = await pool.query(q, [id, userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// PATCH /api/participant/notifications/:id/unread
router.patch('/notifications/:id/unread', async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    const q = `UPDATE notifications SET is_read = false WHERE id = $1 AND user_id = $2 RETURNING id, is_read`;
    const { rows } = await pool.query(q, [id, userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification unread' });
  }
});

// Helper: compute study status based on dates
function computeStatus(study) {
  const now = new Date();
  if (study.start_date && study.end_date) {
    const start = new Date(study.start_date);
    const end = new Date(study.end_date);
    if (end < now) return 'past';
    if (start > now) return 'upcoming';
    return 'ongoing';
  }
  // fallback to DB status
  if (study.status === 'completed') return 'past';
  if (study.status === 'active') return 'ongoing';
  return study.status || 'unknown';
}

// GET /api/participant/studies?search=&status=&start=&end=
router.get('/studies', async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, status, start, end } = req.query;

    // Check if start_date and end_date columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'studies' AND column_name IN ('start_date', 'end_date')
    `);
    const hasStartDate = columnsCheck.rows.some(r => r.column_name === 'start_date');
    const hasEndDate = columnsCheck.rows.some(r => r.column_name === 'end_date');

    // base query: studies the participant is enrolled in, excluding completed studies
    // A study is completed when: it has tasks AND all tasks have evaluations (not deleted)
    let q = `SELECT s.id, s.title, s.description, s.status, s.deadline`;
    if (hasStartDate) q += `, s.start_date`;
    if (hasEndDate) q += `, s.end_date`;
    q += ` FROM studies s
             JOIN study_participants sp ON sp.study_id = s.id
             WHERE sp.participant_id = $1
             AND NOT EXISTS (
               -- Exclude studies where all tasks are completed (same logic as completed studies endpoint)
               SELECT 1
               FROM evaluation_tasks et
               LEFT JOIN evaluations e ON e.task_id = et.id 
                 AND e.participant_id = $1 
                 AND e.deleted_at IS NULL
               WHERE et.study_id = s.id
               GROUP BY et.study_id
               HAVING COUNT(DISTINCT et.id) > 0 
                 AND COUNT(DISTINCT et.id) = COUNT(DISTINCT e.id)
             )`;
    const params = [userId];

    if (search) {
      params.push(`%${search}%`);
      q += ` AND s.title ILIKE $${params.length}`;
    }

    if (status) {
      params.push(status);
      q += ` AND s.status = $${params.length}`;
    }

    if (start && hasStartDate) {
      params.push(start);
      q += ` AND (s.start_date IS NULL OR s.start_date >= $${params.length})`;
    }
    if (end && hasEndDate) {
      params.push(end);
      q += ` AND (s.end_date IS NULL OR s.end_date <= $${params.length})`;
    }

    if (hasStartDate) {
      q += ' ORDER BY s.start_date NULLS LAST, s.created_at DESC';
    } else {
      q += ' ORDER BY s.created_at DESC';
    }

    const { rows } = await pool.query(q, params);

    // For each study, compute simple metrics: total tasks, completed, pending, time spent
    const out = await Promise.all(rows.map(async (s) => {
      const totalsQ = `SELECT
        COUNT(DISTINCT et.id) AS total_tasks,
        COUNT(DISTINCT et.id) FILTER (WHERE e.id IS NOT NULL OR tp.status = 'completed') AS completed_tasks,
        COALESCE(SUM(tp.time_spent_seconds),0)::int AS time_spent_seconds
        FROM evaluation_tasks et
        LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = $2
        LEFT JOIN evaluations e ON e.task_id = et.id AND e.participant_id = $2
        WHERE et.study_id = $1`;
      const r = await pool.query(totalsQ, [s.id, userId]);
      const t = r.rows[0];
      console.log(`[Participant Studies] Study ${s.id} totals -> total_tasks=${t.total_tasks}, completed_tasks=${t.completed_tasks}, time_spent_seconds=${t.time_spent_seconds}`);
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        status: computeStatus(s),
        deadline: s.deadline || null,
        start_date: s.start_date || null,
        end_date: s.end_date || null,
        total_tasks: parseInt(t.total_tasks || 0, 10),
        completed_tasks: parseInt(t.completed_tasks || 0, 10),
        pending_tasks: Math.max(0, parseInt(t.total_tasks || 0, 10) - parseInt(t.completed_tasks || 0, 10)),
        time_spent_seconds: parseInt(t.time_spent_seconds || 0, 10),
      };
    }));

    console.log(`[Participant Studies] User ${userId} - Found ${out.length} studies`);
    res.json(out);
  } catch (err) {
    console.error('[Participant Studies] Error:', err);
    res.status(500).json({ error: 'Failed to fetch studies', details: err.message });
  }
});

// GET /api/participant/studies/:id/draft -> get draft evaluation for a study (must come before /studies/:id)
router.get('/studies/:id/draft', async (req, res) => {
  try {
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);

    // Verify participant is enrolled (skip for admin)
    if (req.user.role !== 'admin') {
      const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
      if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });
    }

    // Get draft evaluation (table might not exist yet)
    let draftQ;
    try {
      draftQ = await pool.query(
        'SELECT id, task_answers, created_at, updated_at FROM draft_evaluations WHERE study_id = $1 AND participant_id = $2',
        [studyId, userId]
      );
    } catch (tableError) {
      // Table doesn't exist yet - return empty draft
      return res.json({
        study_id: studyId,
        task_answers: {},
        created_at: null,
        updated_at: null
      });
    }

    if (draftQ.rowCount === 0) {
      // Return empty draft
      return res.json({
        study_id: studyId,
        task_answers: {},
        created_at: null,
        updated_at: null
      });
    }

    res.json({
      study_id: studyId,
      task_answers: draftQ.rows[0].task_answers || {},
      created_at: draftQ.rows[0].created_at,
      updated_at: draftQ.rows[0].updated_at
    });
  } catch (err) {
    console.error('[GET /studies/:id/draft] Error:', err);
    res.status(500).json({ error: 'Failed to fetch draft evaluation' });
  }
});

// Helper function to check if task data has any meaningful content
const hasTaskData = (taskData) => {
  if (!taskData || typeof taskData !== 'object') return false;
  
  // Check ratings
  const hasRatings = taskData.ratings && typeof taskData.ratings === 'object' && 
    Object.values(taskData.ratings).some(r => r && (typeof r === 'number' ? r > 0 : r.toString().trim()));
  
  // Check choice
  const hasChoice = taskData.choice && taskData.choice.toString().trim();
  
  // Check text
  const hasText = taskData.text && taskData.text.toString().trim();
  
  // Check comments
  const hasComments = taskData.comments && taskData.comments.toString().trim();
  
  // Check highlights
  const hasHighlights = taskData.highlights && Array.isArray(taskData.highlights) && taskData.highlights.length > 0;
  
  // Check screenshots
  const hasScreenshots = taskData.screenshots && Array.isArray(taskData.screenshots) && taskData.screenshots.length > 0;
  
  // Check artifact highlights
  const hasArtifactHighlights = taskData.artifactHighlights && typeof taskData.artifactHighlights === 'object' && (
    (taskData.artifactHighlights.artifact1 && Array.isArray(taskData.artifactHighlights.artifact1) && taskData.artifactHighlights.artifact1.length > 0) ||
    (taskData.artifactHighlights.artifact2 && Array.isArray(taskData.artifactHighlights.artifact2) && taskData.artifactHighlights.artifact2.length > 0) ||
    (taskData.artifactHighlights.artifact3 && Array.isArray(taskData.artifactHighlights.artifact3) && taskData.artifactHighlights.artifact3.length > 0)
  );
  
  // Check annotations
  const hasAnnotations = taskData.annotations && typeof taskData.annotations === 'object' && Object.keys(taskData.annotations).length > 0;
  
  return hasRatings || hasChoice || hasText || hasComments || hasHighlights || hasScreenshots || hasArtifactHighlights || hasAnnotations;
};

// Helper function to check if a task has all required fields completed
const isTaskComplete = (task, taskData) => {
  if (!task || !taskData || typeof taskData !== 'object') return false;
  
  const answerType = task.answer_type || 'rating';
  
  if (answerType === 'rating' || answerType === 'rating_required_comments') {
    // For rating tasks, check if all artifacts have ratings
    const hasRating1 = task.artifact1_id ? (taskData.ratings?.artifact1 && taskData.ratings.artifact1 > 0) : true;
    const hasRating2 = task.artifact2_id ? (taskData.ratings?.artifact2 && taskData.ratings.artifact2 > 0) : true;
    const hasRating3 = task.artifact3_id ? (taskData.ratings?.artifact3 && taskData.ratings.artifact3 > 0) : true;
    const hasComments = answerType === 'rating_required_comments' ? (taskData.comments && taskData.comments.toString().trim()) : true;
    
    return hasRating1 && hasRating2 && hasRating3 && hasComments;
  } else if (answerType === 'choice' || answerType === 'choice_required_text') {
    // For choice tasks, check if choice is selected and text if required
    const hasChoice = taskData.choice && taskData.choice.toString().trim();
    const hasText = answerType === 'choice_required_text' ? (taskData.text && taskData.text.toString().trim()) : true;
    
    return hasChoice && hasText;
  } else if (answerType === 'text_required') {
    // For text tasks, check if text is provided
    return taskData.text && taskData.text.toString().trim();
  }
  
  // Default: consider incomplete if we don't recognize the answer type
  return false;
};

// POST /api/participant/studies/:id/draft -> save or update draft evaluation (must come before /studies/:id)
router.post('/studies/:id/draft', async (req, res) => {
  try {
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);
    const { task_answers } = req.body;

    // Verify participant is enrolled
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Validate task_answers
    if (!task_answers || typeof task_answers !== 'object') {
      return res.status(400).json({ error: 'task_answers must be an object' });
    }

    // Upsert draft evaluation (table might not exist yet)
    let result;
    try {
      const upsert = `
        INSERT INTO draft_evaluations (study_id, participant_id, task_answers, updated_at)
        VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (study_id, participant_id)
        DO UPDATE SET 
          task_answers = $3::jsonb,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, task_answers, created_at, updated_at
      `;

      result = await pool.query(upsert, [studyId, userId, JSON.stringify(task_answers)]);
    } catch (tableError) {
      if (tableError.message.includes('does not exist')) {
        return res.status(503).json({ error: 'Draft evaluations feature is not available yet. Please run database migrations.' });
      }
      throw tableError;
    }

    // Update task_progress status for each task based on completion status
    // Get all tasks for this study with their details (answer_type, artifacts)
    const tasksQ = await pool.query(`
      SELECT id, answer_type, answer_options, artifact1_id, artifact2_id, artifact3_id 
      FROM evaluation_tasks 
      WHERE study_id = $1
    `, [studyId]);
    const tasks = tasksQ.rows;

    // Update status for each task
    for (const task of tasks) {
      const taskId = task.id;
      const taskAnswer = task_answers[taskId.toString()] || task_answers[taskId];
      const hasData = hasTaskData(taskAnswer);
      const isComplete = isTaskComplete(task, taskAnswer);
      
      // Check if progress record exists
      const progressCheck = await pool.query(
        'SELECT id, status FROM task_progress WHERE task_id = $1 AND participant_id = $2',
        [taskId, userId]
      );
      
      // Determine new status
      let newStatus;
      if (isComplete) {
        // Task has all required fields filled - mark as completed
        newStatus = 'completed';
      } else if (hasData) {
        // Task has data but not all required fields - mark as in_progress
        newStatus = 'in_progress';
      } else {
        // Task has no data - mark as pending
        newStatus = 'pending';
      }
      
      // Update or create progress record
      if (progressCheck.rowCount > 0) {
        // Update existing progress record
        // Always update to reflect current completion status (can go from completed back to in_progress if data is removed)
        await pool.query(
          `UPDATE task_progress SET status = $1, updated_at = CURRENT_TIMESTAMP
           WHERE task_id = $2 AND participant_id = $3`,
          [newStatus, taskId, userId]
        );
      } else if (hasData || isComplete) {
        // Create new progress record if there's data or task is complete
        await pool.query(
          `INSERT INTO task_progress (task_id, participant_id, status, started_at, updated_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [taskId, userId, newStatus]
        );
      }
    }

    res.json({
      study_id: studyId,
      task_answers: result.rows[0].task_answers,
      created_at: result.rows[0].created_at,
      updated_at: result.rows[0].updated_at
    });
  } catch (err) {
    console.error('[POST /studies/:id/draft] Error:', err);
    res.status(500).json({ error: 'Failed to save draft evaluation' });
  }
});

// POST /api/participant/studies/:id/draft/complete -> complete draft evaluation (must come before /studies/:id)
router.post('/studies/:id/draft/complete', async (req, res) => {
  try {
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);

    // Verify participant is enrolled
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    // Get draft evaluation (table might not exist yet)
    let draftQ;
    try {
      draftQ = await pool.query(
        'SELECT task_answers FROM draft_evaluations WHERE study_id = $1 AND participant_id = $2',
        [studyId, userId]
      );
    } catch (tableError) {
      if (tableError.message.includes('does not exist')) {
        return res.status(503).json({ error: 'Draft evaluations feature is not available yet. Please run database migrations.' });
      }
      throw tableError;
    }

    if (draftQ.rowCount === 0) {
      return res.status(404).json({ error: 'No draft evaluation found' });
    }

    const taskAnswers = draftQ.rows[0].task_answers || {};

    // Normalize task_answers keys to strings (JSONB stores keys as strings)
    const normalizedTaskAnswers = {};
    for (const key in taskAnswers) {
      const normalizedKey = String(key);
      normalizedTaskAnswers[normalizedKey] = taskAnswers[key];
    }

    // Get all tasks for this study
    const tasksQ = await pool.query(
      'SELECT id FROM evaluation_tasks WHERE study_id = $1',
      [studyId]
    );

    const taskIds = tasksQ.rows.map(r => r.id);

    console.log(`[POST /studies/:id/draft/complete] Processing ${taskIds.length} tasks for study ${studyId}, participant ${userId}`);
    console.log(`[POST /studies/:id/draft/complete] Task IDs:`, taskIds);
    console.log(`[POST /studies/:id/draft/complete] Task answer keys in draft:`, Object.keys(normalizedTaskAnswers));

    // Create final evaluations for each task that has answers
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let evaluationsCreated = 0;
      for (const taskId of taskIds) {
        const taskIdStr = String(taskId);
        const taskAnswer = normalizedTaskAnswers[taskIdStr];
        if (taskAnswer) {
          console.log(`[POST /studies/:id/draft/complete] Processing task ${taskId} with answer data`);
          // Store choice, text, screenshots, and highlights in annotations for later retrieval
          const annotations = {
            ...(taskAnswer.annotations || {}),
            choice: taskAnswer.choice || null,
            text: taskAnswer.text || null,
            screenshots: taskAnswer.screenshots || [],
            highlights: taskAnswer.highlights || [],
            artifactHighlights: taskAnswer.artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
          };

          // Check if evaluation already exists (exclude deleted)
          const existingQ = await client.query(
            'SELECT id FROM evaluations WHERE task_id = $1 AND participant_id = $2 AND deleted_at IS NULL',
            [taskId, userId]
          );

          const cleanedRatings = sanitizeRatings(taskAnswer.ratings || {});

          if (existingQ.rowCount === 0) {
            // Insert new evaluation
            await client.query(
              `INSERT INTO evaluations (task_id, participant_id, ratings, annotations, comments, completed_at)
               VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
              [
                taskId,
                userId,
                JSON.stringify(cleanedRatings),
                JSON.stringify(annotations),
                taskAnswer.comments || taskAnswer.text || ''
              ]
            );
          } else {
            // Update existing evaluation
            await client.query(
              `UPDATE evaluations 
               SET ratings = $3, annotations = $4, comments = $5, completed_at = CURRENT_TIMESTAMP
               WHERE task_id = $1 AND participant_id = $2`,
              [
                taskId,
                userId,
                JSON.stringify(cleanedRatings),
                JSON.stringify(annotations),
                taskAnswer.comments || taskAnswer.text || ''
              ]
            );
          }

          // Update task progress to completed
          // Check if progress record exists first (works regardless of constraint)
          const progressCheck = await client.query(
            'SELECT id FROM task_progress WHERE task_id = $1 AND participant_id = $2',
            [taskId, userId]
          );
          
          if (progressCheck.rowCount === 0) {
            // Insert new progress record
            await client.query(
              `INSERT INTO task_progress (task_id, participant_id, status, updated_at)
               VALUES ($1, $2, 'completed', CURRENT_TIMESTAMP)`,
              [taskId, userId]
            );
          } else {
            // Update existing progress record
            await client.query(
              `UPDATE task_progress SET status = 'completed', updated_at = CURRENT_TIMESTAMP
               WHERE task_id = $1 AND participant_id = $2`,
              [taskId, userId]
            );
          }
          evaluationsCreated++;
          console.log(`[POST /studies/:id/draft/complete] Created/updated evaluation for task ${taskId}`);
        } else {
          console.log(`[POST /studies/:id/draft/complete] No answer data found for task ${taskId} (checked key: "${taskIdStr}")`);
        }
      }

      console.log(`[POST /studies/:id/draft/complete] Created ${evaluationsCreated} evaluations out of ${taskIds.length} tasks`);

      // Delete draft evaluation FIRST (before notifications, so it's deleted even if notifications fail)
      await client.query(
        'DELETE FROM draft_evaluations WHERE study_id = $1 AND participant_id = $2',
        [studyId, userId]
      );
      console.log(`[POST /studies/:id/draft/complete] Deleted draft evaluation for study ${studyId}, participant ${userId}`);

      // Check study completion and update status/notifications
      // This might fail, but draft is already deleted and evaluations are created
      try {
        await checkAndUpdateStudyCompletion(studyId, client);
      } catch (notifError) {
        console.error('[POST /studies/:id/draft/complete] Error in checkAndUpdateStudyCompletion (non-critical):', notifError);
        // Don't throw - draft is already deleted, evaluations are created, transaction should still commit
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[POST /studies/:id/draft/complete] Transaction error:', err);
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, message: 'Evaluation completed successfully' });
  } catch (err) {
    console.error('[POST /studies/:id/draft/complete] Error:', err);
    const errorMessage = err.message || 'Failed to complete evaluation';
    res.status(500).json({ 
      error: 'Failed to complete evaluation',
      details: errorMessage 
    });
  }
});

// Helper to remove placeholder/zero ratings and non-numeric values
function sanitizeRatings(ratings) {
  if (!ratings) return {};

  // If ratings is a stringified JSON, parse it
  if (typeof ratings === 'string') {
    try { ratings = JSON.parse(ratings); } catch { return {}; }
  }

  // Array format: keep only numbers > 0
  if (Array.isArray(ratings)) {
    return ratings
      .map(v => Number(v))
      .filter(v => !isNaN(v) && v > 0);
  }

  // Object format: keep keys whose numeric value > 0
  if (typeof ratings === 'object') {
    const out = {};
    Object.entries(ratings).forEach(([k, v]) => {
      const num = Number(v);
      if (!isNaN(num) && num > 0) {
        out[k] = num;
      }
    });
    return out;
  }

  return {};
}

// GET /api/participant/studies/:id/completed-evaluations -> get completed evaluations for a study (must come before /studies/:id)
router.get('/studies/:id/completed-evaluations', async (req, res) => {
  try {
    // Admin can pass participantId in query string to view as that participant
    let userId = req.user.id;
    if (req.user.role === 'admin' && req.query.participantId) {
      userId = parseInt(req.query.participantId, 10);
    }
    const studyId = parseInt(req.params.id, 10);

    // Verify participant is enrolled (skip for admin)
    if (req.user.role !== 'admin') {
      const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
      if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });
    }

    // Check if answer_type and answer_options columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluation_tasks' AND column_name IN ('answer_type', 'answer_options')
    `);
    const hasAnswerType = columnsCheck.rows.some(r => r.column_name === 'answer_type');
    const hasAnswerOptions = columnsCheck.rows.some(r => r.column_name === 'answer_options');

    // Get all tasks for this study with their evaluations
    let selectColumns = `et.id, et.task_type, et.instructions, et.artifact1_id, et.artifact2_id, et.artifact3_id`;
    if (hasAnswerType) selectColumns += `, et.answer_type`;
    if (hasAnswerOptions) selectColumns += `, et.answer_options`;

    const tasksQ = await pool.query(
      `SELECT ${selectColumns}
       FROM evaluation_tasks et
       WHERE et.study_id = $1
       ORDER BY et.created_at`,
      [studyId]
    );

    const taskIds = tasksQ.rows.map(r => r.id);
    
    if (taskIds.length === 0) {
      return res.json({ evaluations: [] });
    }

    // Get all evaluations for these tasks by this participant (exclude deleted)
    const evaluationsQ = await pool.query(
      `SELECT id, task_id, ratings, annotations, comments, completed_at
       FROM evaluations
       WHERE task_id = ANY($1::int[]) AND participant_id = $2 AND deleted_at IS NULL`,
      [taskIds, userId]
    );

    console.log(`[GET /studies/:id/completed-evaluations] Found ${evaluationsQ.rowCount} evaluations for ${taskIds.length} tasks (study ${studyId}, participant ${userId})`);

    // Create a map of task_id -> evaluation
    const evaluationMap = {};
    evaluationsQ.rows.forEach(evaluation => {
      // Parse JSONB fields if they're strings (backward compatibility)
      let ratings = evaluation.ratings;
      if (typeof ratings === 'string') {
        try {
          ratings = JSON.parse(ratings);
        } catch (e) {
          ratings = {};
        }
      }
      
      let annotations = evaluation.annotations;
      if (typeof annotations === 'string') {
        try {
          annotations = JSON.parse(annotations);
        } catch (e) {
          annotations = {};
        }
      }
      
      evaluationMap[evaluation.task_id] = {
        id: evaluation.id,
        ratings: ratings || {},
        annotations: annotations || {},
        comments: evaluation.comments || '',
        completed_at: evaluation.completed_at
      };
    });

    // Get all artifact IDs
    const artifactIds = [];
    tasksQ.rows.forEach(task => {
      if (task.artifact1_id) artifactIds.push(task.artifact1_id);
      if (task.artifact2_id) artifactIds.push(task.artifact2_id);
      if (task.artifact3_id) artifactIds.push(task.artifact3_id);
    });

    // Get all artifacts
    let artifacts = [];
    if (artifactIds.length > 0) {
      const artifactsQ = await pool.query(
        `SELECT id, name, type, content, metadata FROM artifacts WHERE id = ANY($1::int[])`,
        [artifactIds]
      );
      artifacts = artifactsQ.rows;
    }

    // Build artifact map
    const artifactMap = {};
    artifacts.forEach(art => {
      artifactMap[art.id] = art;
    });

    // Fetch evaluation tags for all tasks (table might not exist yet)
    let tagsMap = {};
    try {
      const tagsQ = await pool.query(
        `SELECT task_id, artifact_id, tag 
         FROM evaluation_artifact_tags 
         WHERE task_id = ANY($1::int[]) AND participant_id = $2
         ORDER BY task_id, artifact_id, tag`,
        [taskIds, userId]
      );

      // Build tags map: { taskId: { artifactId: [tags] } }
      tagsQ.rows.forEach(row => {
        if (!tagsMap[row.task_id]) {
          tagsMap[row.task_id] = {};
        }
        if (!tagsMap[row.task_id][row.artifact_id]) {
          tagsMap[row.task_id][row.artifact_id] = [];
        }
        tagsMap[row.task_id][row.artifact_id].push(row.tag);
      });
    } catch (tagsError) {
      // Table might not exist yet - that's okay, just use empty tags map
      if (tagsError.message && tagsError.message.includes('does not exist')) {
        console.log('[GET /studies/:id/completed-evaluations] evaluation_artifact_tags table does not exist yet, skipping tags');
        tagsMap = {};
      } else {
        // Some other error - log it but don't fail the request
        console.error('[GET /studies/:id/completed-evaluations] Error fetching tags:', tagsError);
        tagsMap = {};
      }
    }

    // Build response with tasks and their evaluations
    const evaluations = tasksQ.rows.map(task => {
      const evaluation = evaluationMap[task.id];
      if (!evaluation) return null; // Skip tasks without evaluations

      // Extract choice and text from annotations if available
      const annotations = evaluation.annotations || {};
      const choice = annotations.choice || null;
      const text = annotations.text || null;

      // Get tags for this task
      const taskTags = tagsMap[task.id] || {};
      const artifact1Tags = task.artifact1_id ? (taskTags[task.artifact1_id] || []) : [];
      const artifact2Tags = task.artifact2_id ? (taskTags[task.artifact2_id] || []) : [];
      const artifact3Tags = task.artifact3_id ? (taskTags[task.artifact3_id] || []) : [];

      // Build artifacts with tags
      const artifact1 = task.artifact1_id && artifactMap[task.artifact1_id] 
        ? { ...artifactMap[task.artifact1_id], tags: artifact1Tags } 
        : null;
      const artifact2 = task.artifact2_id && artifactMap[task.artifact2_id] 
        ? { ...artifactMap[task.artifact2_id], tags: artifact2Tags } 
        : null;
      const artifact3 = task.artifact3_id && artifactMap[task.artifact3_id] 
        ? { ...artifactMap[task.artifact3_id], tags: artifact3Tags } 
        : null;

      return {
        task_id: task.id,
        task_type: task.task_type,
        instructions: task.instructions,
        answer_type: task.answer_type || 'rating',
        answer_options: task.answer_options || null,
        artifact1: artifact1,
        artifact2: artifact2,
        artifact3: artifact3,
        evaluation: {
          ratings: evaluation.ratings,
          choice: choice,
          text: text,
          comments: evaluation.comments,
          annotations: annotations,
          completed_at: evaluation.completed_at
        }
      };
    }).filter(e => e !== null); // Remove null entries

    res.json({ evaluations });
  } catch (err) {
    console.error('[GET /studies/:id/completed-evaluations] Error:', err);
    res.status(500).json({ error: 'Failed to fetch completed evaluations' });
  }
});

// ========== COMPLETED STUDIES ENDPOINTS ==========
// NOTE: This route must come before /studies/:id to avoid route conflicts

// GET /api/participant/studies/completed -> get all completed studies for the participant
router.get('/studies/completed', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all studies where participant is enrolled and has completed all tasks
    // Exclude studies that have been deleted (moved to trash) by the participant
    const result = await pool.query(
      `SELECT 
        s.id,
        s.title,
        s.description,
        s.deadline,
        s.start_date,
        s.end_date,
        COUNT(DISTINCT et.id) AS total_tasks,
        COUNT(DISTINCT e.id) AS completed_evaluations,
        MAX(e.completed_at) AS last_completed_at
       FROM studies s
       JOIN study_participants sp ON sp.study_id = s.id
       LEFT JOIN evaluation_tasks et ON et.study_id = s.id
       LEFT JOIN evaluations e ON e.task_id = et.id AND e.participant_id = $1 AND e.deleted_at IS NULL
       WHERE sp.participant_id = $1
       AND sp.deleted_at IS NULL
       GROUP BY s.id, s.title, s.description, s.deadline, s.start_date, s.end_date
       HAVING COUNT(DISTINCT et.id) > 0 
       AND COUNT(DISTINCT et.id) = COUNT(DISTINCT e.id)
       ORDER BY MAX(e.completed_at) DESC NULLS LAST`,
      [userId]
    );

    res.json({ studies: result.rows });
  } catch (err) {
    console.error('[GET /studies/completed] Error:', err);
    res.status(500).json({ error: 'Failed to fetch completed studies' });
  }
});

// GET /api/participant/studies/:id -> study details and basic metrics
router.get('/studies/:id', async (req, res) => {
  try {
    // Admin can pass participantId in query string to view as that participant
    let userId = req.user.id;
    if (req.user.role === 'admin' && req.query.participantId) {
      userId = parseInt(req.query.participantId, 10);
    }
    const studyId = parseInt(req.params.id, 10);

    const q = `SELECT id, title, description, deadline, start_date, end_date, status, created_at FROM studies WHERE id = $1`;
    const { rows } = await pool.query(q, [studyId]);
    const study = rows[0];
    if (!study) return res.status(404).json({ error: 'Study not found' });

    // verify participant is enrolled (skip for admin)
    if (req.user.role !== 'admin') {
      const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
      if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });
    }

    const totalsQ = `SELECT
      COUNT(DISTINCT et.id) AS total_tasks,
      COUNT(DISTINCT et.id) FILTER (WHERE e.id IS NOT NULL OR tp.status = 'completed') AS completed_tasks,
      COALESCE(SUM(tp.time_spent_seconds),0)::int AS time_spent_seconds
      FROM evaluation_tasks et
      LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = $2
      LEFT JOIN evaluations e ON e.task_id = et.id AND e.participant_id = $2 AND e.deleted_at IS NULL
      WHERE et.study_id = $1`;
    const r = await pool.query(totalsQ, [studyId, userId]);
    const t = r.rows[0];
    console.log(`[Participant Study Details] Study ${studyId} totals -> total_tasks=${t.total_tasks}, completed_tasks=${t.completed_tasks}, time_spent_seconds=${t.time_spent_seconds}`);

    // Check quiz access
    const quizAccess = await Study.checkQuizAccess(studyId, userId);

    res.json({
      id: study.id,
      title: study.title,
      description: study.description,
      deadline: study.deadline,
      start_date: study.start_date,
      end_date: study.end_date,
      status: computeStatus(study),
      total_tasks: parseInt(t.total_tasks || 0, 10),
      completed_tasks: parseInt(t.completed_tasks || 0, 10),
      pending_tasks: Math.max(0, parseInt(t.total_tasks || 0, 10) - parseInt(t.completed_tasks || 0, 10)),
      time_spent_seconds: parseInt(t.time_spent_seconds || 0, 10),
      quiz_access: quizAccess
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch study details' });
  }
});

// GET /api/participant/studies/:id/tasks -> list tasks with status
router.get('/studies/:id/tasks', async (req, res) => {
  try {
    // Admin can pass participantId in query string to view as that participant
    let userId = req.user.id;
    if (req.user.role === 'admin' && req.query.participantId) {
      userId = parseInt(req.query.participantId, 10);
    }
    const studyId = parseInt(req.params.id, 10);

    console.log(`[GET /studies/${studyId}/tasks] User ${userId} requesting tasks`);

    // verify participant is enrolled (skip for admin)
    if (req.user.role !== 'admin') {
      const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
      if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });
    }

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    console.log(`[GET /studies/${studyId}/tasks] Quiz access check:`, JSON.stringify(quizAccess));
    
    if (!quizAccess.canAccess) {
      console.log(`[GET /studies/${studyId}/tasks] Blocking access - quiz required`);
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }
    
    console.log(`[GET /studies/${studyId}/tasks] Access granted - returning tasks`);

    // Get tasks with progress
    const q = `SELECT et.id, et.task_type, et.instructions, tp.status, tp.time_spent_seconds, tp.started_at
               FROM evaluation_tasks et
               LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = $2
               WHERE et.study_id = $1
               ORDER BY et.created_at`;
    const { rows } = await pool.query(q, [studyId, userId]);
    
    // Get draft evaluation to check for data
    let draftTaskAnswers = {};
    try {
      const draftQ = await pool.query(
        'SELECT task_answers FROM draft_evaluations WHERE study_id = $1 AND participant_id = $2',
        [studyId, userId]
      );
      if (draftQ.rowCount > 0) {
        draftTaskAnswers = draftQ.rows[0].task_answers || {};
      }
    } catch (draftError) {
      // Draft table might not exist - that's okay
      console.log('Could not fetch draft evaluation:', draftError.message);
    }
    
    // Determine status for each task
    const out = rows.map(r => {
      let status = r.status || 'pending';
      
      // If task_progress shows completed, keep it as completed
      if (status === 'completed') {
        return {
          id: r.id,
          task_type: r.task_type,
          instructions: r.instructions,
          status: 'completed',
          time_spent_seconds: r.time_spent_seconds || 0,
          started_at: r.started_at || null,
        };
      }
      
      // Check if task has data in draft
      const taskAnswer = draftTaskAnswers[r.id.toString()] || draftTaskAnswers[r.id];
      if (taskAnswer && hasTaskData(taskAnswer)) {
        // Task has data, so it's in_progress
        status = 'in_progress';
      } else if (!r.status) {
        // No status in task_progress and no data in draft = pending
        status = 'pending';
      }
      
      return {
        id: r.id,
        task_type: r.task_type,
        instructions: r.instructions,
        status: status,
        time_spent_seconds: r.time_spent_seconds || 0,
        started_at: r.started_at || null,
      };
    });
    
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/participant/tasks/:id -> get full task details with artifacts and criteria
router.get('/tasks/:id', async (req, res) => {
  try {
    // Admin can pass participantId in query string to view as that participant
    let userId = req.user.id;
    if (req.user.role === 'admin' && req.query.participantId) {
      userId = parseInt(req.query.participantId, 10);
    }
    const taskId = parseInt(req.params.id, 10);

    // Get task with study info
    // Check if answer_type and answer_options columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluation_tasks' AND column_name IN ('answer_type', 'answer_options')
    `);
    const hasAnswerType = columnsCheck.rows.some(r => r.column_name === 'answer_type');
    const hasAnswerOptions = columnsCheck.rows.some(r => r.column_name === 'answer_options');

    let selectColumns = `et.id, et.task_type, et.instructions, et.artifact1_id, et.artifact2_id, et.artifact3_id, et.study_id`;
    if (hasAnswerType) selectColumns += `, et.answer_type`;
    if (hasAnswerOptions) selectColumns += `, et.answer_options`;
    selectColumns += `, s.title as study_title, s.description as study_description`;

    const taskQ = await pool.query(
      `SELECT ${selectColumns}
       FROM evaluation_tasks et
       JOIN studies s ON et.study_id = s.id
       WHERE et.id = $1`,
      [taskId]
    );
    if (taskQ.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

    const task = taskQ.rows[0];
    const studyId = task.study_id;

    // Verify participant is enrolled (skip for admin)
    if (req.user.role !== 'admin') {
      const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
      if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });
    }

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    // Get task progress
    const progressQ = await pool.query(
      `SELECT status, time_spent_seconds, started_at FROM task_progress WHERE task_id = $1 AND participant_id = $2`,
      [taskId, userId]
    );
    let progress = progressQ.rowCount > 0 ? progressQ.rows[0] : { status: 'pending', time_spent_seconds: 0, started_at: null };
    
    // Check draft data to determine correct status
    if (progress.status !== 'completed') {
      try {
        const draftQ = await pool.query(
          'SELECT task_answers FROM draft_evaluations WHERE study_id = $1 AND participant_id = $2',
          [studyId, userId]
        );
        if (draftQ.rowCount > 0) {
          const draftTaskAnswers = draftQ.rows[0].task_answers || {};
          const taskAnswer = draftTaskAnswers[taskId.toString()] || draftTaskAnswers[taskId];
          if (taskAnswer && hasTaskData(taskAnswer)) {
            // Task has data, so it's in_progress
            progress.status = 'in_progress';
          } else if (!progress.status || progress.status === 'pending') {
            // No data in draft = pending
            progress.status = 'pending';
          }
        }
      } catch (draftError) {
        // Draft table might not exist - that's okay, use progress status
        console.log('Could not fetch draft evaluation:', draftError.message);
      }
    }

    // Get artifacts
    const artifactIds = [task.artifact1_id, task.artifact2_id, task.artifact3_id].filter(id => id !== null);
    let artifacts = [];
    if (artifactIds.length > 0) {
      const artifactsQ = await pool.query(
        `SELECT id, name, type, content, metadata, storage_type, file_path, mime_type
         FROM artifacts WHERE id = ANY($1::int[])`,
        [artifactIds]
      );
      artifacts = artifactsQ.rows;
    }

    // Get study criteria (table might not exist yet)
    let criteria = [];
    try {
      const criteriaQ = await pool.query(
        `SELECT id, name, type, scale, description, display_order 
         FROM study_criteria 
         WHERE study_id = $1 
         ORDER BY display_order ASC`,
        [studyId]
      );
      criteria = criteriaQ.rows;
    } catch (criteriaErr) {
      // Table doesn't exist yet - continue without criteria
      console.log('Note: study_criteria table not found, continuing without criteria');
    }

    // Organize artifacts by position
    const artifactMap = {};
    artifacts.forEach(art => {
      artifactMap[art.id] = art;
    });

    // Parse answer_options if it's a string (shouldn't happen with JSONB, but handle edge cases)
    let answerOptions = task.answer_options;
    if (typeof answerOptions === 'string') {
      try {
        answerOptions = JSON.parse(answerOptions);
      } catch (e) {
        console.error('Failed to parse answer_options:', e);
        answerOptions = null;
      }
    }
    
    // Handle null case (typeof null === 'object' in JavaScript)
    if (answerOptions === null || answerOptions === undefined) {
      answerOptions = null;
    }

    // Extract criteria from answer_options if available (preferred over study-level criteria)
    let taskCriteria = criteria; // Default to study-level criteria
    if (answerOptions && answerOptions.criteria && Array.isArray(answerOptions.criteria) && answerOptions.criteria.length > 0) {
      // Validate criteria have name and description
      const validCriteria = answerOptions.criteria.map(c => ({
        id: c.id,
        name: c.name || 'Unnamed Criterion',
        description: c.description || '',
        type: c.type,
        scale: c.scale
      }));
      
      taskCriteria = validCriteria; // Use question-level criteria from answer_options
    } else {
      // Ensure study-level criteria also have descriptions
      taskCriteria = criteria.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || '',
        type: c.type,
        scale: c.scale
      }));
    }

    // Dynamically build question text with criteria if this is a choice-based task
    // Check if it's a choice-based task (either choice_required_text or choice)
    const isChoiceTask = task.answer_type === 'choice_required_text' || 
                         task.answer_type === 'choice' ||
                         (answerOptions && answerOptions.questionType === 'comparison');
    
    if (answerOptions && isChoiceTask && taskCriteria.length > 0) {
      // Build question text that includes criteria and descriptions
      let questionText = 'Which artifact is better based on the following criteria:\n\n';
      taskCriteria.forEach((criterion, index) => {
        questionText += `${index + 1}. ${criterion.name}`;
        if (criterion.description && criterion.description.trim()) {
          questionText += `: ${criterion.description}`;
        }
        questionText += '\n';
      });
      
      // Update answer_options with dynamically generated question
      answerOptions = {
        ...answerOptions,
        question: questionText.trim()
      };
    }

    res.json({
      id: task.id,
      task_type: task.task_type,
      instructions: task.instructions,
      answer_type: task.answer_type || 'rating',
      answer_options: answerOptions, // Contains dynamically generated question if criteria exist
      study_id: studyId,
      study_title: task.study_title,
      study_description: task.study_description,
      artifact1: task.artifact1_id ? artifactMap[task.artifact1_id] || null : null,
      artifact2: task.artifact2_id ? artifactMap[task.artifact2_id] || null : null,
      artifact3: task.artifact3_id ? artifactMap[task.artifact3_id] || null : null,
      criteria: taskCriteria, // Use criteria from answer_options if available, otherwise study-level
      progress: {
        status: progress.status,
        time_spent_seconds: progress.time_spent_seconds || 0,
        started_at: progress.started_at
      }
    });
  } catch (err) {
    console.error('[GET /tasks/:id] Error:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      taskId: req.params.id,
      userId: req.user?.id
    });
    res.status(500).json({ 
      error: 'Failed to fetch task details',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// GET /api/participant/studies/:id/evaluation -> get all tasks for evaluation page
router.get('/studies/:id/evaluation', async (req, res) => {
  try {
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);

    // Verify participant is enrolled
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    // Get study info
    const studyQ = await pool.query('SELECT id, title, description FROM studies WHERE id = $1', [studyId]);
    if (studyQ.rowCount === 0) return res.status(404).json({ error: 'Study not found' });
    const study = studyQ.rows[0];

    // Get all tasks with artifacts and progress
    // Check if answer_type and answer_options columns exist
    const columnsCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluation_tasks' AND column_name IN ('answer_type', 'answer_options')
    `);
    const hasAnswerType = columnsCheck.rows.some(r => r.column_name === 'answer_type');
    const hasAnswerOptions = columnsCheck.rows.some(r => r.column_name === 'answer_options');

    let selectColumns = `et.id, et.task_type, et.instructions, et.artifact1_id, et.artifact2_id, et.artifact3_id`;
    if (hasAnswerType) selectColumns += `, et.answer_type`;
    if (hasAnswerOptions) selectColumns += `, et.answer_options`;
    selectColumns += `, tp.status, tp.time_spent_seconds, tp.started_at`;

    const tasksQ = await pool.query(
      `SELECT ${selectColumns}
       FROM evaluation_tasks et
       LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = $2
       WHERE et.study_id = $1
       ORDER BY et.created_at`,
      [studyId, userId]
    );

    // Get all artifact IDs
    const artifactIds = [];
    tasksQ.rows.forEach(task => {
      if (task.artifact1_id) artifactIds.push(task.artifact1_id);
      if (task.artifact2_id) artifactIds.push(task.artifact2_id);
      if (task.artifact3_id) artifactIds.push(task.artifact3_id);
    });

    // Get all artifacts
    let artifacts = [];
    if (artifactIds.length > 0) {
      const artifactsQ = await pool.query(
        `SELECT id, name, type, content, metadata, storage_type, file_path, mime_type
         FROM artifacts WHERE id = ANY($1::int[])`,
        [artifactIds]
      );
      artifacts = artifactsQ.rows;
    }

    // Get study criteria (table might not exist yet)
    let criteria = [];
    try {
      const criteriaQ = await pool.query(
        `SELECT id, name, type, scale, description, display_order 
         FROM study_criteria 
         WHERE study_id = $1 
         ORDER BY display_order ASC`,
        [studyId]
      );
      criteria = criteriaQ.rows;
    } catch (criteriaErr) {
      // Table doesn't exist yet - continue without criteria
      console.log('Note: study_criteria table not found, continuing without criteria');
    }

    // Build artifact map
    const artifactMap = {};
    artifacts.forEach(art => {
      artifactMap[art.id] = art;
    });

    // Build tasks with artifacts
    const tasks = tasksQ.rows.map(task => ({
      id: task.id,
      task_type: task.task_type,
      instructions: task.instructions,
      answer_type: task.answer_type || 'rating',
      answer_options: task.answer_options || null,
      artifact1: task.artifact1_id ? artifactMap[task.artifact1_id] || null : null,
      artifact2: task.artifact2_id ? artifactMap[task.artifact2_id] || null : null,
      artifact3: task.artifact3_id ? artifactMap[task.artifact3_id] || null : null,
      progress: {
        status: task.status || 'pending',
        time_spent_seconds: task.time_spent_seconds || 0,
        started_at: task.started_at
      }
    }));

    res.json({
      study: {
        id: study.id,
        title: study.title,
        description: study.description
      },
      tasks: tasks,
      criteria: criteria
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch evaluation data' });
  }
});

// POST /api/participant/tasks/:id/start -> start or resume a task
router.post('/tasks/:id/start', async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = parseInt(req.params.id, 10);

    // Ensure task exists
    const taskQ = await pool.query('SELECT id, study_id FROM evaluation_tasks WHERE id = $1', [taskId]);
    if (taskQ.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

    // Ensure participant is enrolled in the study
    const studyId = taskQ.rows[0].study_id;
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    // Check if progress record exists first (works regardless of constraint)
    const existing = await pool.query(
      'SELECT id, status, started_at, time_spent_seconds FROM task_progress WHERE task_id = $1 AND participant_id = $2',
      [taskId, userId]
    );
    
    if (existing.rowCount === 0) {
      // Insert new progress record
      const insert = await pool.query(
        `INSERT INTO task_progress (task_id, participant_id, status, started_at, updated_at)
         VALUES ($1, $2, 'in_progress', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id, task_id, participant_id, status, started_at, time_spent_seconds`,
        [taskId, userId]
      );
      return res.json(insert.rows[0]);
    } else {
      // Update existing progress record
      const upd = await pool.query(
        `UPDATE task_progress 
         SET status = 'in_progress', 
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP), 
             updated_at = CURRENT_TIMESTAMP
         WHERE task_id = $1 AND participant_id = $2
         RETURNING id, task_id, participant_id, status, started_at, time_spent_seconds`,
        [taskId, userId]
      );
      return res.json(upd.rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start task' });
  }
});

// POST /api/participant/tasks/:id/submit -> submit a single task as completed
router.post('/tasks/:id/submit', async (req, res) => {
  try {
    console.log('[POST /tasks/:id/submit] ===== SUBMIT ENDPOINT CALLED =====');
    console.log('[POST /tasks/:id/submit] Route hit, taskId:', req.params.id);
    console.log('[POST /tasks/:id/submit] Request body:', JSON.stringify(req.body, null, 2));
    const userId = req.user.id;
    const taskId = parseInt(req.params.id, 10);
    console.log('[POST /tasks/:id/submit] Parsed taskId:', taskId, 'userId:', userId);

    // Verify task exists and participant is enrolled; also fetch study deadline/status
    const taskQ = await pool.query('SELECT et.id, et.study_id, s.deadline, s.status FROM evaluation_tasks et JOIN studies s ON s.id = et.study_id WHERE et.id = $1', [taskId]);
    if (taskQ.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

    const { study_id: studyId, deadline, status } = taskQ.rows[0];
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Block submissions after deadline or if study already completed/cancelled/archived
    const now = new Date();
    if ((deadline && new Date(deadline) < now) || ['completed', 'cancelled', 'archived'].includes(status)) {
      return res.status(403).json({ error: 'Study deadline has passed; submissions are closed.' });
    }

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    // Get task data from request body
    const taskData = req.body;
    const {
      ratings = {},
      choice = '',
      text = '',
      comments = '',
      annotations = {},
      screenshots = [],
      highlights = [],
      artifactHighlights = { artifact1: [], artifact2: [], artifact3: [] }
    } = taskData;

    // Store choice, text, screenshots, and highlights in annotations for later retrieval
    const fullAnnotations = {
      ...annotations,
      choice: choice || null,
      text: text || null,
      screenshots: screenshots || [],
      highlights: highlights || [],
      artifactHighlights: artifactHighlights || { artifact1: [], artifact2: [], artifact3: [] }
    };

    // Use transaction to ensure atomicity
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if evaluation already exists (exclude deleted)
      const existingQ = await client.query(
        'SELECT id FROM evaluations WHERE task_id = $1 AND participant_id = $2 AND deleted_at IS NULL',
        [taskId, userId]
      );

      if (existingQ.rowCount === 0) {
        // Insert new evaluation
        console.log('[POST /tasks/:id/submit] Inserting NEW evaluation into evaluations table');
        await client.query(
          `INSERT INTO evaluations (task_id, participant_id, ratings, annotations, comments, completed_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
          [
            taskId,
            userId,
            JSON.stringify(ratings),
            JSON.stringify(fullAnnotations),
            comments || text || ''
          ]
        );
        console.log('[POST /tasks/:id/submit] Successfully inserted evaluation');
      } else {
        // Update existing evaluation
        console.log('[POST /tasks/:id/submit] Updating EXISTING evaluation in evaluations table');
        await client.query(
          `UPDATE evaluations 
           SET ratings = $3, annotations = $4, comments = $5, completed_at = CURRENT_TIMESTAMP
           WHERE task_id = $1 AND participant_id = $2`,
          [
            taskId,
            userId,
            JSON.stringify(ratings),
            JSON.stringify(fullAnnotations),
            comments || text || ''
          ]
        );
        console.log('[POST /tasks/:id/submit] Successfully updated evaluation');
      }

      // Update task progress to completed
      const progressCheck = await client.query(
        'SELECT id FROM task_progress WHERE task_id = $1 AND participant_id = $2',
        [taskId, userId]
      );
      
      if (progressCheck.rowCount === 0) {
        // Insert new progress record
        await client.query(
          `INSERT INTO task_progress (task_id, participant_id, status, updated_at)
           VALUES ($1, $2, 'completed', CURRENT_TIMESTAMP)`,
          [taskId, userId]
        );
      } else {
        // Update existing progress record
        await client.query(
          `UPDATE task_progress SET status = 'completed', updated_at = CURRENT_TIMESTAMP
           WHERE task_id = $1 AND participant_id = $2`,
          [taskId, userId]
        );
      }

      // Also update the draft evaluation to include this task's data
      // Get current draft or initialize
      let currentDraft;
      try {
        const draftQ = await client.query(
          'SELECT task_answers FROM draft_evaluations WHERE study_id = $1 AND participant_id = $2',
          [studyId, userId]
        );
        if (draftQ.rowCount > 0) {
          currentDraft = { task_answers: draftQ.rows[0].task_answers || {} };
        } else {
          currentDraft = { task_answers: {} };
        }
      } catch (draftError) {
        // Draft table might not exist, that's okay
        currentDraft = { task_answers: {} };
      }

      // Update draft with this task's data
      const updatedTaskAnswers = {
        ...(currentDraft.task_answers || {}),
        [taskId]: {
          ratings,
          choice,
          text,
          comments,
          annotations: fullAnnotations,
          screenshots,
          highlights,
          artifactHighlights
        }
      };

      // Update or insert draft evaluation
      try {
        const draftUpdateQ = await client.query(
          `UPDATE draft_evaluations 
           SET task_answers = $3, updated_at = CURRENT_TIMESTAMP
           WHERE study_id = $1 AND participant_id = $2`,
          [studyId, userId, JSON.stringify(updatedTaskAnswers)]
        );
        
        if (draftUpdateQ.rowCount === 0) {
          // Insert new draft if it doesn't exist
          await client.query(
            `INSERT INTO draft_evaluations (study_id, participant_id, task_answers, created_at, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [studyId, userId, JSON.stringify(updatedTaskAnswers)]
          );
        }
      } catch (draftError) {
        // Draft table might not exist, that's okay - just log it
        console.log('Could not update draft evaluation:', draftError.message);
      }

      // Check study completion and update status/notifications
      await checkAndUpdateStudyCompletion(studyId, client);

      await client.query('COMMIT');
      console.log('[POST /tasks/:id/submit] ===== TRANSACTION COMMITTED SUCCESSFULLY =====');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[POST /tasks/:id/submit] ===== TRANSACTION ROLLED BACK =====');
      throw err;
    } finally {
      client.release();
    }

    console.log('[POST /tasks/:id/submit] Sending success response');
    res.json({ success: true, message: 'Task submitted successfully' });
  } catch (err) {
    console.error('[POST /tasks/:id/submit] Error:', err);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// POST /api/participant/tasks/:id/upload-screenshot -> upload screenshot for task response
router.post('/tasks/:id/upload-screenshot', (req, res, next) => {
  console.log('[Upload Screenshot] Route matched, processing file upload...');
  console.log('[Upload Screenshot] Request body keys:', Object.keys(req.body || {}));
  // Add error handling for multer
  imageUpload.single('screenshot')(req, res, (err) => {
    if (err) {
      console.error('[Multer Error]', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      if (err.message && err.message.includes('not allowed')) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    console.log('[Upload Screenshot] File uploaded successfully:', req.file ? req.file.originalname : 'no file');
    next();
  });
}, async (req, res) => {
  try {
    console.log('[Upload Screenshot] Handler called, taskId:', req.params.id);
    const userId = req.user.id;
    const taskId = parseInt(req.params.id, 10);

    // Verify task exists and participant is enrolled
    const taskQ = await pool.query('SELECT id, study_id FROM evaluation_tasks WHERE id = $1', [taskId]);
    if (taskQ.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

    const studyId = taskQ.rows[0].study_id;
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Store image record in database
    const imageQ = await pool.query(
      `INSERT INTO task_response_images (task_id, participant_id, image_type, file_path, file_name, file_size, mime_type)
       VALUES ($1, $2, 'screenshot', $3, $4, $5, $6)
       RETURNING id, file_path, file_name`,
      [taskId, userId, req.file.path, req.file.originalname, req.file.size, req.file.mimetype]
    );

    const image = imageQ.rows[0];
    
    // Return URL path (relative to /uploads)
    const relativePath = path.relative(path.join(__dirname, '../uploads'), image.file_path);
    const relativeUrl = relativePath.replace(/\\/g, '/');
    
    // Use relative URL for Docker compatibility - frontend will handle the full URL construction
    // This works better with Docker networking and proxies
    const imageUrl = `/uploads/${relativeUrl}`;

    res.json({
      success: true,
      image: {
        id: image.id,
        url: imageUrl,
        fileName: image.file_name,
        filePath: image.file_path
      }
    });
  } catch (err) {
    console.error('[POST /tasks/:id/upload-screenshot] Error:', err);
    res.status(500).json({ error: 'Failed to upload screenshot' });
  }
});

// POST /api/participant/tasks/:id/upload-highlight-image -> upload image for highlight
router.post('/tasks/:id/upload-highlight-image', imageUpload.single('image'), async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = parseInt(req.params.id, 10);
    const { highlightId } = req.body; // Optional highlight ID to link the image

    // Verify task exists and participant is enrolled
    const taskQ = await pool.query('SELECT id, study_id FROM evaluation_tasks WHERE id = $1', [taskId]);
    if (taskQ.rowCount === 0) return res.status(404).json({ error: 'Task not found' });

    const studyId = taskQ.rows[0].study_id;
    const check = await pool.query('SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2', [studyId, userId]);
    if (check.rowCount === 0) return res.status(403).json({ error: 'Not enrolled in study' });

    // Check quiz access - block if canAccess is false (quizzes exist and not all passed)
    const quizAccess = await Study.checkQuizAccess(studyId, userId);
    if (!quizAccess.canAccess) {
      return res.status(403).json({ 
        error: 'Quiz required to access study tasks',
        quiz_access: quizAccess 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Store image record in database
    const imageQ = await pool.query(
      `INSERT INTO task_response_images (task_id, participant_id, image_type, file_path, file_name, file_size, mime_type, highlight_id)
       VALUES ($1, $2, 'highlight_image', $3, $4, $5, $6, $7)
       RETURNING id, file_path, file_name, highlight_id`,
      [taskId, userId, req.file.path, req.file.originalname, req.file.size, req.file.mimetype, highlightId || null]
    );

    const image = imageQ.rows[0];
    
    // Return URL path (relative to /uploads)
    const relativePath = path.relative(path.join(__dirname, '../uploads'), image.file_path);
    const relativeUrl = relativePath.replace(/\\/g, '/');
    
    // Use relative URL for Docker compatibility - frontend will handle the full URL construction
    // This works better with Docker networking and proxies
    const imageUrl = `/uploads/${relativeUrl}`;

    res.json({
      success: true,
      image: {
        id: image.id,
        url: imageUrl,
        fileName: image.file_name,
        filePath: image.file_path,
        highlightId: image.highlight_id
      }
    });
  } catch (err) {
    console.error('[POST /tasks/:id/upload-highlight-image] Error:', err);
    res.status(500).json({ error: 'Failed to upload highlight image' });
  }
});

// Additional participant dashboard helpers
// GET /api/participant/dashboard/tasks -> recent tasks with status and due info
router.get('/dashboard/tasks', async (req, res) => {
  try {
    const userId = req.user.id;

    // Get tasks from studies the participant is enrolled in
    const q = `SELECT et.id, et.study_id, et.task_type, et.instructions, s.title as study_title, s.deadline,
                      tp.status, tp.time_spent_seconds, tp.started_at
               FROM evaluation_tasks et
               JOIN studies s ON s.id = et.study_id
               JOIN study_participants sp ON sp.study_id = s.id AND sp.participant_id = $1
               LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = $1
               ORDER BY et.created_at DESC
               LIMIT 10`;
    const { rows } = await pool.query(q, [userId]);
    const tasks = rows.map(r => ({
      id: r.id,
      title: r.instructions?.slice(0, 80) || 'Task',
      studyId: r.study_id,
      studyTitle: r.study_title,
      status: r.status || 'pending',
      time_spent_seconds: r.time_spent_seconds || 0,
      dueDate: r.deadline || null
    }));
    res.json({ tasks });
  } catch (err) {
    console.error('[GET /dashboard/tasks] Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard tasks' });
  }
});

// GET /api/participant/artifacts/:id/image -> Get artifact image for participants
// This endpoint allows participants to access artifact images from tasks they're assigned to
// Also handles /api/participant/artifacts/:id/download as an alias for backward compatibility
router.get('/artifacts/:id/image', async (req, res) => {
  try {
    const userId = req.user.id;
    const artifactId = parseInt(req.params.id, 10);
    
    console.log('[GET /artifacts/:id/image] Request received:', {
      artifactId,
      userId,
      userAgent: req.get('user-agent')
    });

    // Get artifact info
    const artifact = await Artifact.findByIdWithoutFileData(artifactId);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Check if participant is enrolled in a study that has a task with this artifact
    const accessCheck = await pool.query(
      `SELECT 1 
       FROM evaluation_tasks et
       JOIN study_participants sp ON sp.study_id = et.study_id AND sp.participant_id = $1
       WHERE (et.artifact1_id = $2 OR et.artifact2_id = $2 OR et.artifact3_id = $2)
       LIMIT 1`,
      [userId, artifactId]
    );

    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied: artifact not in your assigned tasks' });
    }

    // Serve the artifact file
    if (artifact.storage_type === 'database') {
      // Get file data from database
      const fileData = await Artifact.getFileData(artifactId);
      if (!fileData || !fileData.file_data) {
        return res.status(404).json({ error: 'File data not found' });
      }

      // Set appropriate headers for image display (not download)
      const metadata = typeof artifact.metadata === 'string' ?
        JSON.parse(artifact.metadata) : artifact.metadata;
      const mimeType = fileData.mime_type || artifact.mime_type || 'image/png';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileData.file_size);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Send the binary data
      res.send(fileData.file_data);

    } else if (artifact.storage_type === 'filesystem') {
      // Serve from filesystem
      if (!artifact.file_path || !fs.existsSync(artifact.file_path)) {
        return res.status(404).json({ error: 'File not found on filesystem' });
      }

      const mimeType = artifact.mime_type || 'image/png';
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.sendFile(path.resolve(artifact.file_path));

    } else {
      return res.status(404).json({ error: 'No file data available' });
    }

  } catch (error) {
    console.error('[GET /artifacts/:id/image] Error:', error);
    res.status(500).json({ error: 'Failed to load artifact image' });
  }
});

// GET /api/participant/dashboard/deadlines -> upcoming deadlines derived from study deadlines and task status
router.get('/dashboard/deadlines', async (req, res) => {
  try {
    const userId = req.user.id;
    const q = `SELECT s.id as study_id, s.title as study_title, s.deadline,
                      COUNT(et.id) AS total_tasks,
                      COUNT(et.id) FILTER (WHERE e.id IS NOT NULL OR tp.status = 'completed') AS completed_tasks
               FROM studies s
               JOIN study_participants sp ON sp.study_id = s.id AND sp.participant_id = $1
               LEFT JOIN evaluation_tasks et ON et.study_id = s.id
               LEFT JOIN task_progress tp ON tp.task_id = et.id AND tp.participant_id = $1
               LEFT JOIN evaluations e ON e.task_id = et.id AND e.participant_id = $1 AND e.deleted_at IS NULL
               WHERE s.deadline IS NOT NULL
               GROUP BY s.id, s.title, s.deadline
               ORDER BY s.deadline ASC
               LIMIT 10`;
    const { rows } = await pool.query(q, [userId]);
    const now = new Date();
    const deadlines = rows
      .filter(r => r.deadline && new Date(r.deadline) >= now)
      .map((r, idx) => ({
        id: idx + 1,
        taskTitle: r.study_title,
        studyTitle: r.study_title,
        studyId: r.study_id,
        dueDate: r.deadline,
        status: r.completed_tasks >= r.total_tasks ? 'completed' : (r.completed_tasks > 0 ? 'in_progress' : 'pending')
      }));
    res.json({ deadlines });
  } catch (err) {
    console.error('[GET /dashboard/deadlines] Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard deadlines' });
  }
});

// POST /api/participant/tasks/:id/tags -> save evaluation tags for artifacts
router.post('/tasks/:id/tags', async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = parseInt(req.params.id, 10);
    const { tags } = req.body; // { artifact1_id: ['tag1', 'tag2'], artifact2_id: ['tag3'], ... }

    if (!tags || typeof tags !== 'object') {
      return res.status(400).json({ error: 'Tags object is required' });
    }

    // Verify task exists and participant is enrolled
    const taskQ = await pool.query(
      'SELECT id, study_id, artifact1_id, artifact2_id, artifact3_id FROM evaluation_tasks WHERE id = $1',
      [taskId]
    );
    if (taskQ.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskQ.rows[0];
    const studyId = task.study_id;
    const check = await pool.query(
      'SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2',
      [studyId, userId]
    );
    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'Not enrolled in study' });
    }

    // Validate artifact IDs belong to this task
    const validArtifactIds = [task.artifact1_id, task.artifact2_id, task.artifact3_id].filter(id => id !== null);
    const providedArtifactIds = Object.keys(tags).map(id => parseInt(id, 10));
    const invalidArtifactIds = providedArtifactIds.filter(id => !validArtifactIds.includes(id));
    
    if (invalidArtifactIds.length > 0) {
      return res.status(400).json({ 
        error: `Invalid artifact IDs: ${invalidArtifactIds.join(', ')}. Artifacts must belong to this task.` 
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing tags for this task/participant/artifact combination
      for (const artifactIdStr of Object.keys(tags)) {
        const artifactId = parseInt(artifactIdStr, 10);
        await client.query(
          'DELETE FROM evaluation_artifact_tags WHERE task_id = $1 AND participant_id = $2 AND artifact_id = $3',
          [taskId, userId, artifactId]
        );
      }

      // Insert new tags (max 5 per artifact)
      for (const artifactIdStr of Object.keys(tags)) {
        const artifactId = parseInt(artifactIdStr, 10);
        const artifactTags = Array.isArray(tags[artifactIdStr]) ? tags[artifactIdStr] : [];
        
        // Limit to 5 tags per artifact
        const tagsToInsert = artifactTags.slice(0, 5).filter(tag => tag && typeof tag === 'string' && tag.trim().length > 0);
        
        for (const tag of tagsToInsert) {
          const trimmedTag = tag.trim().substring(0, 100); // Limit to 100 chars
          try {
            await client.query(
              'INSERT INTO evaluation_artifact_tags (task_id, participant_id, artifact_id, tag) VALUES ($1, $2, $3, $4)',
              [taskId, userId, artifactId, trimmedTag]
            );
          } catch (err) {
            // Ignore duplicate tag errors (unique constraint)
            if (err.code !== '23505') {
              throw err;
            }
          }
        }
      }

      await client.query('COMMIT');

      // Fetch and return the saved tags
      const tagsQ = await client.query(
        `SELECT artifact_id, tag 
         FROM evaluation_artifact_tags 
         WHERE task_id = $1 AND participant_id = $2
         ORDER BY artifact_id, tag`,
        [taskId, userId]
      );

      const result = {};
      tagsQ.rows.forEach(row => {
        if (!result[row.artifact_id]) {
          result[row.artifact_id] = [];
        }
        result[row.artifact_id].push(row.tag);
      });

      res.json({ success: true, tags: result });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POST /tasks/:id/tags] Error:', err);
    res.status(500).json({ error: 'Failed to save tags' });
  }
});

// GET /api/participant/tasks/:id/tags -> get evaluation tags for artifacts
router.get('/tasks/:id/tags', async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = parseInt(req.params.id, 10);

    // Verify task exists and participant is enrolled
    const taskQ = await pool.query('SELECT id, study_id FROM evaluation_tasks WHERE id = $1', [taskId]);
    if (taskQ.rowCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const studyId = taskQ.rows[0].study_id;
    const check = await pool.query(
      'SELECT 1 FROM study_participants WHERE study_id = $1 AND participant_id = $2',
      [studyId, userId]
    );
    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'Not enrolled in study' });
    }

    // Fetch tags
    const tagsQ = await pool.query(
      `SELECT artifact_id, tag 
       FROM evaluation_artifact_tags 
       WHERE task_id = $1 AND participant_id = $2
       ORDER BY artifact_id, tag`,
      [taskId, userId]
    );

    const result = {};
    tagsQ.rows.forEach(row => {
      if (!result[row.artifact_id]) {
        result[row.artifact_id] = [];
      }
      result[row.artifact_id].push(row.tag);
    });

    res.json({ tags: result });
  } catch (err) {
    console.error('[GET /tasks/:id/tags] Error:', err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// DELETE /api/participant/studies/:id/delete -> move completed study to trash bin (soft delete study_participants, evaluations remain untouched)
router.delete('/studies/:id/delete', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);

    // Verify participant is enrolled and study is not already deleted
    const enrollmentCheck = await client.query(
      'SELECT id FROM study_participants WHERE study_id = $1 AND participant_id = $2 AND deleted_at IS NULL',
      [studyId, userId]
    );

    if (enrollmentCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not enrolled in study or already deleted' });
    }

    // Verify study is completed for this participant
    const completionCheck = await client.query(
      `SELECT 
        COUNT(DISTINCT et.id) AS total_tasks,
        COUNT(DISTINCT e.id) AS completed_evaluations
       FROM evaluation_tasks et
       LEFT JOIN evaluations e ON e.task_id = et.id AND e.participant_id = $1 AND e.deleted_at IS NULL
       WHERE et.study_id = $2
       GROUP BY et.study_id
       HAVING COUNT(DISTINCT et.id) > 0 
       AND COUNT(DISTINCT et.id) = COUNT(DISTINCT e.id)`,
      [userId, studyId]
    );

    if (completionCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Study is not completed yet' });
    }

    // Soft delete the study_participants record (hide from participant view)
    // Evaluations remain untouched and visible to researchers
    await client.query(
      `UPDATE study_participants 
       SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1
       WHERE study_id = $2 AND participant_id = $1 AND deleted_at IS NULL`,
      [userId, studyId]
    );

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Study moved to trash bin. Evaluations remain in database for researchers.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DELETE /studies/:id/delete] Error:', err);
    res.status(500).json({ error: 'Failed to delete study' });
  } finally {
    client.release();
  }
});

// ========== COMPLETED STUDIES TRASH BIN ENDPOINTS ==========

// GET /api/participant/studies/completed/trash -> get all deleted completed studies for the participant
router.get('/studies/completed/trash', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        s.id,
        s.title,
        s.description,
        s.deadline,
        s.start_date,
        s.end_date,
        sp.deleted_at,
        COUNT(DISTINCT et.id) AS total_tasks,
        COUNT(DISTINCT e.id) AS completed_evaluations,
        MAX(e.completed_at) AS last_completed_at
       FROM studies s
       JOIN study_participants sp ON sp.study_id = s.id
       LEFT JOIN evaluation_tasks et ON et.study_id = s.id
       LEFT JOIN evaluations e ON e.task_id = et.id AND e.participant_id = $1 AND e.deleted_at IS NULL
       WHERE sp.participant_id = $1
       AND sp.deleted_at IS NOT NULL
       GROUP BY s.id, s.title, s.description, s.deadline, s.start_date, s.end_date, sp.deleted_at
       HAVING COUNT(DISTINCT et.id) > 0 
       AND COUNT(DISTINCT et.id) = COUNT(DISTINCT e.id)
       ORDER BY sp.deleted_at DESC`,
      [userId]
    );

    res.json({ studies: result.rows });
  } catch (err) {
    console.error('[GET /studies/completed/trash] Error:', err);
    res.status(500).json({ error: 'Failed to fetch deleted completed studies' });
  }
});

// POST /api/participant/studies/completed/:id/restore -> restore a deleted completed study
router.post('/studies/completed/:id/restore', async (req, res) => {
  try {
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);

    // Verify study_participants record exists and is deleted
    const checkResult = await pool.query(
      'SELECT id FROM study_participants WHERE study_id = $1 AND participant_id = $2 AND deleted_at IS NOT NULL',
      [studyId, userId]
    );

    if (checkResult.rowCount === 0) {
      return res.status(404).json({ error: 'Deleted study not found in trash bin' });
    }

    // Restore the study_participants record
    await pool.query(
      'UPDATE study_participants SET deleted_at = NULL, deleted_by = NULL WHERE study_id = $1 AND participant_id = $2',
      [studyId, userId]
    );

    res.json({ success: true, message: 'Study restored from trash bin' });
  } catch (err) {
    console.error('[POST /studies/completed/:id/restore] Error:', err);
    res.status(500).json({ error: 'Failed to restore study' });
  }
});

// DELETE /api/participant/studies/completed/:id/permanent -> permanently delete a completed study from trash
router.delete('/studies/completed/:id/permanent', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userId = req.user.id;
    const studyId = parseInt(req.params.id, 10);

    // Verify study_participants record exists and is deleted
    const checkResult = await client.query(
      'SELECT id FROM study_participants WHERE study_id = $1 AND participant_id = $2 AND deleted_at IS NOT NULL',
      [studyId, userId]
    );

    if (checkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Deleted study not found in trash bin' });
    }

    // Permanently delete the study_participants record
    // Note: This only removes the participant's enrollment record, not the study or evaluations
    await client.query(
      'DELETE FROM study_participants WHERE study_id = $1 AND participant_id = $2',
      [studyId, userId]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Study permanently deleted from trash bin. Evaluations remain in database for researchers.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[DELETE /studies/completed/:id/permanent] Error:', err);
    res.status(500).json({ error: 'Failed to permanently delete study' });
  } finally {
    client.release();
  }
});

// ========== EVALUATION TRASH BIN ENDPOINTS ==========

// GET /api/participant/evaluations/trash -> get all deleted evaluations for the participant
router.get('/evaluations/trash', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        e.id,
        e.task_id,
        e.completed_at,
        e.deleted_at,
        et.study_id,
        s.title AS study_title,
        et.task_type,
        et.instructions
       FROM evaluations e
       JOIN evaluation_tasks et ON e.task_id = et.id
       JOIN studies s ON et.study_id = s.id
       WHERE e.participant_id = $1 
       AND e.deleted_at IS NOT NULL
       ORDER BY e.deleted_at DESC`,
      [userId]
    );

    res.json({ evaluations: result.rows });
  } catch (err) {
    console.error('[GET /evaluations/trash] Error:', err);
    res.status(500).json({ error: 'Failed to fetch deleted evaluations' });
  }
});

// DELETE /api/participant/evaluations/:id -> soft delete an evaluation
router.delete('/evaluations/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const evaluationId = parseInt(req.params.id, 10);

    // Verify evaluation exists and belongs to the participant
    const evalCheck = await pool.query(
      'SELECT id FROM evaluations WHERE id = $1 AND participant_id = $2 AND deleted_at IS NULL',
      [evaluationId, userId]
    );

    if (evalCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Evaluation not found or already deleted' });
    }

    // Soft delete the evaluation
    await pool.query(
      'UPDATE evaluations SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2',
      [userId, evaluationId]
    );

    res.json({ success: true, message: 'Evaluation moved to trash bin' });
  } catch (err) {
    console.error('[DELETE /evaluations/:id] Error:', err);
    res.status(500).json({ error: 'Failed to delete evaluation' });
  }
});

// POST /api/participant/evaluations/:id/restore -> restore a deleted evaluation
router.post('/evaluations/:id/restore', async (req, res) => {
  try {
    const userId = req.user.id;
    const evaluationId = parseInt(req.params.id, 10);

    // Verify evaluation exists and belongs to the participant
    const evalCheck = await pool.query(
      'SELECT id FROM evaluations WHERE id = $1 AND participant_id = $2 AND deleted_at IS NOT NULL',
      [evaluationId, userId]
    );

    if (evalCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Deleted evaluation not found' });
    }

    // Restore the evaluation
    await pool.query(
      'UPDATE evaluations SET deleted_at = NULL, deleted_by = NULL WHERE id = $1',
      [evaluationId]
    );

    res.json({ success: true, message: 'Evaluation restored' });
  } catch (err) {
    console.error('[POST /evaluations/:id/restore] Error:', err);
    res.status(500).json({ error: 'Failed to restore evaluation' });
  }
});

// DELETE /api/participant/evaluations/:id/permanent -> permanently delete an evaluation
router.delete('/evaluations/:id/permanent', async (req, res) => {
  try {
    const userId = req.user.id;
    const evaluationId = parseInt(req.params.id, 10);

    // Verify evaluation exists, belongs to the participant, and is deleted
    const evalCheck = await pool.query(
      'SELECT id FROM evaluations WHERE id = $1 AND participant_id = $2 AND deleted_at IS NOT NULL',
      [evaluationId, userId]
    );

    if (evalCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Deleted evaluation not found' });
    }

    // Permanently delete the evaluation
    await pool.query('DELETE FROM evaluations WHERE id = $1', [evaluationId]);

    res.json({ success: true, message: 'Evaluation permanently deleted' });
  } catch (err) {
    console.error('[DELETE /evaluations/:id/permanent] Error:', err);
    res.status(500).json({ error: 'Failed to permanently delete evaluation' });
  }
});

// ========== QUIZ ATTEMPT TRASH BIN ENDPOINTS ==========

// GET /api/participant/quiz-attempts/trash -> get all deleted quiz attempts for the participant
router.get('/quiz-attempts/trash', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        qa.id,
        qa.quiz_id,
        qa.score,
        qa.passed,
        qa.grading_status,
        qa.submitted_at,
        qa.deleted_at,
        q.title AS quiz_title,
        q.description AS quiz_description,
        s.id AS study_id,
        s.title AS study_title
       FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.id
       LEFT JOIN studies s ON q.study_id = s.id
       WHERE qa.user_id = $1 
       AND qa.deleted_at IS NOT NULL
       ORDER BY qa.deleted_at DESC`,
      [userId]
    );

    res.json({ quizAttempts: result.rows });
  } catch (err) {
    console.error('[GET /quiz-attempts/trash] Error:', err);
    res.status(500).json({ error: 'Failed to fetch deleted quiz attempts' });
  }
});

// DELETE /api/participant/quiz-attempts/:id -> soft delete a quiz attempt
router.delete('/quiz-attempts/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const attemptId = parseInt(req.params.id, 10);

    // Verify quiz attempt exists and belongs to the participant
    const attemptCheck = await pool.query(
      'SELECT id FROM quiz_attempts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [attemptId, userId]
    );

    if (attemptCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Quiz attempt not found or already deleted' });
    }

    // Soft delete the quiz attempt
    await pool.query(
      'UPDATE quiz_attempts SET deleted_at = CURRENT_TIMESTAMP, deleted_by = $1 WHERE id = $2',
      [userId, attemptId]
    );

    res.json({ success: true, message: 'Quiz attempt moved to trash bin' });
  } catch (err) {
    console.error('[DELETE /quiz-attempts/:id] Error:', err);
    res.status(500).json({ error: 'Failed to delete quiz attempt' });
  }
});

// POST /api/participant/quiz-attempts/:id/restore -> restore a deleted quiz attempt
router.post('/quiz-attempts/:id/restore', async (req, res) => {
  try {
    const userId = req.user.id;
    const attemptId = parseInt(req.params.id, 10);

    // Verify quiz attempt exists and belongs to the participant
    const attemptCheck = await pool.query(
      'SELECT id FROM quiz_attempts WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL',
      [attemptId, userId]
    );

    if (attemptCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Deleted quiz attempt not found' });
    }

    // Restore the quiz attempt
    await pool.query(
      'UPDATE quiz_attempts SET deleted_at = NULL, deleted_by = NULL WHERE id = $1',
      [attemptId]
    );

    res.json({ success: true, message: 'Quiz attempt restored' });
  } catch (err) {
    console.error('[POST /quiz-attempts/:id/restore] Error:', err);
    res.status(500).json({ error: 'Failed to restore quiz attempt' });
  }
});

// DELETE /api/participant/quiz-attempts/:id/permanent -> permanently delete a quiz attempt
router.delete('/quiz-attempts/:id/permanent', async (req, res) => {
  try {
    const userId = req.user.id;
    const attemptId = parseInt(req.params.id, 10);

    // Verify quiz attempt exists, belongs to the participant, and is deleted
    const attemptCheck = await pool.query(
      'SELECT id FROM quiz_attempts WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL',
      [attemptId, userId]
    );

    if (attemptCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Deleted quiz attempt not found' });
    }

    // Permanently delete the quiz attempt
    await pool.query('DELETE FROM quiz_attempts WHERE id = $1', [attemptId]);

    res.json({ success: true, message: 'Quiz attempt permanently deleted' });
  } catch (err) {
    console.error('[DELETE /quiz-attempts/:id/permanent] Error:', err);
    res.status(500).json({ error: 'Failed to permanently delete quiz attempt' });
  }
});

module.exports = router;
