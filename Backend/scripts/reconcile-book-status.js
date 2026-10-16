import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd",
});

async function run() {
  try {
    console.log("=== Reconciling books.availability across database ===");
    const query = `
      SELECT
        b.id,
        b.title,
        b.isbn,
        b.copies,
        b.availability AS "currentAvailability",
        COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending') THEN 1 END), 0)::int AS "borrowedCount",
        COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "reservedCount"
      FROM books b
      LEFT JOIN transactions t ON (
        (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
        OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
      )
      WHERE b.archived_at IS NULL
      GROUP BY b.id
    `;
    const { rows } = await pool.query(query);
    let updatedCount = 0;

    for (const r of rows) {
      const totalCopies = Math.max(1, Number(r.copies || 1));
      const unavailableCopies = Math.min(totalCopies, r.borrowedCount);
      const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), r.reservedCount);
      const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
      const correctStatus = availableCopies > 0 ? "Available" : (r.reservedCount > 0 ? "Reserved" : "Unavailable");

      if (r.currentAvailability !== correctStatus) {
        await pool.query("UPDATE books SET availability = $1, updated_at = NOW() WHERE id = $2", [correctStatus, r.id]);
        console.log(`[UPDATED] "${r.title}" (ID: ${r.id}, ISBN: ${r.isbn}): '${r.currentAvailability}' -> '${correctStatus}' (Total: ${totalCopies}, Loans: ${r.borrowedCount}, Res: ${r.reservedCount})`);
        updatedCount++;
      }
    }

    console.log(`Reconciliation complete. Updated ${updatedCount} books.`);
  } catch (err) {
    console.error("Reconciliation error:", err);
  } finally {
    await pool.end();
  }
}

run();
