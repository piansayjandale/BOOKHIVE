import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/bookhive_2nd";
const client = new Client({ connectionString });

async function check() {
  try {
    await client.connect();
    const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'transactions'");
    console.log("COLUMNS:");
    console.log(res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}

check();
