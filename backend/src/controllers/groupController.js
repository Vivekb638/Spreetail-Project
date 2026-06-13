const db = require('../config/db');
const { logAction } = require('../services/auditService');

// GET /groups
const getGroups = async (req, res) => {
  const userId = req.user.id;
  try {
    const query = `
      SELECT g.*, 
        (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id AND left_at IS NULL) as active_member_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY g.created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getGroups error:', err);
    return res.status(500).json({ error: 'Database error fetching groups.' });
  }
};

// POST /groups
const createGroup = async (req, res) => {
  const { name, description } = req.body;
  const creatorId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Create Group
    const groupResult = await client.query(
      'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), description ? description.trim() : '']
    );
    const group = groupResult.rows[0];

    // Add Creator as Group Member
    await client.query(
      'INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
      [group.id, creatorId]
    );

    // Audit Log
    await logAction({
      client,
      actionType: 'CREATE_GROUP',
      entityType: 'group',
      entityId: group.id,
      performedBy: creatorId,
      newValues: group
    });

    await client.query('COMMIT');
    return res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createGroup error:', err);
    return res.status(500).json({ error: 'Database error creating group.' });
  } finally {
    client.release();
  }
};

// PUT /groups/:id
const updateGroup = async (req, res) => {
  const groupId = req.params.id;
  const { name, description } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const oldResult = await client.query('SELECT * FROM groups WHERE id = $1', [groupId]);
    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found.' });
    }
    const oldGroup = oldResult.rows[0];

    const result = await client.query(
      'UPDATE groups SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name.trim(), description ? description.trim() : '', groupId]
    );
    const updatedGroup = result.rows[0];

    await logAction({
      client,
      actionType: 'UPDATE_GROUP',
      entityType: 'group',
      entityId: groupId,
      performedBy: userId,
      oldValues: oldGroup,
      newValues: updatedGroup
    });

    await client.query('COMMIT');
    return res.json(updatedGroup);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateGroup error:', err);
    return res.status(500).json({ error: 'Database error updating group.' });
  } finally {
    client.release();
  }
};

// DELETE /groups/:id
const deleteGroup = async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query('SELECT * FROM groups WHERE id = $1', [groupId]);
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group not found.' });
    }
    const oldGroup = checkRes.rows[0];

    await client.query('DELETE FROM groups WHERE id = $1', [groupId]);

    await logAction({
      client,
      actionType: 'DELETE_GROUP',
      entityType: 'group',
      entityId: groupId,
      performedBy: userId,
      oldValues: oldGroup
    });

    await client.query('COMMIT');
    return res.json({ message: 'Group deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteGroup error:', err);
    return res.status(500).json({ error: 'Database error deleting group.' });
  } finally {
    client.release();
  }
};

// POST /groups/:id/members
// Add a member by email or user ID. If user doesn't exist, we can option to register/create user if needed.
const addMember = async (req, res) => {
  const groupId = req.params.id;
  const { email, userId: targetUserId, joinedAt } = req.body;
  const adminId = req.user.id;

  if (!email && !targetUserId) {
    return res.status(400).json({ error: 'Either email or user ID must be provided.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Find User ID
    let resolvedUserId;
    if (targetUserId) {
      resolvedUserId = targetUserId;
    } else {
      const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `User with email ${email} not found.` });
      }
      resolvedUserId = userRes.rows[0].id;
    }

    // Check if membership is already active
    const activeMem = await client.query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, resolvedUserId]
    );
    if (activeMem.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User is already an active member of this group.' });
    }

    const joinTimestamp = joinedAt ? new Date(joinedAt) : new Date();

    const memRes = await client.query(
      `INSERT INTO group_members (group_id, user_id, joined_at) 
       VALUES ($1, $2, $3) RETURNING *`,
      [groupId, resolvedUserId, joinTimestamp]
    );
    const membership = memRes.rows[0];

    // Fetch user details for client
    const userDetails = await client.query('SELECT id, name, email FROM users WHERE id = $1', [resolvedUserId]);

    await logAction({
      client,
      actionType: 'ADD_MEMBER',
      entityType: 'group_member',
      entityId: membership.id,
      performedBy: adminId,
      newValues: { ...membership, user: userDetails.rows[0] }
    });

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Member added successfully.',
      membership: {
        ...membership,
        user: userDetails.rows[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('addMember error:', err);
    return res.status(500).json({ error: 'Database error adding group member.' });
  } finally {
    client.release();
  }
};

// PUT /groups/:id/members/:memberId
// Update membership timeframe (joined_at, left_at)
const updateMember = async (req, res) => {
  const { joinedAt, leftAt } = req.body;
  const membershipId = req.params.memberId;
  const adminId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const oldRes = await client.query('SELECT * FROM group_members WHERE id = $1', [membershipId]);
    if (oldRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Membership record not found.' });
    }
    const oldMem = oldRes.rows[0];

    const newJoined = joinedAt ? new Date(joinedAt) : oldMem.joined_at;
    const newLeft = leftAt !== undefined ? (leftAt ? new Date(leftAt) : null) : oldMem.left_at;

    if (newLeft && newJoined > newLeft) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Joined date must be before or equal to left date.' });
    }

    const resMem = await client.query(
      `UPDATE group_members 
       SET joined_at = $1, left_at = $2 
       WHERE id = $3 RETURNING *`,
      [newJoined, newLeft, membershipId]
    );
    const updatedMem = resMem.rows[0];

    await logAction({
      client,
      actionType: 'UPDATE_MEMBER',
      entityType: 'group_member',
      entityId: membershipId,
      performedBy: adminId,
      oldValues: oldMem,
      newValues: updatedMem
    });

    await client.query('COMMIT');
    return res.json({
      message: 'Membership timeline updated.',
      membership: updatedMem
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateMember error:', err);
    return res.status(500).json({ error: 'Database error updating membership record.' });
  } finally {
    client.release();
  }
};

// DELETE /groups/:id/members/:memberId
// Soft delete: sets left_at = CURRENT_TIMESTAMP
const removeMember = async (req, res) => {
  const membershipId = req.params.memberId;
  const adminId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const checkRes = await client.query('SELECT * FROM group_members WHERE id = $1', [membershipId]);
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Membership record not found.' });
    }
    const oldMem = checkRes.rows[0];

    // Set left_at to current timestamp
    const resMem = await client.query(
      `UPDATE group_members 
       SET left_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [membershipId]
    );
    const updatedMem = resMem.rows[0];

    await logAction({
      client,
      actionType: 'REMOVE_MEMBER',
      entityType: 'group_member',
      entityId: membershipId,
      performedBy: adminId,
      oldValues: oldMem,
      newValues: updatedMem
    });

    await client.query('COMMIT');
    return res.json({
      message: 'Member removed from active list (membership record preserved).',
      membership: updatedMem
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('removeMember error:', err);
    return res.status(500).json({ error: 'Database error removing member.' });
  } finally {
    client.release();
  }
};

// GET /groups/:id/members
// Get all members (active and historical) of a group
const getGroupMembers = async (req, res) => {
  const groupId = req.params.id;
  try {
    const query = `
      SELECT gm.id as membership_id, gm.joined_at, gm.left_at, u.id, u.name, u.email
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY gm.joined_at ASC
    `;
    const result = await db.query(query, [groupId]);
    return res.json(result.rows);
  } catch (err) {
    console.error('getGroupMembers error:', err);
    return res.status(500).json({ error: 'Database error fetching group members.' });
  }
};

module.exports = {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addMember,
  updateMember,
  removeMember,
  getGroupMembers
};
