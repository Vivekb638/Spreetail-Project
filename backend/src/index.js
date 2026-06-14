const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const settlementRoutes = require('./routes/settlementRoutes');
const importRoutes = require('./routes/importRoutes');
const balanceRoutes = require('./routes/balanceRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5000;


// 1. Security Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Body parser with 10mb limit for large CSV strings
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 login/register attempts per window
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);

// 3. Health Check
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await db.query('SELECT NOW()');
    return res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: dbCheck.rows[0].now
    });
  } catch (err) {
    return res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message
    });
  }
});

// 4. Mount Routes
// Faithful matching of exact paths specified in instructions
app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);
app.use('/expenses', expenseRoutes);
app.use('/settlements', settlementRoutes);
app.use('/imports', importRoutes);
app.use('/admin', adminRoutes);
app.use('/', balanceRoutes); // exposes /groups/:id/balance and /users/:id/balance directly on /


// 5. Global 404 Route
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// 6. Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: 'Internal server error occurred.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server (Avoid starting if we are executing tests via supertest or running on Vercel)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Shared Expenses Backend Server running on port ${PORT}`);
  });
}

module.exports = app; // export for supertest integration testing
