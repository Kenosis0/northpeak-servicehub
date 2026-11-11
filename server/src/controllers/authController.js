const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { logAction } = require('../utils/auditLogger');
const { createNotification } = require('../utils/notifyHelper');

/**
 * POST /api/auth/login
 * Validates email/password, checks is_active, logs audit event, returns { token, user }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const [rows] = await pool.query(
      `SELECT u.*, c.customer_id, c.customer_type, c.company_name, c.billing_address, c.service_address
       FROM users u
       LEFT JOIN customers c ON u.user_id = c.user_id
       WHERE LOWER(u.email) = LOWER(?)
       LIMIT 1`,
      [email.trim()]
    );

    if (rows.length === 0) {
      await logAction(pool, null, 'LOGIN_FAILED', 'users', null, { email, reason: 'User not found' });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const userRecord = rows[0];

    if (!userRecord.is_active) {
      await logAction(
        pool,
        { user_id: userRecord.user_id, role: userRecord.role },
        'LOGIN_BLOCKED_INACTIVE',
        'users',
        userRecord.user_id,
        'Attempted login on deactivated account'
      );
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the Administrator.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, userRecord.password_hash);
    if (!isPasswordValid) {
      await logAction(
        pool,
        { user_id: userRecord.user_id, role: userRecord.role },
        'LOGIN_FAILED',
        'users',
        userRecord.user_id,
        'Invalid password'
      );
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const payload = {
      user_id: userRecord.user_id,
      role: userRecord.role,
      customer_id: userRecord.customer_id || null,
      full_name: userRecord.full_name,
      email: userRecord.email
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    await logAction(
      pool,
      payload,
      'USER_LOGIN',
      'users',
      userRecord.user_id,
      `User ${userRecord.email} (${userRecord.role}) logged in successfully`
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        user_id: userRecord.user_id,
        full_name: userRecord.full_name,
        email: userRecord.email,
        phone: userRecord.phone,
        role: userRecord.role,
        specialization: userRecord.specialization,
        is_active: Boolean(userRecord.is_active),
        customer_id: userRecord.customer_id || null,
        customer_type: userRecord.customer_type || null,
        company_name: userRecord.company_name || null,
        billing_address: userRecord.billing_address || null,
        service_address: userRecord.service_address || null
      }
    });
  } catch (error) {
    console.error('[authController.login Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message
    });
  }
};

/**
 * POST /api/auth/register
 * Creates a Customer account in users AND a linked profile in customers inside an ACID transaction
 */
const register = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      full_name,
      email,
      phone,
      password,
      customer_type = 'Residential',
      company_name = null,
      billing_address,
      service_address,
      address
    } = req.body;

    const resolvedBillingAddress = billing_address || address || service_address || '';
    const resolvedServiceAddress = service_address || address || billing_address || '';

    if (!full_name || !email || !phone || !password || !resolvedBillingAddress || !resolvedServiceAddress) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Full name, email, phone, password, billing address, and service address are required.'
      });
    }

    const [existing] = await connection.query(
      'SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );
    if (existing.length > 0) {
      connection.release();
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);

    const [userResult] = await connection.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'Customer', TRUE)`,
      [full_name.trim(), email.trim().toLowerCase(), phone.trim(), passwordHash]
    );

    const newUserId = userResult.insertId;

    const validCustomerType = ['Residential', 'Commercial'].includes(customer_type)
      ? customer_type
      : 'Residential';

    const [custResult] = await connection.query(
      `INSERT INTO customers (user_id, customer_type, company_name, full_name, email, phone, billing_address, service_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        validCustomerType,
        company_name ? company_name.trim() : null,
        full_name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        resolvedBillingAddress.trim(),
        resolvedServiceAddress.trim()
      ]
    );

    const newCustomerId = custResult.insertId;

    const userContext = {
      user_id: newUserId,
      role: 'Customer',
      customer_id: newCustomerId,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase()
    };

    await logAction(
      connection,
      userContext,
      'CUSTOMER_REGISTER',
      'customers',
      newCustomerId,
      `Self-registered Customer account (${email.trim().toLowerCase()})`
    );

    await createNotification(
      connection,
      newUserId,
      'Welcome to NorthPeak ServiceHub',
      'Your customer account is active. You can now submit aircon purchase inquiries, book service requests, and track your equipment maintenance.'
    );

    await connection.commit();
    connection.release();

    const token = jwt.sign(userContext, JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });

    return res.status(201).json({
      success: true,
      message: 'Customer registration successful.',
      token,
      user: {
        user_id: newUserId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role: 'Customer',
        is_active: true,
        customer_id: newCustomerId,
        customer_type: validCustomerType,
        company_name: company_name ? company_name.trim() : null,
        billing_address: resolvedBillingAddress.trim(),
        service_address: resolvedServiceAddress.trim()
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[authController.register Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register customer account.',
      error: error.message
    });
  }
};

/**
 * GET /api/auth/me
 * Returns authenticated user profile and notifications
 */
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.specialization, u.is_active, u.created_at,
              c.customer_id, c.customer_type, c.company_name, c.billing_address, c.service_address
       FROM users u
       LEFT JOIN customers c ON u.user_id = c.user_id
       WHERE u.user_id = ?
       LIMIT 1`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: rows[0]
    });
  } catch (error) {
    console.error('[authController.getMe Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user profile.',
      error: error.message
    });
  }
};

/**
 * GET /api/notifications
 * Returns in-app notifications for the current user
 */
const getNotifications = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.user_id]
    );
    const unreadCount = rows.filter((n) => !n.is_read).length;
    return res.status(200).json({
      success: true,
      unread_count: unreadCount,
      notifications: rows
    });
  } catch (error) {
    console.error('[authController.getNotifications Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?`,
      [id, req.user.user_id]
    );
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/notifications/read-all
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ?`,
      [req.user.user_id]
    );
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read.',
      error: error.message
    });
  }
};

module.exports = {
  login,
  register,
  getMe,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
