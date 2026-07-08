import pg from "pg";
const { Client } = pg;

const connectionString = "postgresql://postgres:postgres@localhost:5432/bookhive";
const client = new Client({ connectionString });

async function test() {
  try {
    await client.connect();
    const res = await client.query("SELECT id, name, email, role, id_number, avatar FROM users");
    console.log("USERS:");
    console.log(res.rows);
  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
  }
}

test();
