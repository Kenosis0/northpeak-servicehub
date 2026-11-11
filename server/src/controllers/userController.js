const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { VALID_ROLES } = require('../middleware/authMiddleware');
const { logAction } = require('../utils/auditLogger');

/**
 * GET /api/users (Administrator only — TC-014)
 * Lists all users with optional role and search filters
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, is_active, search } = req.query;
    const conditions = [];
    const params = [];

    if (role) {
      conditions.push('u.role = ?');
      params.push(role);
    }

    if (is_active !== undefined && is_active !== '') {
      conditions.push('u.is_active = ?');
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    if (search) {
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      const likeTerm = `%${search.trim()}%`;
      params.push(likeTerm, likeTerm, likeTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.specialization, u.is_active, u.created_at, u.updated_at,
              c.customer_id, c.customer_type, c.company_name, c.billing_address, c.service_address
       FROM users u
       LEFT JOIN customers c ON u.user_id = c.user_id
       ${whereClause}
       ORDER BY u.created_at DESC`,
      params
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      users: rows
    });
  } catch (error) {
    console.error('[userController.getAllUsers Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users.',
      error: error.message
    });
  }
};

/**
 * POST /api/users (Administrator only)
 * Creates a user account in any of the 5 strictly enforced roles
 */
const createUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      full_name,
      email,
      phone,
      password = 'Password123!',
      role,
      specialization = null,
      is_active = true,
      customer_type = 'Residential',
      company_name = null,
      billing_address = 'Main Address',
      service_address = 'Main Address'
    } = req.body;

    if (!full_name || !email || !phone || !role) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Full name, email, phone, and role are required.'
      });
    }

    if (!VALID_ROLES.includes(role)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Invalid role '${role}'. Allowed roles are strictly: ${VALID_ROLES.join(', ')}.`
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
        message: 'A user with this email address already exists.'
      });
    }

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await connection.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, specialization, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        passwordHash,
        role,
        role === 'Technician' ? specialization : null,
        Boolean(is_active)
      ]
    );

    const newUserId = result.insertId;
    let newCustomerId = null;

    if (role === 'Customer') {
      const [custResult] = await connection.query(
        `INSERT INTO customers (user_id, customer_type, company_name, full_name, email, phone, billing_address, service_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newUserId,
          ['Residential', 'Commercial'].includes(customer_type) ? customer_type : 'Residential',
          company_name,
          full_name.trim(),
          email.trim().toLowerCase(),
          phone.trim(),
          billing_address,
          service_address
        ]
      );
      newCustomerId = custResult.insertId;
    }

    await logAction(
      connection,
      req.user,
      'USER_CREATED',
      'users',
      newUserId,
      `Created ${role} user ${email.trim().toLowerCase()}`
    );

    await connection.commit();
    connection.release();

    return res.status(201).json({
      success: true,
      message: `User account (${role}) created successfully.`,
      user: {
        user_id: newUserId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        specialization: role === 'Technician' ? specialization : null,
        is_active: Boolean(is_active),
        customer_id: newCustomerId
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[userController.createUser Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user.',
      error: error.message
    });
  }
};

/**
 * PATCH /api/users/:id (Administrator only)
 * Updates user role, specialization, contact details, password, or active status
 */
const updateUser = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { full_name, phone, role, specialization, is_active, password } = req.body;

    const [existingRows] = await connection.query(
      'SELECT * FROM users WHERE user_id = ? LIMIT 1',
      [id]
    );
    if (existingRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const current = existingRows[0];

    if (role && !VALID_ROLES.includes(role)) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Invalid role '${role}'. Allowed roles are strictly: ${VALID_ROLES.join(', ')}.`
      });
    }

    if (
      Number(id) === Number(req.user.user_id) &&
      is_active !== undefined &&
      !Boolean(is_active)
    ) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own Administrator account.'
      });
    }

    await connection.beginTransaction();

    const updatedName = full_name !== undefined ? full_name.trim() : current.full_name;
    const updatedPhone = phone !== undefined ? phone.trim() : current.phone;
    const updatedRole = role !== undefined ? role : current.role;
    const updatedSpec =
      specialization !== undefined
        ? specialization
        : updatedRole === 'Technician'
        ? current.specialization
        : null;
    const updatedActive = is_active !== undefined ? Boolean(is_active) : Boolean(current.is_active);

    let passwordHash = current.password_hash;
    if (password && String(password).trim().length > 0) {
      passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }

    await connection.query(
      `UPDATE users
       SET full_name = ?, phone = ?, role = ?, specialization = ?, is_active = ?, password_hash = ?
       WHERE user_id = ?`,
      [updatedName, updatedPhone, updatedRole, updatedSpec, updatedActive, passwordHash, id]
    );

    await logAction(
      connection,
      req.user,
      'USER_UPDATED',
      'users',
      id,
      {
        full_name: updatedName,
        role: updatedRole,
        is_active: updatedActive
      }
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: {
        user_id: Number(id),
        full_name: updatedName,
        email: current.email,
        phone: updatedPhone,
        role: updatedRole,
        specialization: updatedSpec,
        is_active: updatedActive
      }
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('[userController.updateUser Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user.',
      error: error.message
    });
  }
};

/**
 * GET /api/technicians (Service Staff, Technician, Administrator)
 * Lists active technicians for schedule dispatch and filtering
 */
const getActiveTechnicians = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.specialization, u.is_active,
              (SELECT COUNT(*) FROM work_orders wo
               WHERE wo.technician_id = u.user_id
                 AND wo.status IN ('Scheduled', 'En Route', 'In Progress')) AS active_jobs_count
       FROM users u
       WHERE u.role = 'Technician' AND u.is_active = TRUE
       ORDER BY u.full_name ASC`
    );

    return res.status(200).json({
      success: true,
      technicians: rows
    });
  } catch (error) {
    console.error('[userController.getActiveTechnicians Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active technicians.',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  updateUser,
  getActiveTechnicians
};
