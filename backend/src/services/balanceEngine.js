const db = require('../config/db');

// Calculate balances and breakdowns for a group
const calculateGroupBalances = async (groupId) => {
  // 1. Fetch group members
  const membersRes = await db.query(
    `SELECT gm.id as membership_id, gm.joined_at, gm.left_at, u.id, u.name, u.email
     FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     WHERE gm.group_id = $1`,
    [groupId]
  );
  const members = membersRes.rows;

  // 2. Fetch all expenses for this group
  const expensesRes = await db.query(
    `SELECT e.id, e.title, e.description, e.original_amount, e.original_currency, 
            e.exchange_rate, e.converted_amount_in_inr, e.expense_date, e.paid_by, e.split_type
     FROM expenses e
     WHERE e.group_id = $1
     ORDER BY e.expense_date ASC`,
    [groupId]
  );
  const expenses = expensesRes.rows;

  // 3. Fetch all expense splits for this group
  const splitsRes = await db.query(
    `SELECT es.id, es.expense_id, es.user_id, es.split_value, es.owed_amount_in_inr,
            e.title as expense_title, e.expense_date, e.paid_by
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     WHERE e.group_id = $1`,
    [groupId]
  );
  const splits = splitsRes.rows;

  // 4. Fetch all settlements for this group
  const settlementsRes = await db.query(
    `SELECT s.id, s.payer_id, s.receiver_id, s.amount, s.currency, 
            s.exchange_rate, s.converted_amount_in_inr, s.settlement_date, s.note
     FROM settlements s
     WHERE s.group_id = $1
     ORDER BY s.settlement_date ASC`,
    [groupId]
  );
  const settlements = settlementsRes.rows;

  // Build mapping and initial states for each member
  const memberMap = {};
  const balances = {}; // userId -> balance details

  members.forEach(m => {
    memberMap[m.id] = m.name;
    balances[m.id] = {
      user: { id: m.id, name: m.name, email: m.email },
      totalPaid: 0,
      totalOwed: 0,
      settlementsSent: 0,
      settlementsReceived: 0,
      netExpenseBalance: 0, // Paid - Owed
      finalBalance: 0,      // (Paid - Owed) + Sent - Received
      breakdown: {
        paidExpenses: [], // Expenses they paid
        owedSplits: [],   // Expenses they owe for
        sentSettlements: [],
        receivedSettlements: []
      }
    };
  });

  // Process expenses paid
  expenses.forEach(e => {
    const paidBy = e.paid_by;
    if (balances[paidBy]) {
      const amountInr = parseFloat(e.converted_amount_in_inr);
      balances[paidBy].totalPaid += amountInr;
      balances[paidBy].breakdown.paidExpenses.push({
        id: e.id,
        title: e.title,
        originalAmount: parseFloat(e.original_amount),
        originalCurrency: e.original_currency,
        exchangeRate: parseFloat(e.exchange_rate),
        amountInr,
        date: e.expense_date
      });
    }
  });

  // Process splits owed
  splits.forEach(s => {
    const userId = s.user_id;
    if (balances[userId]) {
      const amountInr = parseFloat(s.owed_amount_in_inr);
      balances[userId].totalOwed += amountInr;
      
      // Look up who paid it
      const paidByName = memberMap[s.paid_by] || 'Unknown';

      balances[userId].breakdown.owedSplits.push({
        expenseId: s.expense_id,
        title: s.expense_title,
        paidByUserId: s.paid_by,
        paidByName,
        shareValue: parseFloat(s.split_value),
        amountInr,
        date: s.expense_date
      });
    }
  });

  // Process settlements
  settlements.forEach(s => {
    const payerId = s.payer_id;
    const receiverId = s.receiver_id;
    const amountInr = parseFloat(s.converted_amount_in_inr);

    if (balances[payerId]) {
      balances[payerId].settlementsSent += amountInr;
      balances[payerId].breakdown.sentSettlements.push({
        id: s.id,
        receiverName: memberMap[receiverId] || 'Unknown',
        receiverId,
        originalAmount: parseFloat(s.amount),
        originalCurrency: s.currency,
        exchangeRate: parseFloat(s.exchange_rate),
        amountInr,
        date: s.settlement_date,
        note: s.note
      });
    }

    if (balances[receiverId]) {
      balances[receiverId].settlementsReceived += amountInr;
      balances[receiverId].breakdown.receivedSettlements.push({
        id: s.id,
        payerName: memberMap[payerId] || 'Unknown',
        payerId,
        originalAmount: parseFloat(s.amount),
        originalCurrency: s.currency,
        exchangeRate: parseFloat(s.exchange_rate),
        amountInr,
        date: s.settlement_date,
        note: s.note
      });
    }
  });

  // Finalize Net & Final Balances
  Object.keys(balances).forEach(userId => {
    const b = balances[userId];
    b.netExpenseBalance = b.totalPaid - b.totalOwed;
    b.finalBalance = b.netExpenseBalance + b.settlementsSent - b.settlementsReceived;
    
    // Round to 2 decimals for monetary representation
    b.totalPaid = Math.round(b.totalPaid * 100) / 100;
    b.totalOwed = Math.round(b.totalOwed * 100) / 100;
    b.settlementsSent = Math.round(b.settlementsSent * 100) / 100;
    b.settlementsReceived = Math.round(b.settlementsReceived * 100) / 100;
    b.netExpenseBalance = Math.round(b.netExpenseBalance * 100) / 100;
    b.finalBalance = Math.round(b.finalBalance * 100) / 100;
  });

  return balances;
};

// Debt simplification algorithm (minimizes transfer transactions)
const simplifySettlements = (balances) => {
  const debtors = [];
  const creditors = [];

  // Group members into debtors (< 0) and creditors (> 0)
  Object.keys(balances).forEach(userId => {
    const finalBalance = balances[userId].finalBalance;
    const user = balances[userId].user;
    
    if (finalBalance < -0.01) {
      debtors.push({ id: user.id, name: user.name, balance: finalBalance });
    } else if (finalBalance > 0.01) {
      creditors.push({ id: user.id, name: user.name, balance: finalBalance });
    }
  });

  // Sort debtors ascending (most negative first) and creditors descending (most positive first)
  debtors.sort((a, b) => a.balance - b.balance);
  creditors.sort((a, b) => b.balance - a.balance);

  const transactions = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const oweAmt = Math.abs(debtor.balance);
    const getAmt = creditor.balance;

    const settleAmt = Math.min(oweAmt, getAmt);

    transactions.push({
      payerId: debtor.id,
      payerName: debtor.name,
      receiverId: creditor.id,
      receiverName: creditor.name,
      amount: Math.round(settleAmt * 100) / 100
    });

    debtor.balance += settleAmt;
    creditor.balance -= settleAmt;

    if (Math.abs(debtor.balance) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      cIdx++;
    }
  }

  return transactions;
};

module.exports = {
  calculateGroupBalances,
  simplifySettlements
};
