const pool = require('../config/database');
const Study = require('../models/study');

/**
 * Deadline Enforcement Service
 * Checks for expired studies and automatically completes them
 */

let intervalId = null;

/**
 * Check for studies with passed deadlines and complete them
 */
async function checkExpiredStudies() {
  const client = await pool.connect();
  try {
    // Query active studies with passed deadlines
    const result = await client.query(
      `SELECT id, title, deadline 
       FROM studies 
       WHERE status = 'active' 
       AND deadline IS NOT NULL 
       AND deadline <= NOW()`
    );

    const expiredStudies = result.rows;

    if (expiredStudies.length === 0) {
      console.log('[Deadline Enforcement] No expired studies found');
      return { checked: true, completed: 0 };
    }

    console.log(`[Deadline Enforcement] Found ${expiredStudies.length} expired study(ies)`);

    // Complete each expired study
    const completedStudies = [];
    for (const study of expiredStudies) {
      try {
        await Study.complete(study.id);
        console.log(`[Deadline Enforcement] Completed study ${study.id}: "${study.title}" (deadline: ${study.deadline})`);
        completedStudies.push(study.id);
      } catch (error) {
        console.error(`[Deadline Enforcement] Error completing study ${study.id}:`, error.message);
      }
    }

    return {
      checked: true,
      found: expiredStudies.length,
      completed: completedStudies.length,
      studyIds: completedStudies
    };
  } catch (error) {
    console.error('[Deadline Enforcement] Error checking expired studies:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Start the deadline enforcement background job
 * Runs every 5 minutes
 */
function startDeadlineEnforcement() {
  if (intervalId) {
    console.log('[Deadline Enforcement] Service already running');
    return;
  }

  console.log('[Deadline Enforcement] Starting deadline enforcement service (checking every 5 minutes)');

  // Run immediately on start
  checkExpiredStudies().catch(error => {
    console.error('[Deadline Enforcement] Initial check failed:', error);
  });

  // Then run every 5 minutes (300000 ms)
  intervalId = setInterval(() => {
    checkExpiredStudies().catch(error => {
      console.error('[Deadline Enforcement] Scheduled check failed:', error);
    });
  }, 5 * 60 * 1000);
}

/**
 * Stop the deadline enforcement background job
 */
function stopDeadlineEnforcement() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Deadline Enforcement] Service stopped');
  }
}

module.exports = {
  checkExpiredStudies,
  startDeadlineEnforcement,
  stopDeadlineEnforcement
};
