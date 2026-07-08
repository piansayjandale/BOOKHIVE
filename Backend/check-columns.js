import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: "postgresql://postgres:postgres@localhost:5432/bookhive" });

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
