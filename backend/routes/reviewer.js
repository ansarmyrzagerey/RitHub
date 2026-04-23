const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');

// Protect all reviewer routes
router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== 'reviewer' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: reviewers only' });
  }
  next();
});

// Notifications for reviewer
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = parseInt(req.query.offset, 10) || 0;
    const q = `SELECT id, title, body, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const { rows } = await pool.query(q, [userId, limit, offset]);
    const countQ = await pool.query('SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1', [userId]);
    const total = countQ.rows[0]?.total || 0;
    res.json({ notifications: rows, total, limit, offset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

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

// Assign reviewer to study when clicking a notification link
router.post('/assignments', async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { studyId } = req.body;
    if (!studyId) return res.status(400).json({ error: 'studyId required' });
    // Upsert assignment
    await pool.query(
      `INSERT INTO reviewer_assignments (study_id, reviewer_id)
       VALUES ($1, $2)
       ON CONFLICT (study_id, reviewer_id) DO NOTHING`,
      [studyId, reviewerId]
    );

    // Remove pending flag notifications for this study so other reviewers don't keep seeing it (keep current user's)
    await pool.query(
      `DELETE FROM notifications n
       USING users u
       WHERE n.user_id = u.id
         AND u.role = 'reviewer'
         AND n.user_id <> $2
         AND n.link = $1`,
      [`/studies/${studyId}`, reviewerId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign reviewer' });
  }
});

// Assign reviewer to study by evaluation id
router.post('/assignments/by-evaluation', async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { evaluationId } = req.body;
    if (!evaluationId) return res.status(400).json({ error: 'evaluationId required' });
    const q = await pool.query(
      `SELECT et.study_id FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE ev.id = $1`,
      [evaluationId]
    );
    const studyId = q.rows[0]?.study_id;
    if (!studyId) return res.status(404).json({ error: 'Study not found for evaluation' });
    await pool.query(
      `INSERT INTO reviewer_assignments (study_id, reviewer_id)
       VALUES ($1, $2)
       ON CONFLICT (study_id, reviewer_id) DO NOTHING`,
      [studyId, reviewerId]
    );

    // Remove flag notifications for this study for other reviewers so others don't pick it up (keep current user's)
    await pool.query(
      `DELETE FROM notifications n
       USING users u
       WHERE n.user_id = u.id
         AND u.role = 'reviewer'
         AND n.user_id <> $2
         AND n.link = $1`,
      [`/studies/${studyId}`, reviewerId]
    );

    res.json({ success: true, studyId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign reviewer by evaluation' });
  }
});

// GET /api/reviewer/studies - studies assigned to reviewer with completion%
router.get('/studies', async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const { search } = req.query;
    let q = `SELECT s.id, s.title, s.status, s.deadline, s.enrolled_count, s.participant_capacity
             FROM studies s
             JOIN reviewer_assignments ra ON ra.study_id = s.id AND ra.reviewer_id = $1`;
    const params = [reviewerId];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND s.title ILIKE $${params.length}`;
    }
    q += ' ORDER BY s.created_at DESC';
    const { rows } = await pool.query(q, params);

    const out = await Promise.all(rows.map(async (s) => {
      const pQ = `SELECT COUNT(*)::int AS participant_count FROM study_participants WHERE study_id = $1`;
      const tasksCountQ = await pool.query('SELECT COUNT(*)::int AS tasks FROM evaluation_tasks WHERE study_id = $1', [s.id]);
      const completedEvalQ = await pool.query(
        `SELECT COUNT(*)::int AS completed FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE et.study_id = $1`, [s.id]
      );
      const participant_count = (await pool.query(pQ, [s.id])).rows[0].participant_count || 0;
      const tasks = tasksCountQ.rows[0].tasks || 0;
      const completed = completedEvalQ.rows[0].completed || 0;
      const possible = Math.max(1, tasks * Math.max(1, participant_count));
      const completion_pct = Math.round((completed / possible) * 100);
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        participant_count,
        completion_pct,
        deadline: s.deadline,
        enrolled_count: s.enrolled_count,
        participant_capacity: s.participant_capacity
      };
    }));

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch studies' });
  }
});

