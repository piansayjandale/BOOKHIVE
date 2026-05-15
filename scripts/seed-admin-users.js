import pg from "pg";
import bcryptjs from "bcryptjs";

const { Pool } = pg;

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/bookhive",
  });

  try {
    console.log("🌱 Starting database seeding...");

    // Create admin_account_users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_account_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        id_number TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        course TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_account_profiles (
        user_id TEXT PRIMARY KEY REFERENCES admin_account_users(id) ON DELETE CASCADE,
        phone TEXT NOT NULL DEFAULT '',
        bio TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_auth_logs (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_admin_account_users_email
        ON admin_account_users(email);
      CREATE INDEX IF NOT EXISTS idx_admin_account_users_role
        ON admin_account_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_account_users_last_active
        ON admin_account_users(last_active DESC);
    `);

    console.log("✅ Tables created successfully");

    // Check if users already exist
    const existing = await pool.query(
      "SELECT COUNT(*) as count FROM admin_account_users"
    );

    if (parseInt(existing.rows[0].count, 10) > 0) {
      console.log("✅ Users already exist, skipping seed");
      return;
    }

    // Hash passwords
    const adminPasswordHash = await bcryptjs.hash("BookHiveAdmin!2026", 10);
    const librarianPasswordHash = await bcryptjs.hash("BookHiveLibrarian!2026", 10);

    // Insert admin user
    await pool.query(
      `
        INSERT INTO admin_account_users (
          id,
          name,
          id_number,
          email,
          password_hash,
          role,
          department,
          course,
          status,
          last_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
      [
        "user-001",
        "Yana Palmares",
        "USER-YANA-001",
        "yana.palmares@stiwnu.edu.ph",
        adminPasswordHash,
        "Admin",
        "Computer Science",
        "Library Administration",
        "Active",
      ]
    );

    // Insert admin profile
    await pool.query(
      `
        INSERT INTO admin_account_profiles (
          user_id,
          phone,
          bio
        ) VALUES ($1, $2, $3)
      `,
      [
        "user-001",
        "+63 917 555 0101",
        "Oversees the BookHive platform, policy configuration, and system-wide analytics.",
      ]
    );

    // Insert librarian user
    await pool.query(
      `
        INSERT INTO admin_account_users (
          id,
          name,
          id_number,
          email,
          password_hash,
          role,
          department,
          course,
          status,
          last_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
      [
        "user-002",
        "Joseph Tan",
        "USER-JOSEPH-001",
        "joseph.tan@stiwnu.edu.ph",
        librarianPasswordHash,
        "Librarian",
        "Business & Accountancy",
        "Library Services",
        "Active",
      ]
    );

    // Insert librarian profile
    await pool.query(
      `
        INSERT INTO admin_account_profiles (
          user_id,
          phone,
          bio
        ) VALUES ($1, $2, $3)
      `,
      [
        "user-002",
        "+63 917 555 0199",
        "Supports circulation, patron service, and day-to-day catalog operations.",
      ]
    );

    console.log("✅ Users seeded successfully!");
    console.log("");
    console.log("📝 Test Credentials:");
    console.log("");
    console.log("ADMIN:");
    console.log("  Email: yana.palmares@stiwnu.edu.ph");
    console.log("  Password: BookHiveAdmin!2026");
    console.log("");
    console.log("LIBRARIAN:");
    console.log("  Email: joseph.tan@stiwnu.edu.ph");
    console.log("  Password: BookHiveLibrarian!2026");
    console.log("");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
