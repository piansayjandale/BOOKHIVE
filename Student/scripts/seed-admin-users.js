import pg from "pg";
import bcryptjs from "bcryptjs";

const { Pool } = pg;

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/bookhive",
  });

  try {
    console.log("🌱 Starting database seeding...");

    // No need to create tables here, they are handled by schema.sql
    console.log("✅ Using existing tables from schema.sql");

    // Check if users already exist
    const existing = await pool.query(
      "SELECT COUNT(*) as count FROM users"
    );

    if (parseInt(existing.rows[0].count, 10) > 0) {
      console.log("✅ Users already exist, skipping seed");
      return;
    }

    // Hash passwords
    const adminPasswordHash = await bcryptjs.hash("BookHiveAdmin!2026", 10);
    const librarianPasswordHash = await bcryptjs.hash("BookHiveLibrarian!2026", 10);

    // Insert admin user
    const adminRes = await pool.query(
      `
        INSERT INTO users (
          name,
          id_number,
          email,
          password_hash,
          role,
          department,
          course,
          status,
          last_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `,
      [
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
    const adminId = adminRes.rows[0].id;

    // Insert admin profile
    await pool.query(
      `
        INSERT INTO admin_profiles (
          user_id,
          phone,
          bio
        ) VALUES ($1, $2, $3)
      `,
      [
        adminId,
        "+63 917 555 0101",
        "Oversees the BookHive platform, policy configuration, and system-wide analytics.",
      ]
    );

    // Insert librarian user
    const librarianRes = await pool.query(
      `
        INSERT INTO users (
          name,
          id_number,
          email,
          password_hash,
          role,
          department,
          course,
          status,
          last_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id
      `,
      [
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
    const librarianId = librarianRes.rows[0].id;

    // Insert librarian profile
    await pool.query(
      `
        INSERT INTO admin_profiles (
          user_id,
          phone,
          bio
        ) VALUES ($1, $2, $3)
      `,
      [
        librarianId,
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
