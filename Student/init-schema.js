import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

async function initDb() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/bookhive'
  });

  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(process.cwd(), 'backend', 'db', 'schema.sql'), 'utf-8');
    await client.query(sql);
    console.log('Schema initialized successfully');
  } catch (err) {
    console.error('Error initializing schema:', err);
  } finally {
    await client.end();
  }
}

initDb();
