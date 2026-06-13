const db = require('../config/db');
const { logAction } = require('../services/auditService');
const { parseCSVDate } = require('../services/anomalyEngine');

// GET /expenses
// Query params: group_id
const getExpenses = async (req, res) => {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: 'group_id query parameter is required.' });
  }

  try {
    const query = `
      SELECT e.*, u.name as paid_by_name, u.email as paid_by_email
      FROM expenses e
      LEFT JOIN users u ON e.paid_by = u.id
      WHERE e.group_id = $1
      ORDER BY e.expense_date DESC, e.created_at DESC
    `;
    const result = await db.query(query, [group_id]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getExpenses error:', err);
    return res.status(500).json({ error: 'Database error fetching expenses.' });
  }
};

// GET /expenses/:id
const getExpenseById = async (req, res) => {
  const expenseId = req.params.id;

  try {
    const expenseRes = await db.query(
      `SELECT e.*, u.name as paid_by_name, u.email as paid_by_email
       FROM expenses e
       LEFT JOIN users u ON e.paid_by = u.id
       WHERE e.id = $1`,
      [expenseId]
    );

    if (expenseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    const splitsRes = await db.query(
      `SELECT es.*, u.name as user_name, u.email as user_email
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1`,
      [expenseId]
    );

    return res.json({
      expense: expenseRes.rows[0],
      splits: splitsRes.rows
    });
  } catch (err) {
    console.error('getExpenseById error:', err);
    return res.status(500).json({ error: 'Database error fetching expense details.' });
  }
};

// POST /expenses
const createExpense = async (req, res) => {
  const {
    group_id,
    title,
    description,
    original_amount,
    original_currency,
    exchange_rate: manualRate,
    expense_date,
    paid_by,
    split_type,
    splits // Array: [{ user_id, split_value }]
  } = req.body;
  const creatorId = req.user.id;

  if (!group_id || !title || !original_amount || !paid_by || !split_type || !splits || splits.length === 0) {
    return res.status(400).json({ error: 'Missing required expense fields.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Determine exchange rate
    let rate = 1.000000;
    const currency = (original_currency || 'INR').toUpperCase();
    const expDate = new Date(expense_date || new Date());
    const dateStr = expDate.toISOString().split('T')[0];

    if (currency === 'USD') {
      if (manualRate) {
        rate = parseFloat(manualRate);
      } else {
        const rateRes = await client.query(
          "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'INR' AND effective_date = $1",
          [dateStr]
        );
        if (rateRes.rows.length > 0) {
          rate = parseFloat(rateRes.rows[0].rate);
        } else {
          rate = 83.50; // fallback
        }
      }
    }

    const amount = parseFloat(original_amount);
    const convertedAmount = amount * rate;

    // 2. Validate Splits Sums based on split_type
    const splitCount = splits.length;
    let computedSplits = []; // [{ user_id, split_value, owed_amount_in_inr }]

    if (split_type === 'equal') {
      const shareAmount = convertedAmount / splitCount;
      computedSplits = splits.map(s => ({
        user_id: s.user_id,
        split_value: 1,
        owed_amount_in_inr: shareAmount
      }));
    } else if (split_type === 'percentage') {
      let sumPct = 0;
      splits.forEach(s => { sumPct += parseFloat(s.split_value); });
      
      if (Math.abs(sumPct - 100) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Percentages must sum to 100%. Got ${sumPct}%` });
      }

      computedSplits = splits.map(s => ({
        user_id: s.user_id,
        split_value: parseFloat(s.split_value),
        owed_amount_in_inr: (parseFloat(s.split_value) / 100) * convertedAmount
      }));
    } else if (split_type === 'share') {
      let sumShares = 0;
      splits.forEach(s => { sumShares += parseFloat(s.split_value); });

      if (sumShares <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Sum of shares must be greater than zero.' });
      }

      computedSplits = splits.map(s => ({
        user_id: s.user_id,
        split_value: parseFloat(s.split_value),
        owed_amount_in_inr: (parseFloat(s.split_value) / sumShares) * convertedAmount
      }));
    } else if (split_type === 'unequal') { // exact amounts
      let sumAmt = 0;
      splits.forEach(s => { sumAmt += parseFloat(s.split_value); });

      if (Math.abs(sumAmt - amount) > 0.02) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Exact amounts must sum up to expense total (${amount}). Got ${sumAmt}` });
      }

      computedSplits = splits.map(s => ({
        user_id: s.user_id,
        split_value: parseFloat(s.split_value),
        owed_amount_in_inr: parseFloat(s.split_value) * rate
      }));
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Unsupported split type: ${split_type}` });
    }

    // 3. Save Expense
    const expenseRes = await client.query(
      `INSERT INTO expenses (group_id, title, description, original_amount, original_currency, exchange_rate, converted_amount_in_inr, expense_date, paid_by, created_by, split_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [group_id, title.trim(), description ? description.trim() : '', amount, currency, rate, convertedAmount, expDate, paid_by, creatorId, split_type]
    );
    const expense = expenseRes.rows[0];

    // 4. Save splits
    for (const cs of computedSplits) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, split_value, owed_amount_in_inr)
         VALUES ($1, $2, $3, $4)`,
        [expense.id, cs.user_id, cs.split_value, cs.owed_amount_in_inr]
      );
    }

    // Audit Log
    await logAction({
      client,
      actionType: 'CREATE_EXPENSE',
      entityType: 'expense',
      entityId: expense.id,
      performedBy: creatorId,
      newValues: { ...expense, splits: computedSplits }
    });

    await client.query('COMMIT');
    return res.status(201).json(expense);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createExpense error:', err);
    return res.status(500).json({ error: 'Database error creating expense.' });
  } finally {
    client.release();
  }
};

// PUT /expenses/:id
const updateExpense = async (req, res) => {
  const expenseId = req.params.id;
  const {
    title,
    description,
    original_amount,
    original_currency,
    exchange_rate: manualRate,
    expense_date,
    paid_by,
    split_type,
    splits
  } = req.body;
  const updaterId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch old expense
    const oldExpenseRes = await client.query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
    if (oldExpenseRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found.' });
    }
    const oldExpense = oldExpenseRes.rows[0];

    const oldSplitsRes = await client.query('SELECT * FROM expense_splits WHERE expense_id = $1', [expenseId]);
    const oldSplits = oldSplitsRes.rows;

    // Determine exchange rate
    let rate = oldExpense.exchange_rate;
    const currency = (original_currency || oldExpense.original_currency).toUpperCase();
    const expDate = expense_date ? new Date(expense_date) : new Date(oldExpense.expense_date);
    const dateStr = expDate.toISOString().split('T')[0];

    if (currency === 'USD') {
      if (manualRate) {
        rate = parseFloat(manualRate);
      } else {
        const rateRes = await client.query(
          "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'INR' AND effective_date = $1",
          [dateStr]
        );
        if (rateRes.rows.length > 0) {
          rate = parseFloat(rateRes.rows[0].rate);
        } else {
          rate = 83.50; // fallback
        }
      }
    } else {
      rate = 1.000000;
    }

    const amount = original_amount !== undefined ? parseFloat(original_amount) : parseFloat(oldExpense.original_amount);
    const convertedAmount = amount * rate;
    const resolvedSplitType = split_type || oldExpense.split_type;

    // Check if new splits details are provided
    let computedSplits = [];
    if (splits && splits.length > 0) {
      const splitCount = splits.length;
      if (resolvedSplitType === 'equal') {
        const shareAmount = convertedAmount / splitCount;
        computedSplits = splits.map(s => ({
          user_id: s.user_id,
          split_value: 1,
          owed_amount_in_inr: shareAmount
        }));
      } else if (resolvedSplitType === 'percentage') {
        let sumPct = 0;
        splits.forEach(s => { sumPct += parseFloat(s.split_value); });
        
        if (Math.abs(sumPct - 100) > 0.01) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Percentages must sum to 100%. Got ${sumPct}%` });
        }

        computedSplits = splits.map(s => ({
          user_id: s.user_id,
          split_value: parseFloat(s.split_value),
          owed_amount_in_inr: (parseFloat(s.split_value) / 100) * convertedAmount
        }));
      } else if (resolvedSplitType === 'share') {
        let sumShares = 0;
        splits.forEach(s => { sumShares += parseFloat(s.split_value); });

        if (sumShares <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Sum of shares must be greater than zero.' });
        }

        computedSplits = splits.map(s => ({
          user_id: s.user_id,
          split_value: parseFloat(s.split_value),
          owed_amount_in_inr: (parseFloat(s.split_value) / sumShares) * convertedAmount
        }));
      } else if (resolvedSplitType === 'unequal') {
        let sumAmt = 0;
        splits.forEach(s => { sumAmt += parseFloat(s.split_value); });

        if (Math.abs(sumAmt - amount) > 0.02) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Exact amounts must sum up to expense total (${amount}). Got ${sumAmt}` });
        }

        computedSplits = splits.map(s => ({
          user_id: s.user_id,
          split_value: parseFloat(s.split_value),
          owed_amount_in_inr: parseFloat(s.split_value) * rate
        }));
      }
    } else {
      // Re-calculate existing splits with new amount/rate
      const splitCount = oldSplits.length;
      if (resolvedSplitType === 'equal') {
        const shareAmount = convertedAmount / splitCount;
        computedSplits = oldSplits.map(s => ({
          user_id: s.user_id,
          split_value: 1,
          owed_amount_in_inr: shareAmount
        }));
      } else if (resolvedSplitType === 'percentage') {
        computedSplits = oldSplits.map(s => ({
          user_id: s.user_id,
          split_value: parseFloat(s.split_value),
          owed_amount_in_inr: (parseFloat(s.split_value) / 100) * convertedAmount
        }));
      } else if (resolvedSplitType === 'share') {
        let sumShares = 0;
        oldSplits.forEach(s => { sumShares += parseFloat(s.split_value); });
        computedSplits = oldSplits.map(s => ({
          user_id: s.user_id,
          split_value: parseFloat(s.split_value),
          owed_amount_in_inr: (parseFloat(s.split_value) / sumShares) * convertedAmount
        }));
      } else if (resolvedSplitType === 'unequal') {
        // Mismatch can occur if amount changed but splits weren't sent. Error out.
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'You must provide splits detail when updating exact unequal split amounts.' });
      }
    }

    // Update Expense row
    const result = await client.query(
      `UPDATE expenses 
       SET title = $1, description = $2, original_amount = $3, original_currency = $4, 
           exchange_rate = $5, converted_amount_in_inr = $6, expense_date = $7, 
           paid_by = $8, split_type = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [
        title !== undefined ? title.trim() : oldExpense.title,
        description !== undefined ? description.trim() : oldExpense.description,
        amount,
        currency,
        rate,
        convertedAmount,
        expDate,
        paid_by || oldExpense.paid_by,
        resolvedSplitType,
        expenseId
      ]
    );
    const updatedExpense = result.rows[0];

    // Replace Splits: Delete old splits, insert new
    await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [expenseId]);
    
    for (const cs of computedSplits) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, split_value, owed_amount_in_inr)
         VALUES ($1, $2, $3, $4)`,
        [expenseId, cs.user_id, cs.split_value, cs.owed_amount_in_inr]
      );
    }

    // Audit Log
    await logAction({
      client,
      actionType: 'UPDATE_EXPENSE',
      entityType: 'expense',
      entityId: expenseId,
      performedBy: updaterId,
      oldValues: { ...oldExpense, splits: oldSplits },
      newValues: { ...updatedExpense, splits: computedSplits }
    });

    await client.query('COMMIT');
    return res.json(updatedExpense);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateExpense error:', err);
    return res.status(500).json({ error: 'Database error updating expense.' });
  } finally {
    client.release();
  }
};

// DELETE /expenses/:id
const deleteExpense = async (req, res) => {
  const expenseId = req.params.id;
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch details for audit log
    const oldExpenseRes = await client.query('SELECT * FROM expenses WHERE id = $1', [expenseId]);
    if (oldExpenseRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found.' });
    }
    const oldExpense = oldExpenseRes.rows[0];

    const oldSplitsRes = await client.query('SELECT * FROM expense_splits WHERE expense_id = $1', [expenseId]);
    const oldSplits = oldSplitsRes.rows;

    await client.query('DELETE FROM expenses WHERE id = $1', [expenseId]);

    // Audit Log
    await logAction({
      client,
      actionType: 'DELETE_EXPENSE',
      entityType: 'expense',
      entityId: expenseId,
      performedBy: userId,
      oldValues: { ...oldExpense, splits: oldSplits }
    });

    await client.query('COMMIT');
    return res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteExpense error:', err);
    return res.status(500).json({ error: 'Database error deleting expense.' });
  } finally {
    client.release();
  }
};

module.exports = {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense
};
