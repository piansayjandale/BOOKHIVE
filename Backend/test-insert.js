import pg from "pg";
const { Client } = pg;

const connectionString = "postgresql://postgres:postgres@localhost:5432/bookhive";
const client = new Client({ connectionString });

async function test() {
  try {
    await client.connect();
    console.log("Connected. Testing insert...");

    // Try standard insertion
    const query = `
      INSERT INTO users (name, id_number, email, password_hash, role, department, course, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
      RETURNING id
    `;
    const res = await client.query(query, [
      "Test User",
      "TEST-ID-999",
      "test.user@sti.edu.ph",
      "dummy_hash",
      "Student",
      "WNU STI",
      "General Program"
    ]);
    console.log("Success! Inserted user ID:", res.rows[0].id);

    // Now clean it up
    await client.query("DELETE FROM users WHERE id = $1", [res.rows[0].id]);
    console.log("Test user cleaned up successfully!");
  } catch (error) {
    console.error("Test failed!");
    console.error("Error Name:", error.name);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.error("Error Detail:", error.detail);
    console.error("Error Stack:", error.stack);
  } finally {
    await client.end();
  }
}

test();
