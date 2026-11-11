const nodemailer = require('nodemailer');
const defaultPool = require('../config/db');

let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Creates an in-app notification for a specific user_id and optionally dispatches SMTP email
 */
async function createNotification(dbConnOrPool, userId, title, message, emailTo = null) {
  if (!userId) return;
  const executor = dbConnOrPool && typeof dbConnOrPool.query === 'function' ? dbConnOrPool : defaultPool;
  try {
    await executor.query(
      `INSERT INTO notifications (user_id, title, message, is_read)
       VALUES (?, ?, ?, FALSE)`,
      [userId, title, message]
    );

    if (transporter && emailTo) {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"NorthPeak ServiceHub" <noreply@northpeak.ph>',
        to: emailTo,
        subject: `[NorthPeak ServiceHub] ${title}`,
        text: message
      });
    }
  } catch (err) {
    console.error('[NotifyHelper Error]:', err.message);
  }
}

/**
 * Creates in-app notifications for all active users matching the given role(s)
 */
async function notifyRoles(dbConnOrPool, roles, title, message) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  if (roleList.length === 0) return;
  const executor = dbConnOrPool && typeof dbConnOrPool.query === 'function' ? dbConnOrPool : defaultPool;
  try {
    const placeholders = roleList.map(() => '?').join(', ');
    const [users] = await executor.query(
      `SELECT user_id FROM users WHERE role IN (${placeholders}) AND is_active = TRUE`,
      roleList
    );
    for (const u of users) {
      await executor.query(
        `INSERT INTO notifications (user_id, title, message, is_read)
         VALUES (?, ?, ?, FALSE)`,
        [u.user_id, title, message]
      );
    }
  } catch (err) {
    console.error('[NotifyRoles Error]:', err.message);
  }
}

module.exports = {
  createNotification,
  notifyRoles
};
