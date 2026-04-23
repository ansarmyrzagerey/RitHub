const nodemailer = require('nodemailer');
const pool = require('../config/database');

/**
 * Create email transporter
 * @returns {Object} Nodemailer transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.zoho.eu',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER || 'rithub@zohomail.eu',
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Get enrolled participants for a study
 * @param {number} studyId - Study ID
 * @returns {Promise<Array>} Array of participant objects with email
 */
const getEnrolledParticipants = async (studyId) => {
  const res = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name
     FROM study_participants sp
     JOIN users u ON sp.participant_id = u.id
     WHERE sp.study_id = $1`,
    [studyId]
  );
  return res.rows;
};

/**
 * Send study cancellation notification to participants
 * @param {number} studyId - Study ID
 * @param {string} studyTitle - Study title
 * @param {string} reason - Cancellation reason (optional)
 * @returns {Promise<Object>} Result object with success status
 */
const sendStudyCancellationNotification = async (studyId, studyTitle, reason = null) => {
  console.log(`Sending study cancellation notification for study "${studyTitle}" (ID: ${studyId})`);

  try {
    // Get all enrolled participants
    const participants = await getEnrolledParticipants(studyId);

    if (participants.length === 0) {
      console.log('No participants enrolled in this study');
      return { success: true, sent: 0, message: 'No participants to notify' };
    }

    const transporter = createTransporter();
    const results = [];

    // Send email to each participant
    for (const participant of participants) {
      try {
        const mailOptions = {
          from: {
            name: 'RitHub',
            address: process.env.EMAIL_USER || 'rithub@zohomail.eu'
          },
          to: participant.email,
          subject: `Study Cancelled - ${studyTitle}`,
          html: `
            <div style="font-family: Arial, sans-serif;">
              <h2>Study Cancellation Notice</h2>
              <p>Dear ${participant.first_name},</p>
              <p>We regret to inform you that the study "<strong>${studyTitle}</strong>" has been cancelled.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>We apologize for any inconvenience this may cause. Your time and willingness to participate are greatly appreciated.</p>
              <p>If you have any questions, please contact the research team.</p>
              <p>Thank you for your understanding.</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
              <p style="font-size: 12px; color: #666;">
                This is an automated notification from the RitHub platform.
              </p>
            </div>
          `,
          text: `Study Cancellation Notice\n\nDear ${participant.first_name},\n\nWe regret to inform you that the study "${studyTitle}" has been cancelled.\n\n${reason ? `Reason: ${reason}\n\n` : ''}We apologize for any inconvenience this may cause. Your time and willingness to participate are greatly appreciated.\n\nIf you have any questions, please contact the research team.\n\nThank you for your understanding.`
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Cancellation notification sent to ${participant.email}:`, info.messageId);
        results.push({ email: participant.email, success: true, messageId: info.messageId });
      } catch (error) {
        console.error(`Error sending cancellation notification to ${participant.email}:`, error);
        results.push({ email: participant.email, success: false, error: error.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${participants.length} cancellation notifications`);

    return {
      success: true,
      sent: successCount,
      total: participants.length,
      results
    };

  } catch (error) {
    console.error('Error sending study cancellation notifications:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log(`FALLBACK - Study cancellation notification for "${studyTitle}"`);
      return { success: true, fallback: true };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Send admin cancellation notification to researcher
 * @param {string} researcherEmail - Researcher's email
 * @param {string} researcherName - Researcher's first name
 * @param {string} studyTitle - Study title
 * @param {string} reason - Cancellation reason
 * @param {string} adminName - Admin's name who cancelled the study
 * @returns {Promise<Object>} Result object with success status
 */
const sendAdminCancellationNotification = async (researcherEmail, researcherName, studyTitle, reason, adminName) => {
  console.log(`Sending admin cancellation notification to ${researcherEmail} for study "${studyTitle}"`);

  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: 'RitHub',
        address: process.env.EMAIL_USER || 'rithub@zohomail.eu'
      },
      to: researcherEmail,
      subject: `Your Study Has Been Cancelled by Administrator - ${studyTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Study Cancellation Notice</h2>
          <p>Dear ${researcherName},</p>
          <p>Your study "<strong>${studyTitle}</strong>" has been cancelled by an administrator.</p>
          <p><strong>Administrator:</strong> ${adminName}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>If you believe this cancellation was made in error or have questions about this decision, please contact the platform administrators.</p>
          <p>Any partial evaluation data collected has been preserved and marked as from a cancelled study.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from the RitHub platform.
          </p>
        </div>
      `,
      text: `Study Cancellation Notice\n\nDear ${researcherName},\n\nYour study "${studyTitle}" has been cancelled by an administrator.\n\nAdministrator: ${adminName}\nReason: ${reason}\n\nIf you believe this cancellation was made in error or have questions about this decision, please contact the platform administrators.\n\nAny partial evaluation data collected has been preserved and marked as from a cancelled study.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Admin cancellation notification sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending admin cancellation notification:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log(`FALLBACK - Admin cancellation notification for ${researcherEmail}: Study "${studyTitle}" cancelled by ${adminName}`);
      return { success: true, fallback: true };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Send capacity approaching notification to researcher
 * @param {string} researcherEmail - Researcher's email
 * @param {string} researcherName - Researcher's first name
 * @param {string} studyTitle - Study title
 * @param {number} enrolledCount - Current enrolled count
 * @param {number} capacity - Maximum capacity
 * @returns {Promise<Object>} Result object with success status
 */
const sendCapacityApproachingNotification = async (researcherEmail, researcherName, studyTitle, enrolledCount, capacity) => {
  console.log(`Sending capacity approaching notification to ${researcherEmail} for study "${studyTitle}" (${enrolledCount}/${capacity})`);

  try {
    const transporter = createTransporter();
    const percentFilled = Math.round((enrolledCount / capacity) * 100);
    const remaining = capacity - enrolledCount;

    const mailOptions = {
      from: {
        name: 'RitHub',
        address: process.env.EMAIL_USER || 'rithub@zohomail.eu'
      },
      to: researcherEmail,
      subject: `Study Capacity Alert - ${studyTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Study Capacity Alert</h2>
          <p>Dear ${researcherName},</p>
          <p>Your study "<strong>${studyTitle}</strong>" is approaching its participant capacity limit.</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Current Enrollment:</strong> ${enrolledCount} / ${capacity} participants (${percentFilled}% filled)</p>
            <p style="margin: 5px 0;"><strong>Remaining Slots:</strong> ${remaining}</p>
          </div>
          <p>Once the capacity is reached, the enrollment link will automatically become inactive and no new participants will be able to join.</p>
          <p>You can view your study details and manage enrollment from your dashboard.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from the RitHub platform.
          </p>
        </div>
      `,
      text: `Study Capacity Alert\n\nDear ${researcherName},\n\nYour study "${studyTitle}" is approaching its participant capacity limit.\n\nCurrent Enrollment: ${enrolledCount} / ${capacity} participants (${percentFilled}% filled)\nRemaining Slots: ${remaining}\n\nOnce the capacity is reached, the enrollment link will automatically become inactive and no new participants will be able to join.\n\nYou can view your study details and manage enrollment from your dashboard.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Capacity approaching notification sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending capacity approaching notification:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log(`FALLBACK - Capacity notification for ${researcherEmail}: Study "${studyTitle}" at ${enrolledCount}/${capacity}`);
      return { success: true, fallback: true };
    }

    return { success: false, error: error.message };
  }
};

/**
 * Check if capacity notification should be sent
 * Sends notification when study reaches 90% capacity (only once)
 * @param {number} studyId - Study ID
 * @param {number} enrolledCount - Current enrolled count
 * @param {number} capacity - Maximum capacity
 * @returns {Promise<boolean>} True if notification should be sent
 */
const shouldSendCapacityNotification = async (studyId, enrolledCount, capacity) => {
  if (!capacity || capacity === 0) return false;
  
  const percentFilled = (enrolledCount / capacity) * 100;
  
  // Only send notification when reaching 90% or above
  if (percentFilled < 90) return false;
  
  // Check if notification has already been sent for this study
  try {
    const res = await pool.query(
      'SELECT id FROM study_capacity_notifications WHERE study_id = $1',
      [studyId]
    );
    
    // If notification already sent, don't send again
    if (res.rows.length > 0) {
      return false;
    }
    
    // Mark notification as sent
    await pool.query(
      `INSERT INTO study_capacity_notifications (study_id, enrolled_count, capacity, percent_filled)
       VALUES ($1, $2, $3, $4)`,
      [studyId, enrolledCount, capacity, Math.round(percentFilled)]
    );
    
    return true;
  } catch (error) {
    console.error('Error checking capacity notification status:', error);
    return false;
  }
};

module.exports = {
  sendStudyCancellationNotification,
  sendAdminCancellationNotification,
  sendCapacityApproachingNotification,
  shouldSendCapacityNotification
};
