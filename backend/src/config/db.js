const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If we are connecting to Supabase or AWS RDS, they usually require SSL.
  // In development, we can make it optional based on URL or environment.
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('supabase')
    ? { rejectUnauthorized: false }
    : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
