CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('Super Admin', 'Admin', 'Librarian', 'Technical Librarian', 'Circulation Librarian', 'Student', 'SUPER_ADMIN', 'ADMIN', 'CIRCULATION_LIBRARIAN', 'TECHNICAL_LIBRARIAN', 'STUDENT');
  ELSE
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Super Admin';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Technical Librarian';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'TECHNICAL_LIBRARIAN';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Circulation Librarian';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CIRCULATION_LIBRARIAN';
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STUDENT';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('Active', 'Suspended');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('Borrow', 'Return', 'Reservation');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    CREATE TYPE transaction_status AS ENUM ('Pending', 'Approved', 'Declined', 'Returned', 'Cancelled');
  ELSE
    BEGIN
      ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'Cancelled';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;


  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'log_severity') THEN
    CREATE TYPE log_severity AS ENUM ('info', 'success', 'warning');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  id_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  department TEXT NOT NULL,
  course TEXT NOT NULL,
  year_level TEXT,
  section TEXT,
  status user_status NOT NULL DEFAULT 'Active',
  avatar TEXT,
  school_id_front TEXT,
  school_id_back TEXT,
  library_id_front TEXT,
  library_id_back TEXT,
  qr_code UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  permissions JSONB DEFAULT '{"home":true,"records":true,"transactions":true,"reminders":true,"reports":true,"history":true,"settings":true}'::jsonb,
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS idx_violations_student_id ON violations(student_id);
CREATE INDEX IF NOT EXISTS idx_users_qr_code ON users(qr_code);

CREATE TABLE IF NOT EXISTS admin_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL,
  category TEXT NOT NULL,
  shelf_location TEXT NOT NULL,
  published_date DATE NOT NULL,
  summary TEXT NOT NULL,
  apa_citation TEXT NOT NULL,
  availability TEXT NOT NULL DEFAULT 'Available',
  borrow_count INTEGER NOT NULL DEFAULT 0,
  copies INTEGER NOT NULL DEFAULT 1,
  source TEXT DEFAULT 'bookhive',
  source_book_id TEXT,
  publication_date TEXT DEFAULT '',
  series TEXT DEFAULT '',
  genres TEXT DEFAULT '',
  language TEXT DEFAULT 'English',
  publisher TEXT DEFAULT '',
  pages INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  num_ratings INTEGER DEFAULT 0,
  liked_percent REAL DEFAULT 0,
  cover_img TEXT DEFAULT '',
  bbe_score INTEGER DEFAULT 0,
  bbe_votes INTEGER DEFAULT 0,
  ai_score INTEGER DEFAULT 70,
  volume TEXT DEFAULT 'Vol. 1',
  edition TEXT DEFAULT '1st Edition',
  accession_number TEXT DEFAULT '',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
CREATE INDEX IF NOT EXISTS idx_books_source ON books(source);
CREATE INDEX IF NOT EXISTS idx_books_borrow_count ON books(borrow_count DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  resource_title TEXT NOT NULL,
  isbn TEXT NOT NULL,
  department TEXT NOT NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'Pending',
  duration_days INTEGER NOT NULL DEFAULT 7,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  student_id_image TEXT,
  comment TEXT,
  available_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reserved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status transaction_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  department TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'ai',
  file_names TEXT[] NOT NULL DEFAULT '{}',
  matches_found INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  severity log_severity NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT NOT NULL,
  priority TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  author TEXT NOT NULL,
  duration_days INTEGER DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS history_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  module TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  theme TEXT NOT NULL DEFAULT 'dark',
  borrow_limit INTEGER NOT NULL DEFAULT 5,
  borrow_duration_days INTEGER NOT NULL DEFAULT 7,
  storage_used_percent INTEGER NOT NULL DEFAULT 0,
  indexing_status TEXT NOT NULL DEFAULT 'Healthy',
  ai_engine TEXT NOT NULL DEFAULT 'BookHive AI',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  allow_admin_transaction_control BOOLEAN NOT NULL DEFAULT FALSE,
  ai_strict_mode BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT system_settings_singleton CHECK (id = 1)
);

INSERT INTO system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_books_department ON books(department);
CREATE INDEX IF NOT EXISTS idx_transactions_requested_at ON transactions(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_ai_search_logs_created_at ON ai_search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_updated_at ON announcements(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_logs_created_at ON history_logs(created_at DESC);

-- Real-time Book Availability Trigger
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

-- System Backups and Snapshots
CREATE TABLE IF NOT EXISTS system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size_mb NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  backup_type TEXT NOT NULL DEFAULT 'MANUAL',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_by TEXT NOT NULL DEFAULT 'Super Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON system_backups(created_at DESC);

-- Institutional Sync Logs
CREATE TABLE IF NOT EXISTS institutional_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'STI WNU Directory Ecosystem',
  synced_records INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  details TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_institutional_sync_logs_synced_at ON institutional_sync_logs(synced_at DESC);

-- Digitized Intake Slip & Scanner Books
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

-- Next.js Admin Account & Auth Audit Tables
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
