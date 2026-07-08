import pg from "pg";
const { Client } = pg;

const connectionString = "postgresql://postgres:postgres@localhost:5432/bookhive";
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  const query = "Find me a book that is about mathematics";
  
  const keywords = query.trim().split(/\s+/).filter(k => k.length > 1);
  console.log("Keywords:", keywords);
  
  const wordConditions = [];
  const params = [];
  params.push(`%${query}%`);
  
  keywords.forEach((word) => {
    params.push(`%${word}%`);
    const pIndex = `$${params.length}`;
    wordConditions.push(`(
      LOWER(b.title) LIKE LOWER(${pIndex})
      OR LOWER(b.author) LIKE LOWER(${pIndex})
      OR LOWER(b.isbn) LIKE LOWER(${pIndex})
      OR LOWER(b.department) LIKE LOWER(${pIndex})
      OR LOWER(b.category) LIKE LOWER(${pIndex})
      OR LOWER(b.summary) LIKE LOWER(${pIndex})
    )`);
  });

  const sql = `
    SELECT
      b.id,
      b.title,
      b.author,
      b.isbn,
      b.summary,
      b.category
    FROM books b
    WHERE b.archived_at IS NULL 
      AND (
        LOWER(b.title) LIKE LOWER($1)
        OR LOWER(b.author) LIKE LOWER($1)
        OR LOWER(b.isbn) LIKE LOWER($1)
        OR LOWER(b.department) LIKE LOWER($1)
        OR LOWER(b.category) LIKE LOWER($1)
        OR LOWER(b.summary) LIKE LOWER($1)
        OR (${wordConditions.join(" AND ")})
      )
    LIMIT 10
  `;

  try {
    const res = await client.query(sql, params);
    console.log("Results count:", res.rows.length);
    console.log("Results:", res.rows);
  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    await client.end();
  }
}

run();
