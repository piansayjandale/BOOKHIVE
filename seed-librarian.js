import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root and Backend/.env
dotenv.config();
if (fs.existsSync(path.join(__dirname, "Backend/.env"))) {
  dotenv.config({ path: path.join(__dirname, "Backend/.env") });
}

// Target account specifications
const TARGET_ACCOUNT = {
  id: "usr-librarian-001",
  name: "Yana Brich R. Palmares",
  email: "librarian@stiwnu.edu.ph",
  idNumber: "LIB-2026-0001",
  plaintextPassword: "BookHiveLibrarian!2026",
  role: "Librarian",
  department: "Library Services",
  course: "Library Services",
  qrCode: "e1a10000-lib-4050-8000-000000000001",
  status: "Active",
  permissions: {
    home: true,
    records: true,
    transactions: true,
    reminders: true,
    reports: true,
    history: true,
    settings: true,
  },
};

// Parse command line arguments
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

async function runSeed() {
  console.log("==================================================================");
  console.log(" BookHive Aiven MySQL - Librarian Account Upsert Tool");
  console.log("==================================================================");

  const config = resolveCloudConnectionConfig();
  console.log(` Target Host  : ${config.host}`);
  console.log(` Target Port  : ${config.port}`);
  console.log(` Database     : ${config.database}`);
  console.log(` User         : ${config.user}`);
  console.log(` SSL Required : Enabled (rejectUnauthorized: false)`);
  console.log(` Environment  : ${config.isLocal ? "Localhost" : "Remote Cloud (Aiven)"}`);
  console.log("==================================================================");

  // 1. Compute and verify bcrypt password hash with 10 salt rounds
  console.log("\n[1/4] Generating bcrypt password hash...");
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(TARGET_ACCOUNT.plaintextPassword, saltRounds);
  const hashValidates = await bcrypt.compare(TARGET_ACCOUNT.plaintextPassword, passwordHash);

  if (!hashValidates) {
    throw new Error("Internal error: Generated bcrypt hash failed self-validation test!");
  }
  console.log(`  ✓ Algorithm   : bcryptjs (${saltRounds} salt rounds)`);
  console.log(`  ✓ Hash String : ${passwordHash}`);
  console.log(`  ✓ Self-Check  : Validated successfully against plaintext.`);

  if (dryRun) {
    console.log("\n[DRY RUN MODE ENABLED] Skipping remote database connection.");
    console.log("  Target payload that would be upserted:");
    console.log(`    - ID        : ${TARGET_ACCOUNT.id}`);
    console.log(`    - Name      : ${TARGET_ACCOUNT.name}`);
    console.log(`    - Email     : ${TARGET_ACCOUNT.email}`);
    console.log(`    - ID Number : ${TARGET_ACCOUNT.idNumber}`);
    console.log(`    - Role      : ${TARGET_ACCOUNT.role}`);
    console.log(`    - Status    : ${TARGET_ACCOUNT.status}`);
    console.log(`    - Password  : ${TARGET_ACCOUNT.plaintextPassword} (Hash: ${passwordHash.substring(0, 15)}...)`);
    console.log("\n✓ Dry-run completed successfully.");
    return;
  }

  if (!config.rawProvided && config.isLocal) {
    console.log(
      "\n⚠️ Notice: No remote Aiven MySQL URI detected in environment or CLI.\n" +
      "To target your live Aiven cloud database, pass the connection URI:\n\n" +
      "  node seed-librarian.js --url=\"mysql://avnadmin:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT/defaultdb\"\n\n" +
      "Or set AIVEN_MYSQL_URL or DATABASE_URL in your environment."
    );
  }

  let connection;
  try {
    console.log(`\n[2/4] Connecting to database (${config.host}:${config.port})...`);
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: {
        rejectUnauthorized: false,
      },
      connectTimeout: 15000,
    });
    console.log("  ✓ Connected successfully via SSL.");

    // 2. Ensure schema tables exist
    console.log("\n[3/4] Ensuring table schema exists...");
    await connection.query(`
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
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_profiles (
        user_id VARCHAR(64) PRIMARY KEY,
        phone VARCHAR(50) DEFAULT '',
        bio TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("  ✓ Schema tables 'users' and 'admin_profiles' ready.");

    // 3. Upsert / Replace librarian account
    console.log("\n[4/4] Upserting librarian account in cloud database...");
    const [existing] = await connection.query(
      "SELECT id, email, id_number, role, status FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(id_number) = LOWER(?) LIMIT 1;",
      [TARGET_ACCOUNT.email, TARGET_ACCOUNT.idNumber]
    );

    const permissionsJson = JSON.stringify(TARGET_ACCOUNT.permissions);
    let userId = TARGET_ACCOUNT.id;

    if (existing.length === 0) {
      await connection.query(
        `INSERT INTO users (
          id, name, id_number, email, password_hash, role, department, course, status, qr_code, permissions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          TARGET_ACCOUNT.id,
          TARGET_ACCOUNT.name,
          TARGET_ACCOUNT.idNumber,
          TARGET_ACCOUNT.email,
          passwordHash,
          TARGET_ACCOUNT.role,
          TARGET_ACCOUNT.department,
          TARGET_ACCOUNT.course,
          TARGET_ACCOUNT.status,
          TARGET_ACCOUNT.qrCode,
          permissionsJson,
        ]
      );
      console.log(`  ✓ Inserted brand new user row for '${TARGET_ACCOUNT.email}'.`);
    } else {
      userId = existing[0].id;
      await connection.query(
        `UPDATE users SET
          name = ?,
          id_number = ?,
          email = ?,
          password_hash = ?,
          role = ?,
          department = ?,
          course = ?,
          status = 'Active',
          permissions = ?,
          updated_at = NOW()
        WHERE id = ?;`,
        [
          TARGET_ACCOUNT.name,
          TARGET_ACCOUNT.idNumber,
          TARGET_ACCOUNT.email,
          passwordHash,
          TARGET_ACCOUNT.role,
          TARGET_ACCOUNT.department,
          TARGET_ACCOUNT.course,
          permissionsJson,
          userId,
        ]
      );
      console.log(`  ✓ Updated existing user row (ID: ${userId}) with fresh credentials and role.`);
    }

    // Upsert admin_profiles
    await connection.query(
      `INSERT INTO admin_profiles (user_id, phone, bio)
       VALUES (?, '+63 917 555 0199', 'Library Services & Circulation Administrator')
       ON DUPLICATE KEY UPDATE
         phone = VALUES(phone),
         bio = VALUES(bio),
         updated_at = NOW();`,
      [userId]
    );
    console.log("  ✓ Associated admin_profile upserted.");

    // Verify row from database
    const [verifyRows] = await connection.query(
      `SELECT u.id, u.name, u.email, u.id_number, u.role, u.status, u.password_hash, p.phone, p.bio
       FROM users u
       LEFT JOIN admin_profiles p ON p.user_id = u.id
       WHERE LOWER(u.email) = LOWER(?);`,
      [TARGET_ACCOUNT.email]
    );

    const verifiedUser = verifyRows[0];
    const passwordMatchesDb = await bcrypt.compare(TARGET_ACCOUNT.plaintextPassword, verifiedUser.password_hash);

    console.log("\n==================================================================");
    console.log(" LIBRARIAN ACCOUNT VERIFICATION CONFIRMATION");
    console.log("==================================================================");
    console.log(` Email (Identifier)  : ${verifiedUser.email}`);
    console.log(` Plaintext Password  : ${TARGET_ACCOUNT.plaintextPassword}`);
    console.log(` ID Number           : ${verifiedUser.id_number}`);
    console.log(` Name                : ${verifiedUser.name}`);
    console.log(` Assigned Role       : ${verifiedUser.role}`);
    console.log(` Account Status      : ${verifiedUser.status}`);
    console.log(` Bcrypt Hash in DB   : ${verifiedUser.password_hash.substring(0, 29)}...`);
    console.log(` Password Check Match: ${passwordMatchesDb ? "✓ PASS (Matches)" : "❌ FAIL"}`);
    console.log("==================================================================");
    console.log("✓ Librarian account successfully configured and verified in Aiven MySQL!");
    console.log("==================================================================");
  } catch (err) {
    console.error("\n❌ Database Operation Error:", err.message);
    if (err.code) console.error(`   Error Code: ${err.code}`);
    if (err.sqlMessage) console.error(`   SQL Message: ${err.sqlMessage}`);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runSeed();
