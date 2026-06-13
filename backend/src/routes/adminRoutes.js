const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/audit-logs', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.performed_by = u.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `;
    const result = await db.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error('fetch audit-logs error:', err);
    return res.status(500).json({ error: 'Database error fetching audit logs.' });
  }
});

module.exports = router;
