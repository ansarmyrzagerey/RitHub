const nodemailer = require('nodemailer');

const sendVerificationEmail = async (email, verificationUrl) => {
  console.log(`Sending verification email to ${email} with URL: ${verificationUrl}`);

  try {
    const transporter = nodemailer.createTransport({
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

    const mailOptions = {
      from: {
        name: 'RitHub',
        address: process.env.EMAIL_USER || 'rithub@zohomail.eu'
      },
      to: email,
      subject: 'Verify Your Email Address - RitHub',
      html: `<div style="font-family: Arial, sans-serif;"><h1>Welcome!</h1><p>Please verify your email: <a href="${verificationUrl}">Verify Email</a></p></div>`,
      text: `Please verify your email: ${verificationUrl}`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending verification email:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log(`FALLBACK - Verification email for ${email}: ${verificationUrl}`);
      return { success: true, fallback: true };
    }

    return { success: false, error: error.message };
  }
};

const sendPasswordResetEmail = async (email, tempPassword, firstName) => {
  console.log(`Sending password reset email to ${email}`);

  try {
    const transporter = nodemailer.createTransport({
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

    const mailOptions = {
      from: {
        name: 'RitHub',
        address: process.env.EMAIL_USER || 'rithub@zohomail.eu'
      },
      to: email,
      subject: 'Password Reset - RitHub',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset Request</h2>
          <p>Hello ${firstName || 'there'},</p>
          <p>We received a request to reset your password for your RitHub account.</p>
          <p>Your new password is: <strong style="background-color: #f5f5f5; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</strong></p>
          <p><strong>Important:</strong></p>
          <ul>
            <li>This password will expire in 24 hours</li>
            <li>You can use this password to log in immediately</li>
            <li>We recommend changing it to a password of your choice when convenient</li>
          </ul>
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
          <p style="font-size: 12px; color: #666;">
            This is an automated message from the RitHub platform.
          </p>
        </div>
      `,
      text: `Password Reset Request\n\nHello ${firstName || 'there'},\n\nWe received a request to reset your password for your RitHub account.\n\nYour new password is: ${tempPassword}\n\nImportant:\n- This password will expire in 24 hours\n- You can use this password to log in immediately\n- We recommend changing it to a password of your choice when convenient\n\nIf you didn't request this password reset, please ignore this email or contact support if you have concerns.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending password reset email:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log(`FALLBACK - Password reset for ${email}: Temporary password is ${tempPassword}`);
      return { success: true, fallback: true };
    }

    return { success: false, error: error.message };
  }
};

const sendWelcomeEmail = async (email, firstName) => {
  console.log(`Sending welcome email to ${email}`);
  return { success: true, message: 'Welcome email functionality ready' };
};

const sendDeadlineNotification = async (email, studyTitle, hoursRemaining) => {
  console.log(`Sending deadline notification to ${email} for study "${studyTitle}" (${hoursRemaining}h remaining)`);

  try {
    const transporter = nodemailer.createTransport({
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

    const timeMessage = hoursRemaining === 24 
      ? '24 hours' 
      : hoursRemaining === 1 
        ? '1 hour' 
        : `${hoursRemaining} hours`;

    const mailOptions = {
      from: {
        name: 'RitHub',
        address: process.env.EMAIL_USER || 'rithub@zohomail.eu'
      },
      to: email,
      subject: `Study Deadline Approaching - ${studyTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Study Deadline Reminder</h2>
          <p>This is a reminder that the study "<strong>${studyTitle}</strong>" will close in <strong>${timeMessage}</strong>.</p>
          <p>Please complete your evaluation before the deadline to ensure your responses are included.</p>
          <p>Thank you for your participation!</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">
          <p style="font-size: 12px; color: #666;">
            This is an automated notification from the RitHub platform.
          </p>
        </div>
      `,
      text: `Study Deadline Reminder\n\nThe study "${studyTitle}" will close in ${timeMessage}.\n\nPlease complete your evaluation before the deadline to ensure your responses are included.\n\nThank you for your participation!`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Deadline notification sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending deadline notification:', error);

    if (process.env.NODE_ENV === 'development') {
      console.log(`FALLBACK - Deadline notification for ${email}: Study "${studyTitle}" closes in ${hoursRemaining}h`);
      return { success: true, fallback: true };
    }

    return { success: false, error: error.message };
  }
};

const testEmailConnection = async () => {
  try {
    const transporter = nodemailer.createTransport({
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

    await transporter.verify();
    console.log('Email service connection successful');
    return { success: true, message: 'Email service connected successfully' };
  } catch (error) {
    console.error('Email service connection failed:', error.message);
    return { success: false, error: error.message };
  }
};

const studyNotifications = require('./studyNotificationService');

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendDeadlineNotification,
  testEmailConnection,
  // Study notification functions
  sendStudyCancellationNotification: studyNotifications.sendStudyCancellationNotification,
  sendAdminCancellationNotification: studyNotifications.sendAdminCancellationNotification,
  sendCapacityApproachingNotification: studyNotifications.sendCapacityApproachingNotification,
  shouldSendCapacityNotification: studyNotifications.shouldSendCapacityNotification
};