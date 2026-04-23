const pool = require('../config/database');
const { sendDeadlineNotification } = require('./emailService');

/**
 * Deadline Notification Service
 * Sends notifications to participants when study deadlines are approaching
 * Uses database tracking to ensure each participant receives each notification only once
 */

let intervalId = null;

/**
 * Check for studies with approaching deadlines and send notifications
 */
async function checkApproachingDeadlines() {
  const client = await pool.connect();
  try {
    const now = new Date();
    
    // Check for studies with deadlines in 24 hours
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    
    const studies24h = await client.query(
      `SELECT s.id, s.title, s.deadline
       FROM studies s
       WHERE s.status = 'active'
       AND s.deadline IS NOT NULL
       AND s.deadline > $1
       AND s.deadline <= $2`,
      [now, twentyFourHoursFromNow]
    );

    // Check for studies with deadlines in 1 hour
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const fiftyNineMinutesFromNow = new Date(now.getTime() + 59 * 60 * 1000);
    
    const studies1h = await client.query(
      `SELECT s.id, s.title, s.deadline
       FROM studies s
       WHERE s.status = 'active'
       AND s.deadline IS NOT NULL
       AND s.deadline > $1
       AND s.deadline <= $2`,
      [now, oneHourFromNow]
    );

    let notificationCount = 0;

    // Send 24-hour notifications
    for (const study of studies24h.rows) {
      try {
        const sent = await sendNotificationsToParticipants(client, study.id, study.title, 24, '24h');
        notificationCount += sent;
        if (sent > 0) {
          console.log(`[Deadline Notification] Sent 24h notifications to ${sent} participant(s) for study ${study.id}: "${study.title}"`);
        }
      } catch (error) {
        console.error(`[Deadline Notification] Error sending 24h notifications for study ${study.id}:`, error.message);
      }
    }

    // Send 1-hour notifications
    for (const study of studies1h.rows) {
      try {
        const sent = await sendNotificationsToParticipants(client, study.id, study.title, 1, '1h');
        notificationCount += sent;
        if (sent > 0) {
          console.log(`[Deadline Notification] Sent 1h notifications to ${sent} participant(s) for study ${study.id}: "${study.title}"`);
        }
      } catch (error) {
        console.error(`[Deadline Notification] Error sending 1h notifications for study ${study.id}:`, error.message);
      }
    }

    if (notificationCount === 0) {
      console.log('[Deadline Notification] No approaching deadlines requiring notifications');
    }

    return {
      checked: true,
      studies24h: studies24h.rows.length,
      studies1h: studies1h.rows.length,
      notificationsSent: notificationCount
    };
  } catch (error) {
    console.error('[Deadline Notification] Error checking approaching deadlines:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Send notifications to enrolled participants who haven't been notified yet
 * @param {Object} client - Database client
 * @param {number} studyId - Study ID
 * @param {string} studyTitle - Study title
 * @param {number} hoursRemaining - Hours until deadline
 * @param {string} notificationType - '24h' or '1h'
 * @returns {Promise<number>} Number of notifications sent
 */
async function sendNotificationsToParticipants(client, studyId, studyTitle, hoursRemaining, notificationType) {
  // Get enrolled participants who haven't been notified yet for this threshold
  const result = await client.query(
    `SELECT u.id, u.email, u.first_name, u.last_name
     FROM study_participants sp
     JOIN users u ON sp.participant_id = u.id
     LEFT JOIN study_deadline_notifications sdn 
       ON sdn.study_id = sp.study_id 
       AND sdn.participant_id = sp.participant_id 
       AND sdn.notification_type = $2
     WHERE sp.study_id = $1
     AND sdn.id IS NULL`,
    [studyId, notificationType]
  );

  const participants = result.rows;

  if (participants.length === 0) {
    return 0;
  }

  let sentCount = 0;

  // Send notification to each participant who hasn't been notified
  for (const participant of participants) {
    try {
      // Send the email
      await sendDeadlineNotification(participant.email, studyTitle, hoursRemaining);
      
      // Mark as notified in database
      await client.query(
        `INSERT INTO study_deadline_notifications (study_id, participant_id, notification_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (study_id, participant_id, notification_type) DO NOTHING`,
        [studyId, participant.id, notificationType]
      );
      
      sentCount++;
    } catch (error) {
      console.error(`[Deadline Notification] Failed to send to ${participant.email}:`, error.message);
    }
  }

  return sentCount;
}



/**
 * Start the deadline notification background job
 * Runs every 5 minutes
 */
function startDeadlineNotifications() {
  if (intervalId) {
    console.log('[Deadline Notification] Service already running');
    return;
  }

  console.log('[Deadline Notification] Starting deadline notification service (checking every 5 minutes)');

  // Run immediately on start
  checkApproachingDeadlines().catch(error => {
    console.error('[Deadline Notification] Initial check failed:', error);
  });

  // Then run every 5 minutes (300000 ms)
  intervalId = setInterval(() => {
    checkApproachingDeadlines().catch(error => {
      console.error('[Deadline Notification] Scheduled check failed:', error);
    });
  }, 5 * 60 * 1000);
}

/**
 * Stop the deadline notification background job
 */
function stopDeadlineNotifications() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Deadline Notification] Service stopped');
  }
}

module.exports = {
  checkApproachingDeadlines,
  startDeadlineNotifications,
  stopDeadlineNotifications
};
