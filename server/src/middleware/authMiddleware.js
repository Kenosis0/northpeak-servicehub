const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'northpeak_servicehub_super_secret_jwt_key_2026';

const VALID_ROLES = [
  'Customer',
  'Service Staff',
  'Technician',
  'Inventory Staff',
  'Administrator'
];

/**
 * Verifies Bearer JWT token and attaches req.user = { user_id, role, customer_id, full_name, email }
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid Bearer token.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ensure customer_id is resolved for Customer role to enforce strict tenant isolation
    let customerId = decoded.customer_id || null;
    if (decoded.role === 'Customer' && !customerId) {
      const [custRows] = await pool.query(
        'SELECT customer_id FROM customers WHERE user_id = ? LIMIT 1',
        [decoded.user_id]
      );
      if (custRows.length > 0) {
        customerId = custRows[0].customer_id;
      }
    }

    req.user = {
      user_id: decoded.user_id,
      role: decoded.role,
      customer_id: customerId,
      full_name: decoded.full_name,
      email: decoded.email
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
};

/**
 * RBAC Guard: Restricts access to specific roles among the 5 system roles
 */
const requireRoles = (...allowedRoles) => {
  const flattenedRoles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No authenticated user context found.'
      });
    }

    if (!flattenedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access denied for role '${req.user.role}'. Required role(s): ${flattenedRoles.join(', ')}.`
      });
    }

    next();
  };
};

module.exports = {
  JWT_SECRET,
  VALID_ROLES,
  verifyToken,
  requireRoles
};
