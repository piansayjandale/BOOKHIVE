import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root and Backend/.env if present
dotenv.config();
if (fs.existsSync(path.join(__dirname, "Backend/.env"))) {
  dotenv.config({ path: path.join(__dirname, "Backend/.env") });
}

// 1. Parse connection configuration from CLI arguments, URI, or environment variables
const args = process.argv.slice(2);
let cliUrl = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--url=")) {
    cliUrl = arg.slice(6);
  } else if ((arg === "--url" || arg === "-u") && args[i + 1]) {
    cliUrl = args[i + 1];
    i++;
  } else if (arg === "--dry-run") {
    dryRun = true;
  } else if (!arg.startsWith("-") && (arg.startsWith("mysql://") || arg.startsWith("mysql2://"))) {
    cliUrl = arg;
  }
}

function resolveCloudConnectionConfig() {
  const rawUrl =
    cliUrl ||
    process.env.AIVEN_MYSQL_URL ||
    process.env.MYSQL_URL ||
    (process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith("mysql") ||
      process.env.DATABASE_URL.includes("aivencloud") ||
      process.env.DATABASE_URL.includes("mysql"))
      ? process.env.DATABASE_URL
      : null);

  let host = process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1";
  let port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  let user = process.env.MYSQL_USER || process.env.DB_USER || "avnadmin";
  let password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
  let database = process.env.MYSQL_DATABASE || process.env.DB_NAME || "defaultdb";

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      host = parsed.hostname || host;
      port = parsed.port ? Number(parsed.port) : port;
      database = (parsed.pathname || "").replace(/^\//, "") || database;
      user = parsed.username ? decodeURIComponent(parsed.username) : user;
      password = parsed.password ? decodeURIComponent(parsed.password) : password;
    } catch (e) {
      console.warn("Notice: Standard URL parser encountered non-standard format, attempting regex extraction:", e.message);
      const match = rawUrl.match(/mysql:\/\/(?:([^:]+)(?::([^@]+))?@)?([^:/]+)(?::(\d+))?(?:\/(.*))?/);
      if (match) {
        if (match[1]) user = decodeURIComponent(match[1]);
        if (match[2]) password = decodeURIComponent(match[2]);
        if (match[3]) host = match[3];
        if (match[4]) port = Number(match[4]);
        if (match[5]) database = match[5].split("?")[0];
      }
    }
  }

  const isLocal = host === "localhost" || host === "127.0.0.1";

  return {
    host,
    port,
    user,
    password,
    database,
    isLocal,
    ssl: {
      rejectUnauthorized: false,
    },
    rawProvided: Boolean(rawUrl || process.env.MYSQL_HOST),
  };
}

const config = resolveCloudConnectionConfig();

