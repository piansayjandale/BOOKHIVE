import pg from "pg";
const { Client } = pg;

const connectionString = "postgresql://postgres:postgres@localhost:5432/bookhive";
const client = new Client({ connectionString });

async function test() {
  try {
    await client.connect();
    console.log("Connected to DB.");

    console.log("\n1. Testing getDashboardSummary...");
    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS "totalUsers",
        (SELECT COUNT(*) FROM books WHERE archived_at IS NULL) AS "totalBooks",
        (SELECT COUNT(*) FROM transactions WHERE type = 'Borrow' AND status = 'Approved') AS "activeBorrowedBooks",
        (SELECT COUNT(*) FROM transactions WHERE status = 'Pending') AS "pendingRequests"
    `);
    console.log("Summary:", summary.rows[0]);

    console.log("\n2. Testing getMonthlyBorrowTrends...");
    const trends = await client.query(`
      SELECT
        to_char(date_trunc('month', requested_at), 'Mon') AS month,
        COUNT(*) FILTER (WHERE type = 'Borrow')::int AS borrows,
        COUNT(*) FILTER (WHERE type = 'Return')::int AS returns,
        COUNT(*) FILTER (WHERE type = 'Reservation')::int AS reservations
      FROM transactions
      GROUP BY date_trunc('month', requested_at)
      ORDER BY date_trunc('month', requested_at)
    `);
    console.log("Trends:", trends.rows.length, "rows");

    console.log("\n3. Testing getDepartmentUsage...");
    const deptUsage = await client.query(`
      SELECT department, COUNT(*)::int AS usage
      FROM transactions
      GROUP BY department
      ORDER BY usage DESC, department ASC
    `);
    console.log("Department Usage:", deptUsage.rows.length, "rows");

    console.log("\n4. Testing getRecentActivities...");
    const activities = await client.query(`
      SELECT id, actor, message, category, severity, created_at AS timestamp
      FROM activity_logs
      ORDER BY created_at DESC
      LIMIT 8
    `);
    console.log("Activities:", activities.rows.length, "rows");

    console.log("\n5. Testing getRecentUsers...");
    const recentUsers = await client.query(`
      SELECT
        id,
        name,
        id_number AS "idNumber",
        email,
        role,
        department,
        course,
        status,
        last_active AS "lastActive"
      FROM users
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log("Recent Users:", recentUsers.rows.length, "rows");

    console.log("\n6. Testing getLatestTransactions...");
    const latestTx = await client.query(`
      SELECT
        id,
        student_name AS "studentName",
        student_id AS "studentId",
        resource_title AS "resourceTitle",
        isbn,
        type,
        status,
        requested_at AS "requestedAt",
        due_date AS "dueDate",
        department,
        duration_days AS "durationDays"
      FROM transactions
      ORDER BY requested_at DESC
      LIMIT 8
    `);
    console.log("Latest Transactions:", latestTx.rows.length, "rows");

    console.log("\n7. Testing listBooks...");
    const books = await client.query(`
      SELECT *
      FROM books
      WHERE archived_at IS NULL
      ORDER BY borrow_count DESC, title ASC
      LIMIT 5 OFFSET 0
    `);
    console.log("Books:", books.rows.length, "rows");

    console.log("\nALL QUERIES PASSED!");
  } catch (error) {
    console.error("QUERY FAILED:", error);
  } finally {
    await client.end();
  }
}

test();
