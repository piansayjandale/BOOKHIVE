import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function initDb() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/bookhive_2nd';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(process.cwd(), '../../Backend/db/schema.sql'), 'utf-8');
    await client.query(sql);
    console.log('Schema initialized successfully');
  } catch (err) {
    console.error('Error initializing schema:', err);
  } finally {
    await client.end();
  }
}

initDb();
