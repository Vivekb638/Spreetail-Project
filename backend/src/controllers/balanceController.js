const { calculateGroupBalances, simplifySettlements } = require('../services/balanceEngine');

// GET /groups/:id/balance
const getGroupBalance = async (req, res) => {
  const groupId = req.params.id;
  try {
    const balances = await calculateGroupBalances(groupId);
    return res.json(balances);
  } catch (err) {
    console.error('getGroupBalance error:', err);
    return res.status(500).json({ error: 'Database error calculating group balances.' });
  }
};

// GET /users/:id/balance
// Query param: group_id
const getUserBalance = async (req, res) => {
  const userId = req.params.id;
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: 'group_id query parameter is required.' });
  }

  try {
    const balances = await calculateGroupBalances(group_id);
    const userBalance = balances[userId];

    if (!userBalance) {
      return res.status(404).json({ error: 'User membership or balances not found in this group.' });
    }

    return res.json(userBalance);
  } catch (err) {
    console.error('getUserBalance error:', err);
    return res.status(500).json({ error: 'Database error fetching user balance.' });
  }
};

// GET /groups/:id/simplified-settlements
const getSimplifiedSettlements = async (req, res) => {
  const groupId = req.params.id;
  try {
    const balances = await calculateGroupBalances(groupId);
    const transactions = simplifySettlements(balances);
    return res.json(transactions);
  } catch (err) {
    console.error('getSimplifiedSettlements error:', err);
    return res.status(500).json({ error: 'Database error simplifying settlements.' });
  }
};

module.exports = {
  getGroupBalance,
  getUserBalance,
  getSimplifiedSettlements
};
