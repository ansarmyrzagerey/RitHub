const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;
const XLSX = require('xlsx');
// pdfkit and stream-buffers are required lazily inside the export handler

// Protect all researcher routes - allow researchers, admins, and reviewers (reviewers need read access)
router.use(auth);
router.use((req, res, next) => {
  if (req.user.role !== 'researcher' && req.user.role !== 'admin' && req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'Access denied: researchers only' });
  }
  next();
});

// Notifications (reuse same table)
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 most recent
    const offset = parseInt(req.query.offset, 10) || 0;
    
    // Get notifications with limit
    const q = `SELECT id, title, body, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const { rows } = await pool.query(q, [userId, limit, offset]);
    
    // Get total count for pagination
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

// DELETE /api/researcher/notifications/:id - delete notification
router.delete('/notifications/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    const q = `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`;
    const { rows } = await pool.query(q, [id, userId]);
    if (!rows[0]) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// GET /api/researcher/studies - list studies created by researcher with completion% and participant count
router.get('/studies', async (req, res) => {
  try {
    const userId = req.user.id;
    const { search, start, end } = req.query;
    
    // Debug logging
    console.log('[Researcher Studies Filter] Params:', { search, start, end });

    let q = `SELECT s.id, s.title, s.description, s.deadline, s.status, s.enrolled_count, s.participant_capacity, s.start_date, s.end_date
             FROM studies s
             WHERE s.created_by = $1`;
    const params = [userId];

    // Search by title
    if (search) {
      params.push(`%${search}%`);
      q += ` AND s.title ILIKE $${params.length}`;
    }
    
    // Filter by start date (created_at)
    if (start) { 
      params.push(start); 
      q += ` AND s.created_at::date = $${params.length}::date`; 
    }
    
    // Filter by end date (deadline)
    if (end) { 
      params.push(end); 
      q += ` AND s.deadline IS NOT NULL AND s.deadline::date = $${params.length}::date`; 
    }

    q += ' ORDER BY s.created_at DESC';

    console.log('[Researcher Studies Filter] Final query:', q);
    console.log('[Researcher Studies Filter] Query params:', params);

    const { rows } = await pool.query(q, params);

    const out = await Promise.all(rows.map(async (s) => {
      const pQ = `SELECT COUNT(*)::int AS participant_count FROM study_participants WHERE study_id = $1`;
      const cQ = `SELECT
        COALESCE(SUM(CASE WHEN tp.status = 'completed' THEN 1 ELSE 0 END),0) AS completed,
        COALESCE(COUNT(tp.*),0) AS total_progress_entries
        FROM evaluation_tasks et
        LEFT JOIN task_progress tp ON tp.task_id = et.id`;
      const p = await pool.query(pQ, [s.id]);
      const t = await pool.query(cQ, []);
      const participant_count = p.rows[0].participant_count || 0;

      // compute completion percentage as completed tasks / (total_tasks * participants) if possible
      const tasksCountQ = await pool.query('SELECT COUNT(*)::int AS tasks FROM evaluation_tasks WHERE study_id = $1', [s.id]);
      const tasks = tasksCountQ.rows[0].tasks || 0;
      // count completed evaluations for study
      const completedEvalQ = await pool.query(
        `SELECT COUNT(*)::int AS completed FROM evaluations ev JOIN evaluation_tasks et ON ev.task_id = et.id WHERE et.study_id = $1`, [s.id]
      );
      const completed = completedEvalQ.rows[0].completed || 0;

      const possible = Math.max(1, tasks * Math.max(1, participant_count));
      const completion_pct = Math.round((completed / possible) * 100);

      return {
        id: s.id,
        title: s.title,
        status: s.status,
        participant_count: participant_count,
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

// GET /api/researcher/studies/:id/participants - participant status counts
router.get('/studies/:id/participants', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify study ownership (unless admin/reviewer)
    const studyCheck = await pool.query(
      'SELECT id, created_by FROM studies WHERE id = $1',
      [studyId]
    );
    if (studyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    if (userRole !== 'admin' && userRole !== 'reviewer' && studyCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this study' });
    }
    
    // statuses: enrolled (in study_participants), left (not implemented), in_progress/done from task_progress/evaluations

    const enrolledQ = await pool.query('SELECT COUNT(*)::int AS cnt FROM study_participants WHERE study_id = $1', [studyId]);
    const enrolled = enrolledQ.rows[0].cnt || 0;

    // Get total tasks for the study
    const tasksCountQ = await pool.query('SELECT COUNT(*)::int AS total FROM evaluation_tasks WHERE study_id = $1', [studyId]);
    const totalTasks = tasksCountQ.rows[0].total || 0;

    // Get participants with their completed task counts
    const participantProgressQ = await pool.query(
      `SELECT ev.participant_id, COUNT(DISTINCT ev.task_id)::int AS completed_tasks 
       FROM evaluations ev 
       JOIN evaluation_tasks et ON ev.task_id = et.id 
       WHERE et.study_id = $1 
       GROUP BY ev.participant_id`,
      [studyId]
    );

    let inProgress = 0;
    let done = 0;

    participantProgressQ.rows.forEach(row => {
      if (totalTasks > 0 && row.completed_tasks >= totalTasks) {
        done += 1;
      } else if (row.completed_tasks > 0) {
        inProgress += 1;
      }
    });

    res.json({ enrolled, inProgress, done });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch participant statuses' });
  }
});

// GET /api/researcher/studies/:id/analytics - basic task analytics
router.get('/studies/:id/analytics', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify study ownership (unless admin/reviewer)
    const studyCheck = await pool.query(
      'SELECT id, created_by FROM studies WHERE id = $1',
      [studyId]
    );
    if (studyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    if (userRole !== 'admin' && userRole !== 'reviewer' && studyCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this study' });
    }

    // progress funnel: counts of participants with 0%, <50%, >=50% <100%, 100%
    // We'll approximate using evaluations count per participant
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

    // Fetch all evaluations for this study
    const evalsQ = await pool.query(
      `SELECT ev.ratings, ev.annotations
       FROM evaluations ev
       JOIN evaluation_tasks et ON ev.task_id = et.id
       WHERE et.study_id = $1`,
      [studyId]
    );

    // rating distribution: count numeric rating values across evaluations
    const ratingCounts = {};
    // annotation density: count of annotations per evaluation (screenshots, highlights, artifactHighlights)
    let totalAnn = 0; let annEvaluations = 0;

    evalsQ.rows.forEach(row => {
      // Ratings can be a JSON object like {artifact1: 3, artifact2: 4}
      let ratings = row.ratings;
      if (typeof ratings === 'string') {
        try { ratings = JSON.parse(ratings); } catch { ratings = {}; }
      }
      if (ratings && typeof ratings === 'object') {
        Object.values(ratings).forEach(val => {
          const num = Number(val);
          // Only count ratings 1-5, exclude 0 (unset ratings)
          if (!isNaN(num) && num > 0) ratingCounts[num] = (ratingCounts[num] || 0) + 1;
        });
      }

      // Annotations is an object containing arrays and nested arrays
      let annotations = row.annotations;
      if (typeof annotations === 'string') {
        try { annotations = JSON.parse(annotations); } catch { annotations = {}; }
      }
      let countForEval = 0;
      if (annotations && typeof annotations === 'object') {
        const screenshots = Array.isArray(annotations.screenshots) ? annotations.screenshots.length : 0;
        const highlights = Array.isArray(annotations.highlights) ? annotations.highlights.length : 0;
        let artifactHL = 0;
        if (annotations.artifactHighlights && typeof annotations.artifactHighlights === 'object') {
          Object.values(annotations.artifactHighlights).forEach(arr => {
            if (Array.isArray(arr)) artifactHL += arr.length;
          });
        }
        countForEval = screenshots + highlights + artifactHL;
      }
      if (countForEval > 0) {
        totalAnn += countForEval;
        annEvaluations += 1;
      }
    });

    const avgAnnotation = annEvaluations === 0 ? 0 : (totalAnn / annEvaluations);

    res.json({ funnel: buckets, ratingCounts, avgAnnotation: Number(avgAnnotation.toFixed(2)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/researcher/artifacts - artifact usage insights
router.get('/artifacts', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { study, type, start, end, metric } = req.query;
    
    // compute usage count per artifact from evaluation_tasks referencing artifact ids
    // Filter by user ownership unless admin/reviewer
    const q = `SELECT a.id, a.name, a.type, COUNT(et.id)::int AS usage_count
               FROM artifacts a
               LEFT JOIN evaluation_tasks et ON (et.artifact1_id = a.id OR et.artifact2_id = a.id OR et.artifact3_id = a.id)
               WHERE a.uploaded_by = $1
               GROUP BY a.id ORDER BY usage_count DESC LIMIT 50`;
    const { rows } = await pool.query(q, [userId]);
    // if metric requested compute average rating per artifact
    const out = await Promise.all(rows.map(async (r) => {
      const ratingQ = await pool.query(
        `SELECT ev.ratings, et.artifact1_id, et.artifact2_id, et.artifact3_id
         FROM evaluations ev 
         JOIN evaluation_tasks et ON ev.task_id = et.id 
         WHERE (et.artifact1_id = $1 OR et.artifact2_id = $1 OR et.artifact3_id = $1)`,
        [r.id]
      );
      // flatten numeric ratings for THIS artifact only - handle array/object formats
      let sum = 0; let cnt = 0; let median = null; const arr = [];
      ratingQ.rows.forEach(rr => {
        try {
          const targetPositions = [];
          if (rr.artifact1_id === r.id) targetPositions.push(1);
          if (rr.artifact2_id === r.id) targetPositions.push(2);
          if (rr.artifact3_id === r.id) targetPositions.push(3);

          let ratings = rr.ratings;
          if (!ratings) return;

          if (typeof ratings === 'string') {
            try { ratings = JSON.parse(ratings); } catch { ratings = null; }
          }
          if (!ratings) return;

          if (Array.isArray(ratings)) {
            // Array format: assume positions align with artifact1/2/3 (1-based -> index 0/1/2)
            targetPositions.forEach(pos => {
              const v = Number(ratings[pos - 1]);
              if (!isNaN(v) && v > 0) { sum += v; cnt += 1; arr.push(v); }
            });
          } else if (typeof ratings === 'object') {
            targetPositions.forEach(pos => {
              const keys = [`artifact${pos}`, `artifact_${pos}`, `${pos}`];
              keys.forEach(k => {
                if (Object.prototype.hasOwnProperty.call(ratings, k)) {
                  const v = Number(ratings[k]);
                  if (!isNaN(v) && v > 0) { sum += v; cnt += 1; arr.push(v); }
                }
              });
            });
          }
        } catch (e) {
          console.error('Error parsing ratings:', e);
        }
      });
      if (arr.length > 0) {
        arr.sort((a,b) => a-b);
        const mid = Math.floor(arr.length/2);
        median = arr.length %2 ===0 ? (arr[mid-1]+arr[mid])/2 : arr[mid];
      }
      const avg = cnt === 0 ? null : (sum / cnt);
      return { ...r, avgRating: avg !== null ? Math.round(avg * 10) / 10 : null, medianRating: median !== null ? Math.round(median * 10) / 10 : null };
    }));

    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch artifact insights' });
  }
});

// POST /api/researcher/export -> comprehensive study export with analytics
router.post('/export', async (req, res) => {
  try {
    const { studyId, format = 'csv' } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get study details
    const studyQ = await pool.query(
      (userRole === 'admin' || userRole === 'reviewer')
        ? 'SELECT id, title, description, status, created_at, deadline FROM studies WHERE id = $1'
        : 'SELECT id, title, description, status, created_at, deadline FROM studies WHERE id = $1 AND created_by = $2',
      (userRole === 'admin' || userRole === 'reviewer') ? [studyId] : [studyId, userId]
    );
    if (studyQ.rowCount === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    const study = studyQ.rows[0];

    // Get participant statistics
    const enrolledQ = await pool.query('SELECT COUNT(*)::int AS cnt FROM study_participants WHERE study_id = $1', [studyId]);
    const enrolled = enrolledQ.rows[0].cnt || 0;

    const tasksCountQ = await pool.query('SELECT COUNT(*)::int AS total FROM evaluation_tasks WHERE study_id = $1', [studyId]);
    const totalTasks = tasksCountQ.rows[0].total || 0;

    const participantProgressQ = await pool.query(
      `SELECT ev.participant_id, COUNT(DISTINCT ev.task_id)::int AS completed_tasks 
       FROM evaluations ev 
       JOIN evaluation_tasks et ON ev.task_id = et.id 
       WHERE et.study_id = $1 
       GROUP BY ev.participant_id`,
      [studyId]
    );

    let inProgress = 0, done = 0, waiting = 0;
    participantProgressQ.rows.forEach(row => {
      if (totalTasks > 0 && row.completed_tasks >= totalTasks) {
        done += 1;
      } else if (row.completed_tasks > 0) {
        inProgress += 1;
      }
    });
    waiting = enrolled - (inProgress + done);

    // Get artifacts used in study
    const artifactsQ = await pool.query(
      `SELECT DISTINCT a.id, a.name, a.type, a.content 
       FROM artifacts a 
       JOIN evaluation_tasks et ON (et.artifact1_id = a.id OR et.artifact2_id = a.id OR et.artifact3_id = a.id) 
       WHERE et.study_id = $1 
       ORDER BY a.id`,
      [studyId]
    );
    const artifacts = artifactsQ.rows;

    // Get task analytics (same logic as task-analytics endpoint)
    const tasksQ = await pool.query(
      `SELECT et.id, et.task_type, et.instructions, et.answer_type, et.answer_options, et.artifact1_id, et.artifact2_id, et.artifact3_id, et.created_at
       FROM evaluation_tasks et
       WHERE et.study_id = $1
       ORDER BY et.created_at`,
      [studyId]
    );

    // Build artifact map for names/types
    const artifactIds = [];
    tasksQ.rows.forEach(t => {
      if (t.artifact1_id) artifactIds.push(t.artifact1_id);
      if (t.artifact2_id) artifactIds.push(t.artifact2_id);
      if (t.artifact3_id) artifactIds.push(t.artifact3_id);
    });
    let artifactMap = {};
    if (artifactIds.length > 0) {
      const artQ = await pool.query('SELECT id, name, type, content FROM artifacts WHERE id = ANY($1::int[])', [artifactIds]);
      artQ.rows.forEach(a => { artifactMap[a.id] = a; });
    }

    const taskAnalytics = [];
    for (const task of tasksQ.rows) {
      const evalsQ = await pool.query(
        `SELECT ev.id, ev.participant_id, ev.ratings, ev.annotations, ev.comments, ev.completed_at
         FROM evaluations ev
         WHERE ev.task_id = $1`,
        [task.id]
      );

      const completedBy = evalsQ.rows.length;
      let avgAnnotations = 0;
      let avgRating = null;
      let choiceDistribution = {};

      // Calculate annotations average (count actual items in arrays)
      let totalAnnotations = 0;
      let annotationCount = 0;
      evalsQ.rows.forEach(e => {
        const ann = e.annotations || {};
        let evalAnnotationCount = 0;
        
        // Count screenshots
        if (Array.isArray(ann.screenshots)) {
          evalAnnotationCount += ann.screenshots.length;
        }
        // Count highlights
        if (Array.isArray(ann.highlights)) {
          evalAnnotationCount += ann.highlights.length;
        }
        // Count artifactHighlights (object with artifact1, artifact2, etc. arrays)
        if (ann.artifactHighlights && typeof ann.artifactHighlights === 'object') {
          Object.values(ann.artifactHighlights).forEach(arr => {
            if (Array.isArray(arr)) {
              evalAnnotationCount += arr.length;
            }
          });
        }
        
        if (evalAnnotationCount > 0) {
          totalAnnotations += evalAnnotationCount;
          annotationCount += 1;
        }
      });
      if (annotationCount > 0) {
        avgAnnotations = totalAnnotations / annotationCount;
      }

      // Calculate ratings or choice distribution based on answer_type
      if (task.answer_type === 'rating' || !task.answer_type) {
        const allRatings = [];
        evalsQ.rows.forEach(e => {
          if (e.ratings && typeof e.ratings === 'object') {
            Object.values(e.ratings).forEach(r => {
              const val = Number(r);
              // Only count ratings > 0, exclude unset/default ratings
              if (!isNaN(val) && val > 0) allRatings.push(val);
            });
          }
        });
        if (allRatings.length > 0) {
          avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
        }
      } else if (task.answer_type === 'choice' || task.answer_type === 'choice_required_text') {
        const choiceCounts = {};
        evalsQ.rows.forEach(e => {
          const choice = e.annotations?.choice;
          if (choice) {
            const normalized = choice.replace(/_/g, ' ').replace(/artifact (\d+)/i, 'Artifact $1');
            choiceCounts[normalized] = (choiceCounts[normalized] || 0) + 1;
          }
        });

        const total = Object.values(choiceCounts).reduce((a, b) => a + b, 0);
        if (total > 0) {
          Object.keys(choiceCounts).forEach(key => {
            choiceDistribution[key] = `${Math.round((choiceCounts[key] / total) * 100)}%`;
          });
        }
      }

      // Derive a friendly task name: use instructions.title if present, else Q{index}
      const idx = tasksQ.rows.findIndex(x => x.id === task.id);
      const derivedName = (task.instructions && task.instructions.title) ? task.instructions.title : `Q${idx + 1}`;

      taskAnalytics.push({
        task_id: task.id,
        task_name: derivedName,
        answer_type: task.answer_type || 'rating',
        completed_by: completedBy,
        avg_annotations: Math.round(avgAnnotations * 10) / 10,
        avg_rating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
        choice_distribution: Object.keys(choiceDistribution).length > 0 ? choiceDistribution : null,
        artifact1_id: task.artifact1_id || null,
        artifact2_id: task.artifact2_id || null,
        artifact3_id: task.artifact3_id || null
      });
    }

    // Get evaluation list
    const evaluationsQ = await pool.query(
      `SELECT ev.id, ev.participant_id, ev.task_id, ev.ratings, ev.annotations, ev.comments, ev.completed_at,
              COALESCE(ev.flagged, false) as flagged,
              et.answer_type
       FROM evaluations ev
       JOIN evaluation_tasks et ON ev.task_id = et.id
       WHERE et.study_id = $1
       ORDER BY ev.participant_id, ev.completed_at`,
      [studyId]
    );

    const evaluations = evaluationsQ.rows.map(e => ({
      evaluation_id: e.id,
      participant_id: e.participant_id,
      task_id: e.task_id,
      task_name: (tasksQ.rows.find(t => t.id === e.task_id) && tasksQ.rows.find(t => t.id === e.task_id).instructions && tasksQ.rows.find(t => t.id === e.task_id).instructions.title) 
        ? tasksQ.rows.find(t => t.id === e.task_id).instructions.title 
        : `Q${tasksQ.rows.findIndex(t => t.id === e.task_id) + 1}`,
      answer_type: e.answer_type || 'rating',
      ratings: JSON.stringify(e.ratings),
      choice: e.annotations?.choice || '',
      choice_explanation: e.annotations?.text || '',
      screenshots: e.annotations?.screenshots || [],
      artifacts_evaluated: [
        tasksQ.rows.find(t => t.id === e.task_id)?.artifact1_id ? (artifactMap[tasksQ.rows.find(t => t.id === e.task_id).artifact1_id]?.name || `Artifact 1`) : null,
        tasksQ.rows.find(t => t.id === e.task_id)?.artifact2_id ? (artifactMap[tasksQ.rows.find(t => t.id === e.task_id).artifact2_id]?.name || `Artifact 2`) : null,
        tasksQ.rows.find(t => t.id === e.task_id)?.artifact3_id ? (artifactMap[tasksQ.rows.find(t => t.id === e.task_id).artifact3_id]?.name || `Artifact 3`) : null
      ].filter(Boolean),
      annotations_count: e.annotations ? Object.keys(e.annotations).filter(k => k !== 'choice' && k !== 'text' && e.annotations[k]).length : 0,
      comments: e.comments || '',
      completed_at: e.completed_at,
      flagged: e.flagged || false
    }));

    // Generate exports based on format
    if (format === 'csv') {
      let csvContent = '';

      // Helper function to escape CSV values
      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Study Overview
      csvContent += 'STUDY OVERVIEW\n';
      csvContent += `Title,${escapeCSV(study.title)}\n`;
      csvContent += `Status,${escapeCSV(study.status)}\n`;
      csvContent += `Total Participants,${enrolled}\n`;
      csvContent += `Completed Participants,${done}\n`;
      csvContent += `In Progress Participants,${inProgress}\n`;
      csvContent += `Waiting Participants,${waiting}\n`;
      csvContent += `Created At,${study.created_at}\n`;
      csvContent += `Deadline,${study.deadline || 'N/A'}\n`;
      csvContent += '\n';

      // Artifacts
      csvContent += 'ARTIFACTS USED\n';
      csvContent += 'ID,Name,Type\n';
      artifacts.forEach(a => {
        csvContent += `${a.id},${escapeCSV(a.name)},${escapeCSV(a.type)}\n`;
      });
      csvContent += '\n';

      // Task Analytics
      csvContent += 'TASK ANALYTICS\n';
      csvContent += 'Task ID,Task Name,Answer Type,Completed By,Avg Annotations,Avg Rating,Choice Distribution\n';
      taskAnalytics.forEach(t => {
        const choiceDist = t.choice_distribution ? JSON.stringify(t.choice_distribution) : 'N/A';
        csvContent += `${t.task_id},${escapeCSV(t.task_name)},${t.answer_type},${t.completed_by},${t.avg_annotations},${t.avg_rating || 'N/A'},${escapeCSV(choiceDist)}\n`;
      });
      csvContent += '\n';

      // Evaluations
      csvContent += 'EVALUATIONS\n';
      csvContent += 'Evaluation ID,Participant ID,Task ID,Answer Type,Ratings,Choice,Choice Explanation,Screenshots,Annotations Count,Comments,Completed At,Flagged\n';
      evaluations.forEach(e => {
        const screenshotsStr = (e.screenshots || [])
          .map(s => (typeof s === 'string' ? s : (s.url || s.fileName || '')))
          .filter(Boolean)
          .join(' | ');
        csvContent += `${e.evaluation_id},${e.participant_id},${e.task_id},${e.answer_type},${escapeCSV(e.ratings)},${escapeCSV(e.choice)},${escapeCSV(e.choice_explanation)},${escapeCSV(screenshotsStr)},${e.annotations_count},${escapeCSV(e.comments)},${e.completed_at},${e.flagged}\n`;
      });

      res.setHeader('Content-disposition', `attachment; filename=study_${studyId}_export.csv`);
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csvContent);
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();

      // Overview sheet (compact summary)
      const overviewData = [
        ['Study Title', study.title],
        ['Status', study.status],
        ['Total Participants', enrolled],
        ['Completed Participants', done],
        ['In Progress Participants', inProgress],
        ['Waiting Participants', waiting],
        ['Created At', study.created_at],
        ['Deadline', study.deadline || 'N/A']
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

      // Artifacts sheet (include content, truncated for readability)
      const artifactsForXlsx = artifacts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        content_preview: (typeof a.content === 'string' && a.content)
          ? (a.content.length > 1000 ? a.content.slice(0, 1000) + '…' : a.content)
          : ''
      }));
      const wsArtifacts = XLSX.utils.json_to_sheet(artifactsForXlsx);
      XLSX.utils.book_append_sheet(wb, wsArtifacts, 'Artifacts');

      // Task Analytics sheet (expand choice distribution to columns per artifact)
      const taskAnalyticsFlat = taskAnalytics.map(t => {
        const row = {
          task_id: t.task_id,
          task_name: t.task_name,
          answer_type: t.answer_type,
          completed_by: t.completed_by,
          avg_annotations: t.avg_annotations,
          avg_rating: t.avg_rating || 'N/A'
        };
        // Add artifact name columns and choice percentage columns
        const a1 = t.artifact1_id ? (artifactMap[t.artifact1_id]?.name || 'Artifact 1') : '';
        const a2 = t.artifact2_id ? (artifactMap[t.artifact2_id]?.name || 'Artifact 2') : '';
        const a3 = t.artifact3_id ? (artifactMap[t.artifact3_id]?.name || 'Artifact 3') : '';
        row.artifact1 = a1;
        row.artifact2 = a2;
        row.artifact3 = a3;

        if (t.choice_distribution) {
          // Normalize labels and map to artifact names where possible
          const getName = (label) => {
            const m = String(label).match(/(artifact)[ _]?(\d+)/i);
            if (m) {
              const pos = Number(m[2]);
              const aid = pos === 1 ? t.artifact1_id : pos === 2 ? t.artifact2_id : pos === 3 ? t.artifact3_id : null;
              return aid && artifactMap[aid] && artifactMap[aid].name ? artifactMap[aid].name : `Artifact ${pos}`;
            }
            return label;
          };
          Object.entries(t.choice_distribution).forEach(([label, pct]) => {
            const name = getName(label);
            row[`choice_${name}`] = pct; // e.g., "50%"
          });
        } else {
          row.choice_summary = 'N/A';
        }
        return row;
      });
      const wsTaskAnalytics = XLSX.utils.json_to_sheet(taskAnalyticsFlat);
      XLSX.utils.book_append_sheet(wb, wsTaskAnalytics, 'Task Analytics');

      // Evaluations sheet (richer fields with mapped names)
      const evaluationsForXlsx = evaluations.map(ev => {
        // Parse ratings object to a compact string
        let ratingsStr = '';
        try {
          const obj = JSON.parse(ev.ratings);
          const vals = Object.values(obj).map(x => Number(x)).filter(v => !isNaN(v));
          ratingsStr = vals.join(', ');
        } catch {
          ratingsStr = ev.ratings;
        }
        // Map choice to artifact name if positional
        let choiceName = ev.choice || '';
        if (choiceName) {
          const taskRow = tasksQ.rows.find(t => t.id === ev.task_id);
          if (taskRow) {
            const m = String(choiceName).match(/artifact[_\s]?(\d+)/i);
            if (m) {
              const pos = Number(m[1]);
              const aid = pos === 1 ? taskRow.artifact1_id : pos === 2 ? taskRow.artifact2_id : pos === 3 ? taskRow.artifact3_id : null;
              if (aid && artifactMap[aid] && artifactMap[aid].name) {
                choiceName = artifactMap[aid].name;
              } else {
                choiceName = `Artifact ${pos}`;
              }
            }
          }
        }
        return {
          evaluation_id: ev.evaluation_id,
          participant_id: ev.participant_id,
          task_id: ev.task_id,
          task_name: ev.task_name,
          artifacts_evaluated: ev.artifacts_evaluated.join(', '),
          answer_type: ev.answer_type,
          ratings: ratingsStr,
          choice: choiceName,
          annotations_count: ev.annotations_count,
          choice_explanation: ev.choice_explanation,
          screenshots: (ev.screenshots || [])
            .map(s => (typeof s === 'string' ? s : (s.url || s.fileName || '')))
            .filter(Boolean)
            .join(' | '),
          comments: ev.comments,
          completed_at: ev.completed_at,
          flagged: ev.flagged
        };
      });
      const wsEvaluations = XLSX.utils.json_to_sheet(evaluationsForXlsx);
      XLSX.utils.book_append_sheet(wb, wsEvaluations, 'Evaluations');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-disposition', `attachment; filename=study_${studyId}_export.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.send(buf);
    }

    if (format === 'pdf') {
      console.log('[PDF Export] Starting PDF generation for study:', studyId);
      let PDFDocument, streamBuffers;
      try {
        PDFDocument = require('pdfkit');
        streamBuffers = require('stream-buffers');
      } catch (e) {
        console.error('PDF libraries not installed:', e && e.message);
        return res.status(500).json({ error: 'PDF libraries not available on server' });
      }

      const doc = new PDFDocument({ autoFirstPage: true, margin: 50 });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        console.log('[PDF Export] PDF generated successfully, size:', pdfBuffer.length, 'bytes');
        res.setHeader('Content-disposition', `attachment; filename=study_${studyId}_export.pdf`);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
      });

      // Title
      doc.fontSize(20).text(`Study Export: ${study.title}`, { align: 'center' });
      doc.moveDown(1);

      // Study Overview
      doc.fontSize(16).text('Study Overview', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Status: ${study.status}`);
      doc.text(`Total Participants: ${enrolled}`);
      doc.text(`Completed: ${done} | In Progress: ${inProgress} | Waiting: ${waiting}`);
      doc.text(`Created: ${new Date(study.created_at).toLocaleDateString()}`);
      doc.text(`Deadline: ${study.deadline ? new Date(study.deadline).toLocaleDateString() : 'N/A'}`);
      doc.moveDown(1.5);

      // Artifacts
      doc.fontSize(16).text('Artifacts Used', { underline: true });
      doc.moveDown(0.5);
      console.log('[PDF Export] Rendering artifacts, count:', artifacts.length);
      if (artifacts.length === 0) {
        doc.fontSize(10).text('No artifacts used');
      } else {
        artifacts.forEach(a => {
          doc.fontSize(12).text(`${a.name} (${a.type})`);
          // Render textual content fully (trim excessive length per artifact)
          try {
            if (a.content && typeof a.content === 'string') {
              const text = a.content.trim();
              const maxLen = 1200; // protect PDF size
              const render = text.length > maxLen ? (text.slice(0, maxLen) + '...') : text;
              doc.fontSize(10).fillColor('#333').text(render, { align: 'left' });
              doc.fillColor('black');
              console.log('[PDF Export] Rendered artifact content:', a.name, '- length:', text.length);
            } else {
              console.log('[PDF Export] No content for artifact:', a.name, '- type:', typeof a.content);
            }
          } catch (err) {
            console.log('[PDF Export] Error rendering artifact:', a.name, err.message);
          }
          doc.moveDown(0.8);
          if (doc.y > 720) doc.addPage();
        });
      }
      doc.moveDown(1.5);

      // Task Analytics
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).text('Task Analytics', { underline: true });
      doc.moveDown(0.5);
      if (taskAnalytics.length === 0) {
        doc.fontSize(10).text('No task analytics available');
      } else {
        taskAnalytics.forEach(t => {
          if (doc.y > 700) doc.addPage();
          doc.fontSize(12).text(`${t.task_name} (${t.answer_type})`);
          doc.fontSize(10).text(`  Completed by: ${t.completed_by} participants`);
          // Align with task analytics API (camelCase fields)
          const avgAnnotations = typeof t.avg_annotations !== 'undefined' ? t.avg_annotations : t.avgAnnotations;
          const avgRating = typeof t.avg_rating !== 'undefined' ? t.avg_rating : t.avgRating;
          doc.text(`  Avg Annotations: ${avgAnnotations}`);
          if (avgRating !== null && typeof avgRating !== 'undefined') {
            doc.text(`  Avg Rating: ${avgRating}`);
          }
          const choiceDistribution = t.choice_distribution || t.choicePercentages;
          if (choiceDistribution) {
            doc.text(`  Choice Distribution:`);
            Object.entries(choiceDistribution).forEach(([label, percentStr]) => {
              let displayName = label;
              const m = String(label).match(/(artifact)[ _]?(\d+)/i);
              if (m) {
                const pos = Number(m[2]);
                const aid = pos === 1 ? t.artifact1_id : pos === 2 ? t.artifact2_id : pos === 3 ? t.artifact3_id : null;
                if (aid && artifactMap[aid] && artifactMap[aid].name) {
                  displayName = artifactMap[aid].name;
                } else {
                  displayName = `Artifact ${pos}`;
                }
              }
              // percentStr is already like "50%"
              doc.text(`    - ${displayName}: ${percentStr}`);
            });
          }
          doc.moveDown(0.8);
        });
      }

      // Evaluations Summary (detailed per evaluation)
      if (doc.y > 650) doc.addPage();
      doc.fontSize(16).text('Evaluation Summary', { underline: true });
      doc.moveDown(0.5);
      // Count unique participants (evaluation sets)
      const evalsByParticipantCount = Object.keys(evaluations.reduce((acc, e) => { acc[e.participant_id] = true; return acc; }, {})).length;
      doc.fontSize(10).text(`Total Evaluations: ${evalsByParticipantCount}`);
      doc.text(`Flagged Evaluations: ${evaluations.filter(e => e.flagged).length}`);
      doc.moveDown(1);

      // Group evaluations by participant
      const evalsByParticipant = {};
      evaluations.forEach(e => {
        const key = e.participant_id;
        if (!evalsByParticipant[key]) evalsByParticipant[key] = [];
        evalsByParticipant[key].push(e);
      });

      Object.keys(evalsByParticipant).forEach((pid, idx) => {
        if (doc.y > 700) doc.addPage();
        doc.fontSize(12).text(`Evaluation #${idx + 1}`);
        evalsByParticipant[pid].forEach(ev => {
          doc.fontSize(10).text(`  ${ev.task_name}`);
          if (ev.artifacts_evaluated && ev.artifacts_evaluated.length > 0) {
            doc.text(`    Artifacts: ${ev.artifacts_evaluated.join(', ')}`);
          }
          if (ev.answer_type === 'rating' && ev.ratings) {
            try {
              const ratingsObj = JSON.parse(ev.ratings);
              const vals = Object.values(ratingsObj).map(x => Number(x)).filter(v => !isNaN(v));
              if (vals.length > 0) doc.text(`    Ratings: ${vals.join(', ')}`);
              // Show comments if present (after ratings)
              if (ev.comments) {
                doc.fontSize(9).text(`    Comments: ${ev.comments}`, { width: 450 });
              }
            } catch {}
          }
          // Show participant choice if captured
          if (ev.choice) {
            let chosenName = ev.choice;
            const taskRow = tasksQ.rows.find(t => t.id === ev.task_id);
            if (taskRow) {
              const val = String(ev.choice);
              // Try position-based mapping: artifact_1 or Artifact 1
              let posMatch = val.match(/artifact[_\s]*(\d+)/i);
              // If the value equals an artifact name, use as-is
              const artifactNames = [
                taskRow.artifact1_id && artifactMap[taskRow.artifact1_id]?.name,
                taskRow.artifact2_id && artifactMap[taskRow.artifact2_id]?.name,
                taskRow.artifact3_id && artifactMap[taskRow.artifact3_id]?.name
              ].filter(Boolean);
              if (artifactNames.includes(val)) {
                chosenName = val;
              } else if (posMatch) {
                const pos = Number(posMatch[1]);
                const aid = pos === 1 ? taskRow.artifact1_id : pos === 2 ? taskRow.artifact2_id : pos === 3 ? taskRow.artifact3_id : null;
                if (aid && artifactMap[aid] && artifactMap[aid].name) {
                  chosenName = artifactMap[aid].name;
                } else {
                  chosenName = `Artifact ${pos}`;
                }
              } else {
                // Last resort: normalize label form
                chosenName = val.replace(/_/g, ' ').replace(/artifact (\d+)/i, 'Artifact $1');
              }
            }
            doc.text(`    Choice: ${chosenName}`);
            // Show explanation if present
            if (ev.choice_explanation) {
              doc.fontSize(9).text(`    Explanation: ${ev.choice_explanation}`, { width: 450 });
            }
          }
          // Show screenshots if present
          if (ev.screenshots && Array.isArray(ev.screenshots) && ev.screenshots.length > 0) {
            doc.fontSize(9).text(`    Screenshots:`);
            for (const screenshot of ev.screenshots) {
              try {
                // Get the image path - use local file path from /app/uploads
                let imagePath = screenshot.url || screenshot;
                // Convert URL to local file path if needed
                if (imagePath.startsWith('/uploads/')) {
                  imagePath = `/app/uploads/${imagePath.split('/').pop()}`;
                }
                // Check if image fits on current page
                if (doc.y > 550) doc.addPage();
                doc.image(imagePath, { width: 200, height: 150 });
                doc.moveDown(0.3);
              } catch (imgErr) {
                console.log('[PDF Export] Screenshot loading error:', imgErr.message);
                doc.fontSize(8).text(`(Screenshot unavailable: ${screenshot.fileName || 'unknown'})`, { color: '#999' });
              }
            }
          }
          doc.moveDown(0.4);
        });
        doc.moveDown(0.8);
      });

      doc.end();
      return; // Important: return here to prevent falling through
    }

    res.status(400).json({ error: 'Invalid format. Use csv, xlsx, or pdf.' });
  } catch (err) {
    console.error('[Export Error]', err);
    res.status(500).json({ error: 'Failed to export study' });
  }
});

