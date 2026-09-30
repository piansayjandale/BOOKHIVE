import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function createDb() {
  const connectionString =
    process.env.PG_SYSTEM_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/postgres';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query('CREATE DATABASE bookhive');
    console.log('Database bookhive created successfully');
  } catch (err) {
    console.error('Error creating database:', err);
  } finally {
    await client.end();
  }
}

createDb();
