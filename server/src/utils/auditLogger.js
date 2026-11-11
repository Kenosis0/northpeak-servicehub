const defaultPool = require('../config/db');

/**
 * Writes an immutable audit record to audit_logs
 * @param {object} dbConnOrPool - MySQL pool or transaction connection
 * @param {object|null} user - req.user ({ user_id, role })
 * @param {string} action - Action code or summary (e.g., 'USER_LOGIN', 'QUOTATION_REVISED')
 * @param {string} entityName - Table/domain entity name
 * @param {string|number|null} entityId - Primary key or reference number
 * @param {string|object|null} details - Additional context
 */
async function logAction(dbConnOrPool, user, action, entityName, entityId = null, details = null) {
  const executor = dbConnOrPool && typeof dbConnOrPool.query === 'function' ? dbConnOrPool : defaultPool;
  try {
    const userId = user?.user_id || null;
    const userRole = user?.role || null;
    const serializedDetails =
      details === null || details === undefined
        ? null
        : typeof details === 'string'
        ? details
        : JSON.stringify(details);

    await executor.query(
      `INSERT INTO audit_logs (user_id, user_role, action, entity_name, entity_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userRole,
        action,
        entityName,
        entityId !== null && entityId !== undefined ? String(entityId) : null,
        serializedDetails
      ]
    );
  } catch (err) {
    console.error('[AuditLogger Error]:', err.message);
  }
}

module.exports = {
  logAction
};