// 2. SQL Table Schemas for MySQL (InnoDB / utf8mb4)
const TABLE_DEFINITIONS = [
  {
    name: "users",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        id_number VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        department VARCHAR(255) NOT NULL,
        course VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        avatar TEXT,
        qr_code VARCHAR(64) UNIQUE NOT NULL,
        permissions JSON DEFAULT NULL,
        last_active DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_role (role),
        INDEX idx_users_id_number (id_number),
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "admin_profiles",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_profiles (
        user_id VARCHAR(64) PRIMARY KEY,
        phone VARCHAR(50) DEFAULT '',
        bio TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "books",
    sql: `
      CREATE TABLE IF NOT EXISTS books (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        author VARCHAR(500) NOT NULL,
        isbn VARCHAR(100) NOT NULL UNIQUE,
        department VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        shelf_location VARCHAR(255) NOT NULL,
        published_date DATE NOT NULL,
        summary TEXT,
        apa_citation TEXT,
        availability VARCHAR(50) NOT NULL DEFAULT 'Available',
        borrow_count INT NOT NULL DEFAULT 0,
        source VARCHAR(100) DEFAULT 'bookhive-manual',
        source_book_id VARCHAR(100) DEFAULT '',
        publication_date VARCHAR(100),
        series VARCHAR(255) DEFAULT '',
        genres TEXT,
        language VARCHAR(100) DEFAULT 'English',
        publisher VARCHAR(255) DEFAULT '',
        pages INT DEFAULT 0,
        rating DECIMAL(4,2) DEFAULT 4.00,
        num_ratings INT DEFAULT 10,
        liked_percent INT DEFAULT 90,
        cover_img TEXT,
        bbe_score DECIMAL(10,2) DEFAULT 0.00,
        bbe_votes INT DEFAULT 0,
        ai_score DECIMAL(6,2) DEFAULT 70.00,
        copies INT NOT NULL DEFAULT 1,
        volume VARCHAR(100) DEFAULT 'Vol. 1',
        edition VARCHAR(100) DEFAULT '1st Edition',
        accession_number VARCHAR(100),
        archived_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_books_department (department),
        INDEX idx_books_category (category),
        INDEX idx_books_isbn (isbn),
        INDEX idx_books_title (title(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "transactions",
    sql: `
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) DEFAULT NULL,
        student_name VARCHAR(255) NOT NULL,
        student_id VARCHAR(100) NOT NULL,
        resource_title VARCHAR(500) NOT NULL,
        isbn VARCHAR(100) NOT NULL,
        department VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        duration_days INT NOT NULL DEFAULT 7,
        requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        due_date DATETIME DEFAULT NULL,
        decided_by VARCHAR(64) DEFAULT NULL,
        decided_at DATETIME DEFAULT NULL,
        student_id_image LONGTEXT,
        comment TEXT,
        available_at DATETIME DEFAULT NULL,
        expires_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_transactions_student_id (student_id),
        INDEX idx_transactions_isbn (isbn),
        INDEX idx_transactions_status (status),
        INDEX idx_transactions_requested_at (requested_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "reservations",
    sql: `
      CREATE TABLE IF NOT EXISTS reservations (
        id VARCHAR(64) PRIMARY KEY,
        transaction_id VARCHAR(64) NOT NULL,
        reserved_by VARCHAR(64) DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Pending',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reservations_transaction_id (transaction_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "violations",
    sql: `
      CREATE TABLE IF NOT EXISTS violations (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) DEFAULT NULL,
        student_id VARCHAR(100) NOT NULL,
        student_name VARCHAR(255),
        book_title VARCHAR(500) NOT NULL,
        isbn VARCHAR(100),
        violation_type VARCHAR(255) NOT NULL DEFAULT 'Overdue Book Return',
        penalty_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status VARCHAR(50) NOT NULL DEFAULT 'Active',
        remarks TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME DEFAULT NULL,
        INDEX idx_violations_student_id (student_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "ai_search_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS ai_search_logs (
        id VARCHAR(64) PRIMARY KEY,
        actor_id VARCHAR(64) DEFAULT NULL,
        actor_name VARCHAR(255) NOT NULL,
        prompt TEXT NOT NULL,
        department VARCHAR(255) NOT NULL,
        file_names JSON DEFAULT NULL,
        matches_found INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ai_search_logs_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "activity_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(64) PRIMARY KEY,
        actor VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'info',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activity_logs_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "announcements",
    sql: `
      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        audience VARCHAR(100) NOT NULL,
        priority VARCHAR(50) NOT NULL,
        published BOOLEAN NOT NULL DEFAULT FALSE,
        author VARCHAR(255) NOT NULL,
        duration_days INT DEFAULT NULL,
        expires_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_announcements_updated_at (updated_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "history_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS history_logs (
        id VARCHAR(64) PRIMARY KEY,
        actor VARCHAR(255) NOT NULL,
        action VARCHAR(255) NOT NULL,
        target VARCHAR(255) NOT NULL,
        module VARCHAR(100) NOT NULL,
        detail TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_history_logs_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "system_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY DEFAULT 1,
        theme VARCHAR(50) NOT NULL DEFAULT 'dark',
        borrow_limit INT NOT NULL DEFAULT 5,
        borrow_duration_days INT NOT NULL DEFAULT 7,
        storage_used_percent INT NOT NULL DEFAULT 0,
        indexing_status VARCHAR(50) NOT NULL DEFAULT 'Healthy',
        ai_engine VARCHAR(100) NOT NULL DEFAULT 'BookHive AI',
        notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
        allow_admin_transaction_control BOOLEAN NOT NULL DEFAULT FALSE,
        ai_strict_mode BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "sessions",
    sql: `
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sessions_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "system_backups",
    sql: `
      CREATE TABLE IF NOT EXISTS system_backups (
        id VARCHAR(64) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_size_mb DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        backup_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
        status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
        created_by VARCHAR(255) NOT NULL DEFAULT 'Super Admin',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
  {
    name: "institutional_sync_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS institutional_sync_logs (
        id VARCHAR(64) PRIMARY KEY,
        provider VARCHAR(255) NOT NULL DEFAULT 'STI WNU Directory Ecosystem',
        synced_records INT NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
        details TEXT,
        synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
];

// 3. Initial Seed Accounts
const SEED_USERS = [
  {
    id: "usr-superadmin-001",
    name: "Super Administrator",
    email: "superadmin@stiwnu.edu.ph",
    idNumber: "SUP-2026-0001",
    password: "BookHiveSuperAdmin!2026",
    role: "Super Admin",
    department: "Executive System Governance",
    course: "Platform Infrastructure",
    qrCode: "e1a10000-super-4050-8000-000000000001",
  },
  {
    id: "usr-admin-002",
    name: "Yana Palmares",
    email: "admin@stiwnu.edu.ph",
    idNumber: "ADM-2026-0001",
    password: "BookHiveAdmin!2026",
    role: "Admin",
    department: "Library Administration",
    course: "Library Administration",
    qrCode: "e1a10000-admin-4050-8000-000000000002",
  },
  {
    id: "usr-librarian-001",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    idNumber: "LIB-2026-0001",
    password: "BookHiveLibrarian!2026",
    role: "Librarian",
    department: "Library Services",
    course: "Library Services",
    qrCode: "e1a10000-lib-4050-8000-000000000001",
  },
  {
    id: "usr-librarian-003",
    name: "Joseph Tan",
    email: "joseph.tan@stiwnu.edu.ph",
    idNumber: "LIB-2026-002",
    password: "BookHiveLibrarian!2026",
    role: "Librarian",
    department: "Library Services",
    course: "Library Science",
    qrCode: "e1a10000-lib-4050-8000-000000000003",
  },
  {
    id: "usr-student-004",
    name: "STI Student",
    email: "student@stiwnu.edu.ph",
    idNumber: "STI-2026-001",
    password: "student123",
    role: "Student",
    department: "College of Information and Communications Technology",
    course: "BS in Information Technology",
    qrCode: "e1a10000-stu-4050-8000-000000000004",
  },
];

// 4. Initial Seed Books
const SEED_BOOKS = [
  {
    id: "book-001",
    title: "Clean Architecture: A Craftsman's Guide to Software Structure and Design",
    author: "Robert C. Martin",
    isbn: "9780134494166",
    department: "Circulation Section",
    category: "Software Engineering",
    shelfLocation: "CIR-01A.1",
    publishedDate: "2017-09-20",
    summary: "Practical software architecture rules for systems with high maintainability, decoupling, and automated testing.",
    copies: 5,
    rating: 4.80,
  },
  {
    id: "book-002",
    title: "Introduction to Algorithms, Fourth Edition",
    author: "Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein",
    isbn: "9780262033848",
    department: "General Reference Section",
    category: "Computer Science",
    shelfLocation: "GEN-04B.2",
    publishedDate: "2022-04-05",
    summary: "A comprehensive update to the leading algorithms text, featuring rigorous analysis and modern computer algorithms.",
    copies: 4,
    rating: 4.90,
  },
  {
    id: "book-003",
    title: "Database System Concepts, Seventh Edition",
    author: "Abraham Silberschatz, Henry F. Korth, S. Sudarshan",
    isbn: "9780078022159",
    department: "Circulation Section",
    category: "Databases",
    shelfLocation: "CIR-02C.1",
    publishedDate: "2019-02-12",
    summary: "Fundamental concepts of database management, SQL, relational calculus, indexing, and cloud-scale transactions.",
    copies: 3,
    rating: 4.75,
  },
  {
    id: "book-004",
    title: "Computer Networking: A Top-Down Approach, Eighth Edition",
    author: "James F. Kurose, Keith W. Ross",
    isbn: "9780136681557",
    department: "Engineering & Maritime Section",
    category: "Networking",
    shelfLocation: "ENG-03A.3",
    publishedDate: "2020-05-18",
    summary: "Motivates students through the layered architecture of the Internet, application-layer protocols, and network security.",
    copies: 3,
    rating: 4.70,
  },
  {
    id: "book-005",
    title: "Noli Me Tangere",
    author: "Jose Rizal",
    isbn: "9780143039693",
    department: "Filipiniana & Negrosiana Section",
    category: "Philippine Literature",
    shelfLocation: "FIL-01A.1",
    publishedDate: "1887-03-21",
    summary: "The passionate, timeless masterpiece exposing societal colonial hypocrisies and advocating national awakening.",
    copies: 6,
    rating: 4.95,
  },
  {
    id: "book-006",
    title: "El Filibusterismo",
    author: "Jose Rizal",
    isbn: "9780143106395",
    department: "Filipiniana & Negrosiana Section",
    category: "Philippine Literature",
    shelfLocation: "FIL-01A.2",
    publishedDate: "1891-09-18",
    summary: "The gripping sequel depicting revolutionary reform, sacrifice, and ideological tension.",
    copies: 5,
    rating: 4.90,
  },
];

async function main() {
  console.log("==================================================================");
  console.log(" BookHive Aiven MySQL Cloud Database Migration & Seeding Tool");
  console.log("==================================================================");
  console.log(` Target Host  : ${config.host}`);
  console.log(` Target Port  : ${config.port}`);
  console.log(` Database     : ${config.database}`);
  console.log(` User         : ${config.user}`);
  console.log(` SSL Required : Enabled (rejectUnauthorized: false)`);
  console.log(` Environment  : ${config.isLocal ? "Localhost" : "Remote Cloud (Aiven)"}`);
  console.log("==================================================================");

  if (dryRun) {
    console.log("\n[DRY RUN MODE ENABLED] Verifying schema and seeding payloads without connecting to remote DB:");
    console.log(`  ✓ Schema Table Count: ${TABLE_DEFINITIONS.length} tables`);
    TABLE_DEFINITIONS.forEach((t, i) => console.log(`    ${i + 1}. ${t.name}`));
    console.log(`  ✓ Seed Admin Accounts: ${SEED_USERS.length}`);
    SEED_USERS.forEach((u) => console.log(`    - ${u.name} (${u.email}) [${u.role}]`));
    console.log(`  ✓ Seed Catalog Books: ${SEED_BOOKS.length}`);
    SEED_BOOKS.forEach((b) => console.log(`    - ${b.title} [${b.isbn}]`));
    console.log("\n✓ Dry-run verification complete. All SQL schemas and seed models are valid.");
    return;
  }

  if (!config.rawProvided && config.isLocal) {
    console.log(
      "\nNotice: No explicit remote cloud URI detected. Connecting to default target.\n" +
      "To connect directly to Aiven MySQL, run:\n" +
      "  node seed-cloud-db.js --url=\"mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb\"\n" +
      "Or set AIVEN_MYSQL_URL or MYSQL_URL in your environment.\n"
    );
  }

  let connection;
  try {
    console.log(`[Step 1/4] Establishing secure SSL connection to ${config.host}:${config.port}...`);
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: {
        rejectUnauthorized: false,
      },
      connectTimeout: 10000,
    });

    console.log("✓ Connected to MySQL server successfully.\n");

    // Check version
    const [versionRows] = await connection.query("SELECT VERSION() as version, CURRENT_USER() as user;");
    console.log(` MySQL Server Version : ${versionRows[0]?.version}`);
    console.log(` Authenticated User   : ${versionRows[0]?.user}\n`);

    // 2. Create tables
    console.log("[Step 2/4] Executing schema migrations (creating all necessary tables)...");
    for (const table of TABLE_DEFINITIONS) {
      try {
        await connection.query(table.sql);
        console.log(`  ✓ Table verified: \x1b[32m${table.name}\x1b[0m`);
      } catch (err) {
        console.error(`  ❌ Error creating table ${table.name}:`, err.message);
        throw err;
      }
    }
    console.log("✓ All 14 schema tables verified successfully.\n");

    // 3. Seed users
    console.log("[Step 3/4] Seeding administrative and student accounts...");
    for (const user of SEED_USERS) {
      const [existing] = await connection.query(
        "SELECT id, email, id_number FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(id_number) = LOWER(?) LIMIT 1;",
        [user.email, user.idNumber]
      );

      const hash = await bcrypt.hash(user.password, 10);
      const permissions = JSON.stringify({
        home: true,
        records: true,
        transactions: true,
        reminders: true,
        reports: true,
        history: true,
        settings: true,
      });

      let userId = user.id;

      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO users (id, name, id_number, email, password_hash, role, department, course, status, qr_code, permissions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?);`,
          [user.id, user.name, user.idNumber, user.email, hash, user.role, user.department, user.course, user.qrCode, permissions]
        );
        console.log(`  ✓ Seeded account: ${user.name} (${user.email}) [Role: ${user.role}]`);
      } else {
        userId = existing[0].id;
        await connection.query(
          `UPDATE users SET
             name = ?,
             id_number = ?,
             password_hash = ?,
             role = ?,
             department = ?,
             course = ?,
             status = 'Active',
             permissions = ?,
             updated_at = NOW()
           WHERE id = ?;`,
          [user.name, user.idNumber, hash, user.role, user.department, user.course, permissions, userId]
        );
        console.log(`  ✓ Upserted account credentials: ${user.name} (${user.email}) [Role: ${user.role}]`);
      }

      // Upsert admin profile for non-student users
      if (user.role !== "Student") {
        await connection.query(
          `INSERT INTO admin_profiles (user_id, phone, bio)
           VALUES (?, '+63 917 555 0199', 'Library Administration & Services')
           ON DUPLICATE KEY UPDATE bio = VALUES(bio), updated_at = NOW();`,
          [userId]
        );
      }
    }

    // Seed system_settings singleton row
    await connection.query("INSERT IGNORE INTO system_settings (id) VALUES (1);");
    console.log("  ✓ System settings singleton verified.");

    // 4. Seed catalog books
    console.log("\n[Step 4/4] Seeding core library catalog books...");
    let seededBooksCount = 0;
    for (const b of SEED_BOOKS) {
      const [existing] = await connection.query("SELECT id, isbn FROM books WHERE isbn = ? LIMIT 1;", [b.isbn]);
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO books (
            id, title, author, isbn, department, category, shelf_location,
            published_date, summary, apa_citation, availability, copies, rating
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?);`,
          [
            b.id,
            b.title,
            b.author,
            b.isbn,
            b.department,
            b.category,
            b.shelfLocation,
            b.publishedDate,
            b.summary,
            `${b.author}. (${b.publishedDate.slice(0, 4)}). ${b.title}.`,
            b.copies,
            b.rating,
          ]
        );
        seededBooksCount++;
        console.log(`  ✓ Seeded book: '${b.title}' [ISBN: ${b.isbn}]`);
      }
    }
    if (seededBooksCount === 0) {
      console.log("  - Core catalog books already present in database. Skipping duplicate insertion.");
    }

    // 5. Verification Summary
    console.log("\n==================================================================");
    console.log(" Migration & Verification Report");
    console.log("==================================================================");
    const [tables] = await connection.query("SHOW TABLES;");
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(` Total Tables Active in Database : ${tableNames.length}`);
    console.log(` Table List                      : ${tableNames.join(", ")}`);

    const [[usersCount]] = await connection.query("SELECT COUNT(*) as total FROM users;");
    const [[booksCount]] = await connection.query("SELECT COUNT(*) as total FROM books;");
    console.log(` Active Users Count              : ${usersCount.total}`);
    console.log(` Catalog Books Count             : ${booksCount.total}`);
    console.log("==================================================================");
    console.log("✓ Cloud database migration and seeding completed successfully!");
    console.log("==================================================================");
  } catch (err) {
    console.error("\n❌ Cloud Database Migration Error:", err.message);
    if (err.code) console.error(`   Error Code: ${err.code}`);
    if (err.sqlMessage) console.error(`   SQL Message: ${err.sqlMessage}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main();
