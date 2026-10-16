import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd",
});

async function main() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL successfully.");

    // Check triggers on transactions
    const triggers = await client.query(`
      SELECT trigger_name, action_statement, event_manipulation 
      FROM information_schema.triggers 
      WHERE event_object_table = 'transactions'
    `);
    console.log("\n=== TRIGGERS ON transactions ===");
    console.log(triggers.rows);

    // Check table columns on transactions
    const txCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
    `);
    console.log("\n=== TRANSACTIONS COLUMNS ===");
    console.log(txCols.rows.map(r => r.column_name));

    // Check books availability values
    const booksAvail = await client.query(`
      SELECT availability, COUNT(*) 
      FROM books 
      GROUP BY availability
    `);
    console.log("\n=== BOOKS AVAILABILITY STATS ===");
    console.log(booksAvail.rows);

    // Check transactions status and type
    const txStats = await client.query(`
      SELECT type, status, COUNT(*) 
      FROM transactions 
      GROUP BY type, status
    `);
    console.log("\n=== TRANSACTIONS TYPE & STATUS ===");
    console.log(txStats.rows);

    // Check for any transactions with null or invalid columns
    const brokenTxs = await client.query(`
      SELECT COUNT(*) FROM transactions WHERE user_id IS NULL AND student_id IS NULL
    `);
    console.log("\n=== BROKEN TRANSACTIONS ===", brokenTxs.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
