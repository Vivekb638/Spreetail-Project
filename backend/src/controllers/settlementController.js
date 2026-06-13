const db = require('../config/db');
const { logAction } = require('../services/auditService');

// POST /settlements
const createSettlement = async (req, res) => {
  const { group_id, payer_id, receiver_id, amount, currency, settlement_date, note, exchange_rate: manualRate } = req.body;
  const creatorId = req.user.id;

  if (!group_id || !payer_id || !receiver_id || !amount || !settlement_date) {
    return res.status(400).json({ error: 'group_id, payer_id, receiver_id, amount, and settlement_date are required.' });
  }

  if (payer_id === receiver_id) {
    return res.status(400).json({ error: 'Payer and receiver cannot be the same person.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Determine exchange rate
    let rate = 1.000000;
    const originalCurrency = (currency || 'INR').toUpperCase();
    const sDate = new Date(settlement_date);
    const dateStr = sDate.toISOString().split('T')[0];

    if (originalCurrency === 'USD') {
      if (manualRate) {
        rate = parseFloat(manualRate);
      } else {
        // Look up exchange rate
        const rateRes = await client.query(
          "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'INR' AND effective_date = $1",
          [dateStr]
        );
        if (rateRes.rows.length > 0) {
          rate = parseFloat(rateRes.rows[0].rate);
        } else {
          // Default fallback
          rate = 83.500000;
        }
      }
    }

    const originalAmount = parseFloat(amount);
    const convertedAmount = originalAmount * rate;

    // 2. Insert Settlement
    const result = await client.query(
      `INSERT INTO settlements (group_id, payer_id, receiver_id, amount, currency, exchange_rate, converted_amount_in_inr, settlement_date, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [group_id, payer_id, receiver_id, originalAmount, originalCurrency, rate, convertedAmount, sDate, note ? note.trim() : '']
    );
    const settlement = result.rows[0];

    // Audit Log
    await logAction({
      client,
      actionType: 'CREATE_SETTLEMENT',
      entityType: 'settlement',
      entityId: settlement.id,
      performedBy: creatorId,
      newValues: settlement
    });

    await client.query('COMMIT');
    return res.status(201).json(settlement);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createSettlement error:', err);
    return res.status(500).json({ error: 'Database error creating settlement.' });
  } finally {
    client.release();
  }
};

// GET /settlements
// Query params: group_id, user_id
const getSettlements = async (req, res) => {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: 'group_id query parameter is required.' });
  }

  try {
    const query = `
      SELECT s.*, 
             p.name as payer_name, p.email as payer_email,
             r.name as receiver_name, r.email as receiver_email
      FROM settlements s
      JOIN users p ON s.payer_id = p.id
      JOIN users r ON s.receiver_id = r.id
      WHERE s.group_id = $1
      ORDER BY s.settlement_date DESC
    `;
    const result = await db.query(query, [group_id]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getSettlements error:', err);
    return res.status(500).json({ error: 'Database error fetching settlements.' });
  }
};

module.exports = {
  createSettlement,
  getSettlements
};
