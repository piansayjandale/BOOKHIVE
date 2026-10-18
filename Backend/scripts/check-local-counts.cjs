const { Client } = require("pg");

async function check() {
  const client = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd",
  });
  await client.connect();
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
  );
  console.log("=== Tables and Counts in local bookhive_2nd ===");
  for (const r of tables.rows) {
    try {
      const c = await client.query(`SELECT COUNT(*)::int as count FROM "${r.table_name}";`);
      console.log(`${r.table_name}: ${c.rows[0].count}`);
    } catch (e) {
      console.log(`${r.table_name}: error (${e.message})`);
    }
  }
  await client.end();
}

check().catch(console.error);
