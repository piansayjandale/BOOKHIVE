CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text UNIQUE,
  name text NOT NULL,
  email citext NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('Admin', 'Librarian', 'Student')),
  department text NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  password_hash text,
  avatar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz
);

CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn text NOT NULL UNIQUE,
  title text NOT NULL,
  author text NOT NULL,
  publication_date date,
  department text NOT NULL,
  shelf_location text NOT NULL,
  availability text NOT NULL DEFAULT 'Available'
    CHECK (availability IN ('Available', 'Limited', 'Reserved', 'Archived')),
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  borrow_count integer NOT NULL DEFAULT 0,
  ai_score numeric(5,2) NOT NULL DEFAULT 0,
  search_document tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(author, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(isbn, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_isbn_idx ON books (isbn);
CREATE INDEX IF NOT EXISTS books_title_idx ON books (title);
CREATE INDEX IF NOT EXISTS books_author_idx ON books (author);
CREATE INDEX IF NOT EXISTS books_department_idx ON books (department);
CREATE INDEX IF NOT EXISTS books_title_trgm_idx ON books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS books_author_trgm_idx ON books USING gin (author gin_trgm_ops);
CREATE INDEX IF NOT EXISTS books_search_document_idx ON books USING gin (search_document);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('Borrow', 'Return', 'Reservation')),
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Declined', 'Returned')),
  duration_days integer NOT NULL DEFAULT 7,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  due_at timestamptz,
  returned_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_status_idx
  ON transactions (user_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS transactions_book_status_idx
  ON transactions (book_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS transactions_processed_by_idx
  ON transactions (processed_by, requested_at DESC);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved', 'Declined', 'Fulfilled', 'Cancelled')),
  queue_position integer,
  requested_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reservations_user_status_idx
  ON reservations (user_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS reservations_book_status_idx
  ON reservations (book_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('All Users', 'Students', 'Staff')),
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal', 'Important', 'Urgent')),
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_published_idx
  ON announcements (published, updated_at DESC);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role text,
  module text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  logged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, logged_at)
) PARTITION BY RANGE (logged_at);

CREATE TABLE IF NOT EXISTS activity_logs_default
  PARTITION OF activity_logs DEFAULT;

CREATE INDEX IF NOT EXISTS activity_logs_actor_idx
  ON activity_logs_default (actor_user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_module_idx
  ON activity_logs_default (module, logged_at DESC);

CREATE TABLE IF NOT EXISTS analytics_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  dimension_key text,
  dimension_value text,
  metric_value numeric(14,4) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE TABLE IF NOT EXISTS analytics_logs_default
  PARTITION OF analytics_logs DEFAULT;

CREATE INDEX IF NOT EXISTS analytics_logs_metric_idx
  ON analytics_logs_default (metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS analytics_logs_dimension_idx
  ON analytics_logs_default (dimension_key, dimension_value, recorded_at DESC);
