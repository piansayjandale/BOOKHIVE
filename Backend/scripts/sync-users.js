import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function syncUsers() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd';
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL via DATABASE_URL");

    const libPass = await bcrypt.hash('BookHiveLibrarian!2026', 10);
    const adminPass = await bcrypt.hash('BookHiveAdmin!2026', 10);
    const superPass = await bcrypt.hash('BookHiveSuperAdmin!2026', 10);

    // Update Librarian
    const libCheck = await client.query("SELECT id FROM users WHERE email IN ('joseph.tan@stiwnu.edu.ph', 'librarian@stiwnu.edu.ph')");
    if (libCheck.rows.length > 0) {
      await client.query(`
        UPDATE users
        SET name = 'Yana Brich R. Palmares',
            email = 'librarian@stiwnu.edu.ph',
            id_number = 'LIB-2026-0001',
            password_hash = $1,
            role = 'Librarian',
            department = 'Circulation',
            course = 'Library Services',
            status = 'Active'
        WHERE id = $2
      `, [libPass, libCheck.rows[0].id]);
      console.log("✓ Librarian account synced to Yana Brich R. Palmares (librarian@stiwnu.edu.ph)");
    }

    // Update Admin
    const adminCheck = await client.query("SELECT id FROM users WHERE email IN ('yana.palmares@stiwnu.edu.ph', 'admin@stiwnu.edu.ph')");
    if (adminCheck.rows.length > 0) {
      await client.query(`
        UPDATE users
        SET name = 'Yana Palmares',
            email = 'admin@stiwnu.edu.ph',
            password_hash = $1,
            role = 'Admin'
        WHERE id = $2
      `, [adminPass, adminCheck.rows[0].id]);
      console.log("✓ Admin account synced to Yana Palmares (admin@stiwnu.edu.ph)");
    }

    // Update Super Admin
    await client.query(`
      UPDATE users
      SET password_hash = $1
      WHERE email = 'superadmin@stiwnu.edu.ph'
    `, [superPass]);
    console.log("✓ Super Admin password updated.");

    const res = await client.query("SELECT id, name, email, id_number, role, status FROM users");
    console.log("\nCurrent active users in database:");
    console.table(res.rows);
  } catch (err) {
    console.error("Sync error:", err);
  } finally {
    await client.end();
  }
}

syncUsers();
