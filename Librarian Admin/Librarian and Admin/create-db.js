import pg from 'pg';

const { Client } = pg;

async function createDb() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres'
  });

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
