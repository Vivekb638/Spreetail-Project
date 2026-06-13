const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const setup = async () => {
  console.log('Starting database setup...');
  
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL not set in environment variables.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    // 1. Run Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Executing schema.sql...');
    await client.query(schemaSql);
    console.log('Schema executed successfully.');

    // 2. Hash Default Password
    const defaultPassword = 'password123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 3. Seed Users
    const seededUsers = [
      { name: 'Aisha', email: 'aisha@example.com' },
      { name: 'Rohan', email: 'rohan@example.com' },
      { name: 'Priya', email: 'priya@example.com' },
      { name: 'Meera', email: 'meera@example.com' },
      { name: 'Dev', email: 'dev@example.com' },
      { name: 'Sam', email: 'sam@example.com' }
    ];

    console.log('Seeding users...');
    const userMap = {}; // name -> id

    for (const u of seededUsers) {
      const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (checkRes.rows.length === 0) {
        const insertRes = await client.query(
          'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
          [u.name, u.email, passwordHash]
        );
        userMap[u.name] = insertRes.rows[0].id;
        console.log(`Created user: ${u.name} (${u.email})`);
      } else {
        userMap[u.name] = checkRes.rows[0].id;
        console.log(`User already exists: ${u.name}`);
      }
    }

    // 4. Seed Default Group
    console.log('Seeding default group...');
    let groupId;
    const groupName = 'Flatmates & Trips Group';
    const checkGroup = await client.query('SELECT id FROM groups WHERE name = $1', [groupName]);
    
    if (checkGroup.rows.length === 0) {
      const insertGroup = await client.query(
        'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING id',
        [groupName, 'Shared flat expenses and holiday trip splits.']
      );
      groupId = insertGroup.rows[0].id;
      console.log(`Created group: ${groupName}`);
    } else {
      groupId = checkGroup.rows[0].id;
      console.log(`Group already exists: ${groupName}`);
    }

    // 5. Seed Historical Memberships
    // - Aisha: joined 2026-01-01, active
    // - Rohan: joined 2026-01-01, active
    // - Priya: joined 2026-01-01, active
    // - Meera: joined 2026-01-01, left 2026-03-31
    // - Dev: joined 2026-03-08, left 2026-03-12 (Goa trip)
    // - Sam: joined 2026-04-15, active
    console.log('Seeding historical group memberships...');
    const memberships = [
      { name: 'Aisha', joinedAt: '2026-01-01T00:00:00Z', leftAt: null },
      { name: 'Rohan', joinedAt: '2026-01-01T00:00:00Z', leftAt: null },
      { name: 'Priya', joinedAt: '2026-01-01T00:00:00Z', leftAt: null },
      { name: 'Meera', joinedAt: '2026-01-01T00:00:00Z', leftAt: '2026-03-31T23:59:59Z' },
      { name: 'Dev', joinedAt: '2026-03-08T00:00:00Z', leftAt: '2026-03-12T23:59:59Z' },
      { name: 'Sam', joinedAt: '2026-04-15T00:00:00Z', leftAt: null }
    ];

    for (const m of memberships) {
      const userId = userMap[m.name];
      // Check if membership already exists
      const checkMem = await client.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );

      if (checkMem.rows.length === 0) {
        await client.query(
          'INSERT INTO group_members (group_id, user_id, joined_at, left_at) VALUES ($1, $2, $3, $4)',
          [groupId, userId, m.joinedAt, m.leftAt]
        );
        console.log(`Added membership: ${m.name} (Joined: ${m.joinedAt.split('T')[0]}, Left: ${m.leftAt ? m.leftAt.split('T')[0] : 'Active'})`);
      } else {
        // Update it to match historical seed just in case
        await client.query(
          'UPDATE group_members SET joined_at = $3, left_at = $4 WHERE group_id = $1 AND user_id = $2',
          [groupId, userId, m.joinedAt, m.leftAt]
        );
        console.log(`Updated membership: ${m.name}`);
      }
    }

    // 6. Seed default exchange rate for USD-INR (since the Goa expenses use USD)
    console.log('Seeding exchange rates...');
    const rate = 83.50; // default rate
    const dates = [
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12'
    ];
    for (const d of dates) {
      await client.query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, effective_date) 
         VALUES ('USD', 'INR', $1, $2)
         ON CONFLICT (from_currency, to_currency, effective_date) DO UPDATE SET rate = $1`,
        [rate, d]
      );
    }
    console.log('Exchange rates seeded successfully.');

    console.log('Database setup completed successfully.');
  } catch (err) {
    console.error('Database setup error:', err);
  } finally {
    await client.end();
  }
};

setup();
