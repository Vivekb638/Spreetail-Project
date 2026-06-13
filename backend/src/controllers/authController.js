const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Helper to generate access and refresh tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // 1 hour access token
  );
  
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // 7 days refresh token
  );

  return { accessToken, refreshToken };
};

// POST /auth/register
const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    // Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save user
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    return res.status(201).json({
      message: 'Registration successful.',
      user,
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Database error occurred during registration.' });
  }
};

// POST /auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Check if user exists
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    return res.json({
      message: 'Login successful.',
      user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at },
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Database error occurred during login.' });
  }
};

// POST /auth/logout
const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    // Revoke refresh token
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Database error occurred during logout.' });
  }
};

// POST /auth/refresh
const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  try {
    // Check if token exists and is valid
    const tokenResult = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const storedToken = tokenResult.rows[0];

    // Decode token to verify integrity
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (decoded.id !== storedToken.user_id) {
      return res.status(401).json({ error: 'Token user mismatch.' });
    }

    // Retrieve user details
    const userResult = await db.query('SELECT id, name, email, created_at FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User no longer exists.' });
    }

    const user = userResult.rows[0];
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Rotate refresh token: delete old, insert new
    await db.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, expiresAt]
    );

    return res.json({
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(401).json({ error: 'Invalid refresh token signature or expired.' });
  }
};

// PUT /auth/profile
const updateProfile = async (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Name is required.' });
  }

  try {
    const result = await db.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, created_at',
      [name.trim(), userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      message: 'Profile updated successfully.',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ error: 'Database error updating profile.' });
  }
};

module.exports = {
  register,
  login,
  logout,
  refresh,
  updateProfile
};

