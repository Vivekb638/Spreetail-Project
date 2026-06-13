const db = require('../config/db');

/**
 * Creates an audit log entry.
 * Can be run within a transaction by providing the transaction client.
 */
const logAction = async ({
  client,
  actionType,
  entityType,
  entityId,
  performedBy,
  oldValues = null,
  newValues = null
}) => {
  const dbClient = client || db;
  const queryText = `
    INSERT INTO audit_logs (action_type, entity_type, entity_id, performed_by, old_values, new_values)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;
  const params = [
    actionType,
    entityType,
    entityId,
    performedBy,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null
  ];

  try {
    const res = await dbClient.query(queryText, params);
    return res.rows[0].id;
  } catch (err) {
    console.error('Failed to write audit log:', err);
    // Do not throw to avoid crashing parent operation, but log error
  }
};

module.exports = {
  logAction
};
