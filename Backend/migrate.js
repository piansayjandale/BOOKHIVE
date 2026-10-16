import pg from "pg";
import dotenv from "dotenv";
import { getDatabaseConfig, maskDatabaseUrl } from "./src/db/connection-config.js";

dotenv.config();

const { Client } = pg;

// Parse CLI flags (e.g. node migrate.js --url="postgresql://...")
const args = process.argv.slice(2);
let cliUrl = null;
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--url=")) {
    cliUrl = arg.slice(6);
  } else if ((arg === "--url" || arg === "-u") && args[i + 1]) {
    cliUrl = args[i + 1];
    i++;
  }
}

const dbConfig = getDatabaseConfig(cliUrl);

async function migrate() {
  console.log("==================================================");
  console.log(" BookHive Database Migration Runner");
  console.log("==================================================");
  console.log(` Target Host : ${dbConfig.host}`);
  console.log(` Database    : ${dbConfig.database}`);
  console.log(` Environment : ${dbConfig.isLocal ? "Localhost" : "Remote Cloud"}`);
  console.log(` SSL Status  : ${dbConfig.ssl ? "Enabled (rejectUnauthorized: false)" : "Disabled"}`);
  console.log(` Connection  : ${maskDatabaseUrl(dbConfig.connectionString)}`);
  console.log("==================================================");

  const client = new Client({
    connectionString: dbConfig.connectionString,
    ssl: dbConfig.ssl,
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    console.log("✓ Connected to database. Running incremental migrations...\n");

    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log("✓ Verified extension: pgcrypto");

    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS student_id_image TEXT");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS comment TEXT");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ");
    console.log("✓ Verified columns: transactions (student_id_image, comment, available_at, expires_at, picked_up_at)");

    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code UUID UNIQUE DEFAULT gen_random_uuid()");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS year_level TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS section TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{\"home\":true,\"records\":true,\"transactions\":true,\"reminders\":true,\"reports\":true,\"history\":true,\"settings\":true}'::jsonb");
    await client.query("UPDATE users SET qr_code = gen_random_uuid() WHERE qr_code IS NULL");
    console.log("✓ Verified columns: users (avatar, qr_code, year_level, section, permissions)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS violations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL,
        student_name TEXT,
        book_title TEXT NOT NULL,
        isbn TEXT,
        violation_type TEXT NOT NULL DEFAULT 'Overdue Book Return',
        penalty_amount NUMERIC NOT NULL DEFAULT 0.00,
        status TEXT NOT NULL DEFAULT 'Active',
        remarks TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
      )
    `);
    await client.query("CREATE INDEX IF NOT EXISTS idx_violations_student_id ON violations(student_id)");
    console.log("✓ Verified table: violations");

    await client.query(`
      CREATE OR REPLACE FUNCTION update_book_availability_trigger()
      RETURNS TRIGGER AS $$
      DECLARE
        target_isbn TEXT;
        target_title TEXT;
      BEGIN
        IF (TG_OP = 'DELETE') THEN
          target_isbn := OLD.isbn;
          target_title := OLD.resource_title;
        ELSE
          target_isbn := NEW.isbn;
          target_title := NEW.resource_title;
        END IF;

        IF target_isbn IS NOT NULL OR target_title IS NOT NULL THEN
          UPDATE books b
          SET availability = CASE
            WHEN GREATEST(0, COALESCE(b.copies, 1) 
              - (SELECT COUNT(*) FROM transactions t WHERE ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn) OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))) AND t.type = 'Borrow' AND t.status IN ('Approved', 'Pending'))
              - (SELECT COUNT(*) FROM transactions t WHERE ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn) OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))) AND t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()))
            ) > 0 THEN 'Available'
            WHEN (SELECT COUNT(*) FROM transactions t WHERE ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn) OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))) AND t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW())) > 0 THEN 'Reserved'
            ELSE 'Unavailable'
          END,
          updated_at = NOW()
          WHERE (target_isbn IS NOT NULL AND target_isbn != '' AND target_isbn != 'N/A' AND b.isbn = target_isbn)
             OR (target_title IS NOT NULL AND LOWER(b.title) = LOWER(target_title));
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_update_book_availability ON transactions;
      CREATE TRIGGER trg_update_book_availability
      AFTER INSERT OR UPDATE OR DELETE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_book_availability_trigger();
    `);
    console.log("✓ Verified trigger: trg_update_book_availability (Aligned with Borrow & Reservation holds)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS digitized_books (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Unknown Author',
        isbn TEXT,
        genre TEXT DEFAULT 'General',
        category TEXT DEFAULT 'General',
        department TEXT DEFAULT 'Circulation',
        shelf_location TEXT,
        accession_number TEXT,
        copies INTEGER NOT NULL DEFAULT 1,
        edition TEXT DEFAULT '1st Edition',
        volume TEXT DEFAULT 'Vol. 1',
        publisher TEXT,
        publication_date DATE DEFAULT NOW()::date,
        year TEXT,
        pages INTEGER DEFAULT 1,
        summary TEXT,
        doc_type TEXT DEFAULT 'Catalog Intake Slip',
        ocr_engine TEXT DEFAULT 'Tesseract Neural OCR',
        confidence NUMERIC DEFAULT 95.0,
        raw_text TEXT,
        scanned_by TEXT DEFAULT 'Librarian Mobile App',
        status TEXT NOT NULL DEFAULT 'Pending Review',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_digitized_books_status ON digitized_books(status);
      CREATE INDEX IF NOT EXISTS idx_digitized_books_created_at ON digitized_books(created_at DESC);
    `);
    console.log("✓ Verified table: digitized_books (Librarian mobile intake & scanner queue)");

    await client.query(`
      ALTER TABLE books ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'bookhive';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS source_book_id TEXT;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS publication_date TEXT DEFAULT '';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS series TEXT DEFAULT '';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS genres TEXT DEFAULT '';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS publisher TEXT DEFAULT '';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS pages INTEGER DEFAULT 0;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS rating REAL DEFAULT 0;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS num_ratings INTEGER DEFAULT 0;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS liked_percent REAL DEFAULT 0;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS cover_img TEXT DEFAULT '';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS bbe_score INTEGER DEFAULT 0;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS bbe_votes INTEGER DEFAULT 0;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 70;
      ALTER TABLE books ADD COLUMN IF NOT EXISTS volume TEXT DEFAULT 'Vol. 1';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS edition TEXT DEFAULT '1st Edition';
      ALTER TABLE books ADD COLUMN IF NOT EXISTS accession_number TEXT DEFAULT '';

      UPDATE books
      SET publication_date = TO_CHAR(published_date, 'YYYY-MM-DD')
      WHERE (publication_date IS NULL OR publication_date = '')
        AND published_date IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_books_source ON books(source);
      CREATE INDEX IF NOT EXISTS idx_books_borrow_count ON books(borrow_count DESC);
    `);
    console.log("✓ Verified columns & indexes: books (18 extended catalog & AI search columns)");

    await client.query(`
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

      CREATE INDEX IF NOT EXISTS idx_admin_account_users_role ON admin_account_users(role);
      CREATE INDEX IF NOT EXISTS idx_admin_account_users_last_active ON admin_account_users(last_active DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_created_at ON admin_auth_logs(created_at DESC);
    `);
    console.log("✓ Verified tables: admin_account_users, admin_account_profiles, admin_auth_logs");

    console.log("\n==================================================");
    console.log(" All migrations completed successfully!");
    console.log("==================================================");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
