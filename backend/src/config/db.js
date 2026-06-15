const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const isSupabase = connectionString && connectionString.includes('supabase');

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' || isSupabase
    ? { rejectUnauthorized: false }
    : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