// PATCH /api/researcher/evaluations/:id/flag -> flag/unflag evaluation, notify reviewers when flagging
router.patch('/evaluations/:id/flag', async (req, res) => {
  try {
    const evalId = parseInt(req.params.id, 10);
    const { flagged, reason } = req.body;

    // Update evaluation flag status
    await pool.query('UPDATE evaluations SET flagged = $1 WHERE id = $2', [flagged, evalId]);

    // If flagging (not unflagging), notify all reviewers
    // Find the study and title for this evaluation
    const studyQ = await pool.query(
      `SELECT et.study_id, s.title
       FROM evaluations ev
       JOIN evaluation_tasks et ON ev.task_id = et.id
       JOIN studies s ON s.id = et.study_id
       WHERE ev.id = $1`,
      [evalId]
    );

    const studyId = studyQ.rows[0]?.study_id;
    const studyTitle = studyQ.rows[0]?.title || 'Study';

    if (!studyId) {
      return res.status(404).json({ error: 'Study not found for evaluation' });
    }

    if (flagged) {
      // Determine who to notify: assigned reviewers if any, otherwise all reviewers
      const assigned = await pool.query('SELECT reviewer_id FROM reviewer_assignments WHERE study_id = $1', [studyId]);
      let targets = assigned.rows.map(r => r.reviewer_id);
      if (targets.length === 0) {
        const reviewersQ = await pool.query("SELECT id FROM users WHERE role = 'reviewer'");
        targets = reviewersQ.rows.map(r => r.id);
      }

      if (targets.length > 0) {
        const link = `/studies/${studyId}`;
        const title = `${studyTitle} has a flagged evaluation`;
        const body = `${studyTitle} has a flagged evaluation.${reason ? ' Reason: ' + reason : ''}`;

        const notePromises = targets.map(async (uid) => {
          // De-duplicate per user per study
          await pool.query('DELETE FROM notifications WHERE user_id = $1 AND link = $2', [uid, link]);
          return pool.query(
            'INSERT INTO notifications (user_id, title, body, link) VALUES ($1,$2,$3,$4)', 
            [uid, title, body, link]
          );
        });
        await Promise.all(notePromises);
      }
    } else {
      // On unflag: if no other flagged evaluations in this study, remove study-level notifications for reviewers
      const remaining = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM evaluations ev
         JOIN evaluation_tasks et ON ev.task_id = et.id
         WHERE et.study_id = $1 AND ev.flagged = true`,
        [studyId]
      );
      const stillFlagged = remaining.rows[0]?.cnt || 0;
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

    res.json({ success: true, flagged });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update flag status' });
  }
});

// GET /api/researcher/studies/:id/task-analytics - detailed analytics per task
router.get('/studies/:id/task-analytics', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify study ownership (unless admin/reviewer)
    const studyCheck = await pool.query(
      'SELECT id, created_by FROM studies WHERE id = $1',
      [studyId]
    );
    if (studyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    if (userRole !== 'admin' && userRole !== 'reviewer' && studyCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this study' });
    }

    // Get all tasks for this study
    const tasksQ = await pool.query(
      `SELECT id, task_type, instructions, answer_type, answer_options, artifact1_id, artifact2_id, artifact3_id 
       FROM evaluation_tasks 
       WHERE study_id = $1 
       ORDER BY created_at`,
      [studyId]
    );

    if (tasksQ.rows.length === 0) {
      return res.json({ tasks: [] });
    }

    // For each task, compute analytics
    const taskAnalytics = await Promise.all(
      tasksQ.rows.map(async (task) => {
        // Count participants who completed this task
        const completionCountQ = await pool.query(
          `SELECT COUNT(DISTINCT participant_id)::int AS count 
           FROM evaluations 
           WHERE task_id = $1`,
          [task.id]
        );
        const completedBy = completionCountQ.rows[0].count || 0;

        // Get all evaluations for this task
        const evaluationsQ = await pool.query(
          `SELECT ratings, annotations, comments 
           FROM evaluations 
           WHERE task_id = $1`,
          [task.id]
        );

        let totalAnnotations = 0;
        let annotationCount = 0;
        const ratings = [];
        const choices = {};

        evaluationsQ.rows.forEach((evaluation) => {
          // Count annotations
          if (evaluation.annotations) {
            let annotationsData = evaluation.annotations;
            if (typeof annotationsData === 'string') {
              try {
                annotationsData = JSON.parse(annotationsData);
              } catch (e) {
                annotationsData = {};
              }
            }

            // Count different types of annotations
            const annotationTypes = ['screenshots', 'highlights', 'artifactHighlights'];
            let evalAnnotationCount = 0;
            
            annotationTypes.forEach(type => {
              if (annotationsData[type]) {
                if (Array.isArray(annotationsData[type])) {
                  evalAnnotationCount += annotationsData[type].length;
                } else if (typeof annotationsData[type] === 'object') {
                  // For artifactHighlights which is an object with artifact1, artifact2, etc.
                  Object.values(annotationsData[type]).forEach(arr => {
                    if (Array.isArray(arr)) {
                      evalAnnotationCount += arr.length;
                    }
                  });
                }
              }
            });

            if (evalAnnotationCount > 0) {
              totalAnnotations += evalAnnotationCount;
              annotationCount += 1;
            }
          }

          // Parse ratings
          if (evaluation.ratings) {
            let ratingsData = evaluation.ratings;
            if (typeof ratingsData === 'string') {
              try {
                ratingsData = JSON.parse(ratingsData);
              } catch (e) {
                ratingsData = {};
              }
            }
            
            // Extract numeric ratings from the ratings object
            Object.values(ratingsData).forEach(rating => {
              const numRating = parseFloat(rating);
              if (!isNaN(numRating)) {
                ratings.push(numRating);
              }
            });
          }

          // Parse choice from annotations
          if (evaluation.annotations) {
            let annotationsData = evaluation.annotations;
            if (typeof annotationsData === 'string') {
              try {
                annotationsData = JSON.parse(annotationsData);
              } catch (e) {
                annotationsData = {};
              }
            }
            
            if (annotationsData.choice) {
              const choice = annotationsData.choice;
              // Normalize choice to match artifact labels
              let normalizedChoice = choice;
              
              // Handle different choice formats: "artifact_1", "Artifact 1", "1", etc.
              if (choice === 'artifact_1' || choice === 'Artifact 1' || choice === '1' || choice === 1) {
                normalizedChoice = 'Artifact 1';
              } else if (choice === 'artifact_2' || choice === 'Artifact 2' || choice === '2' || choice === 2) {
                normalizedChoice = 'Artifact 2';
              } else if (choice === 'artifact_3' || choice === 'Artifact 3' || choice === '3' || choice === 3) {
                normalizedChoice = 'Artifact 3';
              }
              
              choices[normalizedChoice] = (choices[normalizedChoice] || 0) + 1;
            }
          }
        });

        // Calculate averages per your definition:
        // Avg annotations = total highlighted words across all evaluations / total number of evaluations
        const totalResponses = evaluationsQ.rows.length;
        const avgAnnotations = totalResponses > 0 
          ? parseFloat((totalAnnotations / totalResponses).toFixed(2)) 
          : 0.0;

        // Debug: log calculation details per task
        console.log('[Task Analytics] Task', task.id, {
          completedBy,
          totalResponses,
          annotationCount,
          totalAnnotations,
          avgAnnotations,
        });

        const avgRating = ratings.length > 0 
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) 
          : null;

        // Calculate choice percentages based on actual artifacts in the task
        // Only for choice-based answer types
        let choicePercentages = null;
        
        if (task.answer_type === 'choice' || task.answer_type === 'choice_required_text') {
          const totalChoices = Object.values(choices).reduce((a, b) => a + b, 0);
          choicePercentages = {};
          
          // Only show percentages for artifacts that exist in this task
          const availableArtifacts = [];
          if (task.artifact1_id) availableArtifacts.push('Artifact 1');
          if (task.artifact2_id) availableArtifacts.push('Artifact 2');
          if (task.artifact3_id) availableArtifacts.push('Artifact 3');
          
          availableArtifacts.forEach(artifact => {
            const count = choices[artifact] || 0;
            choicePercentages[artifact] = totalChoices > 0 
              ? parseFloat(((count / totalChoices) * 100).toFixed(1))
              : 0.0;
          });
        }

        return {
          taskId: task.id,
          taskName: task.instructions?.substring(0, 50) || `Task ${task.id}`,
          taskType: task.task_type,
          answerType: task.answer_type || 'rating',
          completedBy: completedBy,
          avgAnnotations: avgAnnotations,
          avgRating: avgRating ? parseFloat(avgRating) : null,
          choicePercentages: choicePercentages,
          totalResponses: evaluationsQ.rows.length
        };
      })
    );

    res.json({ tasks: taskAnalytics });
  } catch (err) {
    console.error('[Task Analytics Error]:', err);
    res.status(500).json({ error: 'Failed to fetch task analytics' });
  }
});

// GET /api/researcher/studies/:id/evaluations - get all evaluations for a study (anonymized)
router.get('/studies/:id/evaluations', async (req, res) => {
  try {
    const studyId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify study ownership (unless admin/reviewer)
    const studyCheck = await pool.query(
      'SELECT id, created_by FROM studies WHERE id = $1',
      [studyId]
    );
    if (studyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Study not found' });
    }
    if (userRole !== 'admin' && userRole !== 'reviewer' && studyCheck.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this study' });
    }

    // Get all evaluation tasks for this study
    const tasksQ = await pool.query(
      `SELECT id, task_type, instructions, answer_type, answer_options, artifact1_id, artifact2_id, artifact3_id, created_at
       FROM evaluation_tasks
       WHERE study_id = $1
       ORDER BY created_at`,
      [studyId]
    );

    if (tasksQ.rows.length === 0) {
      return res.json({ evaluations: [] });
    }

    const taskIds = tasksQ.rows.map(t => t.id);

    // Get all evaluations for these tasks (ordered by completion time)
    const evaluationsQ = await pool.query(
      `SELECT e.id, e.task_id, e.ratings, e.annotations, e.comments, e.completed_at, e.flagged
       FROM evaluations e
       WHERE e.task_id = ANY($1::int[])
       ORDER BY e.completed_at ASC`,
      [taskIds]
    );

    // Group evaluations by participant (without revealing participant_id)
    // We'll create anonymous evaluation sets based on completion order
    const evaluationsByParticipant = {};
    
    await Promise.all(evaluationsQ.rows.map(async (evaluationRow) => {
      // Get participant_id to group evaluations, but don't expose it
      const participantQ = await pool.query(
        'SELECT participant_id FROM evaluations WHERE id = $1',
        [evaluationRow.id]
      );
      const participantId = participantQ.rows[0]?.participant_id;
      
      if (!evaluationsByParticipant[participantId]) {
        evaluationsByParticipant[participantId] = [];
      }
      
      evaluationsByParticipant[participantId].push(evaluationRow);
    }));

    // Convert to array and assign anonymous evaluation numbers
    const evaluationSets = Object.values(evaluationsByParticipant)
      .sort((a, b) => new Date(a[0].completed_at) - new Date(b[0].completed_at));

    // Fetch all evaluation tags for these tasks
    const tagsQ = await pool.query(
      `SELECT e.task_id, e.participant_id, eat.artifact_id, eat.tag 
       FROM evaluation_artifact_tags eat
       JOIN evaluations e ON eat.task_id = e.task_id AND eat.participant_id = e.participant_id
       WHERE e.task_id = ANY($1::int[])
       ORDER BY e.task_id, e.participant_id, eat.artifact_id, eat.tag`,
      [taskIds]
    );

    // Build tags map: { taskId: { participantId: { artifactId: [tags] } } }
    const tagsMap = {};
    tagsQ.rows.forEach(row => {
      if (!tagsMap[row.task_id]) {
        tagsMap[row.task_id] = {};
      }
      if (!tagsMap[row.task_id][row.participant_id]) {
        tagsMap[row.task_id][row.participant_id] = {};
      }
      if (!tagsMap[row.task_id][row.participant_id][row.artifact_id]) {
        tagsMap[row.task_id][row.participant_id][row.artifact_id] = [];
      }
      tagsMap[row.task_id][row.participant_id][row.artifact_id].push(row.tag);
    });

    const anonymizedEvaluations = await Promise.all(evaluationSets.map(async (evalSet, index) => {
      // Get participant_id for this evaluation set
      const participantQ = await pool.query(
        'SELECT participant_id FROM evaluations WHERE id = $1',
        [evalSet[0].id]
      );
      const participantId = participantQ.rows[0]?.participant_id;

      // For each evaluation set (participant), get all their task responses
      const tasks = await Promise.all(evalSet.map(async (e) => {
        const task = tasksQ.rows.find(t => t.id === e.task_id);
        const taskOrder = tasksQ.rows.findIndex(t => t.id === e.task_id);
        
        // Fetch artifacts if they exist
        let artifact1 = null, artifact2 = null, artifact3 = null;
        
        if (task?.artifact1_id) {
          const a1Q = await pool.query('SELECT id, name, type, content, file_path FROM artifacts WHERE id = $1', [task.artifact1_id]);
          artifact1 = a1Q.rows[0] || null;
          // Add tags if they exist
          if (artifact1 && tagsMap[e.task_id]?.[participantId]?.[task.artifact1_id]) {
            artifact1.tags = tagsMap[e.task_id][participantId][task.artifact1_id];
          } else {
            artifact1 = artifact1 ? { ...artifact1, tags: [] } : null;
          }
        }
        if (task?.artifact2_id) {
          const a2Q = await pool.query('SELECT id, name, type, content, file_path FROM artifacts WHERE id = $1', [task.artifact2_id]);
          artifact2 = a2Q.rows[0] || null;
          // Add tags if they exist
          if (artifact2 && tagsMap[e.task_id]?.[participantId]?.[task.artifact2_id]) {
            artifact2.tags = tagsMap[e.task_id][participantId][task.artifact2_id];
          } else {
            artifact2 = artifact2 ? { ...artifact2, tags: [] } : null;
          }
        }
        if (task?.artifact3_id) {
          const a3Q = await pool.query('SELECT id, name, type, content, file_path FROM artifacts WHERE id = $1', [task.artifact3_id]);
          artifact3 = a3Q.rows[0] || null;
          // Add tags if they exist
          if (artifact3 && tagsMap[e.task_id]?.[participantId]?.[task.artifact3_id]) {
            artifact3.tags = tagsMap[e.task_id][participantId][task.artifact3_id];
          } else {
            artifact3 = artifact3 ? { ...artifact3, tags: [] } : null;
          }
        }
        
        // Parse JSONB fields
        let ratings = e.ratings;
        let annotations = e.annotations;
        
        if (typeof ratings === 'string') {
          try { ratings = JSON.parse(ratings); } catch (err) { ratings = []; }
        }
        if (typeof annotations === 'string') {
          try { annotations = JSON.parse(annotations); } catch (err) { annotations = {}; }
        }

        // Extract choice and text from annotations
        const choice = annotations.choice || null;
        const text = annotations.text || null;

        return {
          taskId: e.task_id,
          taskOrder: taskOrder,
          taskType: task?.task_type || 'unknown',
          instructions: task?.instructions || '',
          answerType: task?.answer_type || 'rating',
          answerOptions: task?.answer_options || null,
          ratings: ratings || [],
          choice: choice,
          text: text,
          annotations: annotations || {},
          comments: e.comments || '',
          artifact1: artifact1,
          artifact2: artifact2,
          artifact3: artifact3
        };
      }));

      // Sort tasks by their creation order
      tasks.sort((a, b) => a.taskOrder - b.taskOrder);

      return {
        evaluationNumber: index + 1,
        evaluationId: evalSet[0].id, // Use first evaluation's ID as the set ID
        completedAt: evalSet[0].completed_at,
        flagged: evalSet.some(ev => ev.flagged) || false,
        tasks: tasks
      };
    }));

    res.json({ evaluations: anonymizedEvaluations });
  } catch (err) {
    console.error('[Get Evaluations Error]:', err);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// PATCH /api/researcher/evaluations/:id/flag - flag/unflag an evaluation
router.patch('/evaluations/:id/flag', async (req, res) => {
  try {
    const evaluationId = parseInt(req.params.id, 10);
    const { flagged } = req.body;

    // Update the flagged status
    await pool.query(
      'UPDATE evaluations SET flagged = $1 WHERE id = $2',
      [flagged, evaluationId]
    );

    // TODO: Send notification to reviewer (will be implemented later)

    res.json({ success: true, flagged });
  } catch (err) {
    console.error('[Flag Evaluation Error]:', err);
    res.status(500).json({ error: 'Failed to flag evaluation' });
  }
});

module.exports = router;
