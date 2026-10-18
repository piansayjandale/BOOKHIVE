const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const NEON_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_t9Mv6obzqwYI@ep-small-rice-b4t0hk6r-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function runMigration() {
  console.log("=== BookHive -> Neon PostgreSQL Database Migration ===");
  console.log("Connecting to Neon...");

  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  console.log("✓ Connected to Neon successfully.");

  // 1. Run schema.sql
  console.log("Reading schema.sql...");
  const schemaPath = path.resolve(__dirname, "../db/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  console.log("Executing schema DDL (creating tables, enums, triggers, indexes)...");
  await client.query(schemaSql);
  console.log("✓ Schema applied successfully.");

  // 2. Seed Users
  console.log("Seeding core system accounts...");
  const usersToSeed = [
    {
      name: "Super Administrator",
      email: "superadmin@stiwnu.edu.ph",
      role: "Super Admin",
      password: "BookHiveSuperAdmin!2026",
      idNumber: "SUP-2026-0001",
      department: "Executive System Governance",
      course: "Platform Infrastructure",
    },
    {
      name: "Library Administrator",
      email: "admin@stiwnu.edu.ph",
      role: "Admin",
      password: "BookHiveAdmin!2026",
      idNumber: "ADM-2026-0001",
      department: "Library Administration",
      course: "Library Administration",
    },
    {
      name: "Yana Brich R. Palmares",
      email: "librarian@stiwnu.edu.ph",
      role: "Librarian",
      password: "BookHiveLibrarian!2026",
      idNumber: "LIB-2026-0001",
      department: "Library Services",
      course: "Library Services",
    },
    {
      name: "Marc Lester Escosora",
      email: "lester.escosora@stiwnu.edu.ph",
      role: "Student",
      password: "BookHiveStudent!2026",
      idNumber: "2023-01042",
      department: "College of Information Technology",
      course: "BS Information Technology",
    },
  ];

  for (const user of usersToSeed) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(user.password, salt);

    // Insert into users table
    await client.query(
      `
      INSERT INTO users (
        name, id_number, email, password_hash, role, department, course, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
      ON CONFLICT (id_number) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        status = 'Active'
      `,
      [
        user.name,
        user.idNumber,
        user.email,
        passwordHash,
        user.role,
        user.department,
        user.course,
      ]
    );

    // Also insert into admin_account_users
    await client.query(
      `
      INSERT INTO admin_account_users (
        id, name, id_number, email, password_hash, role, department, course, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active')
      ON CONFLICT (id_number) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        status = 'Active'
      `,
      [
        `user-${user.idNumber.toLowerCase()}`,
        user.name,
        user.idNumber,
        user.email,
        passwordHash,
        user.role,
        user.department,
        user.course,
      ]
    );
  }
  console.log("✓ Core users seeded successfully.");

  // 3. Seed Books Catalog
  console.log("Loading books snapshot...");
  const catalogPaths = [
    path.resolve(__dirname, "../../Librarian Admin/Librarian and Admin/frontend/data/imports/books.catalog.json"),
    path.resolve(__dirname, "../data/imports/books.catalog.json"),
  ];

  let catalogFile = null;
  for (const p of catalogPaths) {
    if (fs.existsSync(p)) {
      catalogFile = p;
      break;
    }
  }

  if (!catalogFile) {
    console.error("Could not find books.catalog.json!");
    process.exit(1);
  }

  const rawData = fs.readFileSync(catalogFile, "utf8");
  const books = JSON.parse(rawData);
  console.log(`✓ Loaded ${books.length} books from disk.`);

  // Check how many books already exist
  const existingCountRes = await client.query("SELECT COUNT(*)::int as count FROM books");
  const existingCount = existingCountRes.rows[0].count;
  console.log(`Current books in Neon DB: ${existingCount}`);

  if (existingCount >= books.length - 100) {
    console.log("✓ Catalog is already populated!");
  } else {
    console.log(`Inserting books in batches of 500...`);
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < books.length; i += batchSize) {
      const chunk = books.slice(i, i + batchSize);
      const values = [];
      const placeholders = [];
      let paramIdx = 1;

      for (const b of chunk) {
        let pubDate = b.publicationDate || "2024-01-01";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(pubDate)) {
          pubDate = "2024-01-01";
        }

        const title = String(b.title || "Untitled").substring(0, 500);
        const author = String(b.author || "Unknown Author").substring(0, 300);
        const isbn = String(b.isbn || `BOOK-${i}-${paramIdx}`).substring(0, 100);
        const department = b.department || "Circulation";
        const category = String(b.category || b.department || "General").substring(0, 200);
        const shelfLocation = String(b.shelfLocation || "CIR-01A.1").substring(0, 100);
        const summary = String(b.summary || "").substring(0, 4000);
        const apaCitation = `${author}. (${pubDate.substring(0, 4)}). ${title}.`;
        const availability = b.availability || "Available";
        const borrowCount = Number(b.borrowCount || 0);
        const copies = Number(b.copies || 1);
        const genres = String(b.genres || category).substring(0, 300);
        const rating = Number(b.rating || 4.2);
        const aiScore = Number(b.aiScore || 75);

        placeholders.push(
          `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}::date, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10}, $${paramIdx + 11}, $${paramIdx + 12}, $${paramIdx + 13}, $${paramIdx + 14})`
        );

        values.push(
          title,
          author,
          isbn,
          department,
          category,
          shelfLocation,
          pubDate,
          summary,
          apaCitation,
          availability,
          borrowCount,
          copies,
          genres,
          rating,
          aiScore
        );

        paramIdx += 15;
      }

      const insertSql = `
        INSERT INTO books (
          title, author, isbn, department, category, shelf_location,
          published_date, summary, apa_citation, availability, borrow_count,
          copies, genres, rating, ai_score
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT (isbn) DO NOTHING
      `;

      await client.query(insertSql, values);
      inserted += chunk.length;
      if (inserted % 5000 === 0 || inserted === books.length) {
        console.log(`-> Inserted ${inserted} / ${books.length} books...`);
      }
    }
    console.log("✓ All catalog books successfully inserted!");
  }

  // 4. Verify Final Counts
  const finalBooks = await client.query("SELECT COUNT(*)::int as count FROM books");
  const finalUsers = await client.query("SELECT COUNT(*)::int as count FROM users");
  console.log("\n==========================================");
  console.log("🎉 NEON MIGRATION COMPLETE!");
  console.log(`Total Books in Neon: ${finalBooks.rows[0].count}`);
  console.log(`Total Users in Neon: ${finalUsers.rows[0].count}`);
  console.log("==========================================");

  await client.end();
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