// Reuse analytics similar to researcher endpoint
router.get('/studies/:id/analytics', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id, 10);
    const tasksQ = await pool.query('SELECT COUNT(*)::int AS total_tasks FROM evaluation_tasks WHERE study_id = $1', [studyId]);
    const totalTasks = tasksQ.rows[0].total_tasks || 0;
    const perParticipantQ = await pool.query(
      `SELECT ev.participant_id, COUNT(ev.id)::int AS completed_tasks FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE et.study_id = $1 GROUP BY ev.participant_id`,
      [studyId]
    );
    const buckets = { zero: 0, lt50: 0, gte50lt100: 0, complete: 0 };
    perParticipantQ.rows.forEach(r => {
      const pct = totalTasks === 0 ? 0 : (r.completed_tasks / totalTasks) * 100;
      if (pct === 0) buckets.zero += 1;
      else if (pct < 50) buckets.lt50 += 1;
      else if (pct < 100) buckets.gte50lt100 += 1;
      else buckets.complete += 1;
    });
    const ratingsQ = await pool.query(`SELECT jsonb_array_elements_text(ratings) AS rating FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE et.study_id = $1`, [studyId]);
    const ratingCounts = {};
    ratingsQ.rows.forEach(r => { const val = Number(r.rating); if (!isNaN(val)) ratingCounts[val] = (ratingCounts[val] || 0) + 1; });
    const annotQ = await pool.query(`SELECT jsonb_array_length(annotations) AS len FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE et.study_id = $1`, [studyId]);
    let totalAnn = 0; let annCount = 0; annotQ.rows.forEach(r => { if (r.len) { totalAnn += r.len; annCount += 1; } });
    const avgAnnotation = annCount === 0 ? 0 : (totalAnn / annCount);
    res.json({ funnel: buckets, ratingCounts, avgAnnotation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Unflag evaluation (small button on reviewer dashboard)
router.patch('/evaluations/:id/unflag', async (req, res) => {
  try {
    const evaluationId = parseInt(req.params.id, 10);
    
    // Find the study for this evaluation
    const studyQ = await pool.query(
      `SELECT et.study_id FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE ev.id = $1`,
      [evaluationId]
    );
    const studyId = studyQ.rows[0]?.study_id;
    
    // Update evaluation flag status
    await pool.query('UPDATE evaluations SET flagged = false, reflagged = false WHERE id = $1', [evaluationId]);
    
    // Check if any other flagged evaluations remain in this study
    if (studyId) {
      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM evaluations ev
         JOIN evaluation_tasks et ON ev.task_id = et.id
         WHERE et.study_id = $1 AND ev.flagged = true`,
        [studyId]
      );
      const stillFlagged = remaining.rows[0]?.cnt || 0;
      
      // If no flagged evaluations remain, delete the study-level notification for all reviewers
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
    console.error(err);
    res.status(500).json({ error: 'Failed to unflag evaluation' });
  }
});

// Re-flag evaluation -> notify admins
router.post('/evaluations/:id/flag', async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);
    await pool.query('UPDATE evaluations SET flagged = true, reflagged = true WHERE id = $1', [evalId]);
    const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    const targets = admins.rows.map(r => r.id);
    const notePromises = targets.map(uid => pool.query('INSERT INTO notifications (user_id, title, body, link) VALUES ($1,$2,$3,$4)', [uid, 'Evaluation re-flagged', `Evaluation ${evalId} re-flagged by reviewer`, `/evaluations/${evalId}`]));
    await Promise.all(notePromises);
    res.json({ success: true, notified: targets.length, flagged: true, reflagged: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to flag evaluation' });
  }
});

// Delete notifications for a specific evaluation (called after unflag/reflag)
router.delete('/notifications/evaluation/:id', async (req, res) => {
  try {
    const reviewerId = req.user.id;
    const evaluationId = parseInt(req.params.id, 10);
    // Delete notifications for this reviewer that link to this evaluation
    await pool.query(
      `DELETE FROM notifications WHERE user_id = $1 AND link LIKE $2`,
      [reviewerId, `%/evaluations/${evaluationId}%`]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

module.exports = router;
