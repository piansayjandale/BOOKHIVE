import { hasExplicitDatabaseUrl, pool } from "@/lib/db";

let catalogDbFailureBackoffUntil = 0;

async function initializeCatalogSchema() {
  if (Date.now() < catalogDbFailureBackoffUntil) {
    throw new Error("Catalog PostgreSQL temporarily unavailable.");
  }

  // The books table is created by schema.sql with: id UUID PRIMARY KEY, shelf_location TEXT, etc.
  // We add the extra catalog columns that schema.sql doesn't define.
  await pool.query(`
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
  `);

  // Backfill publication_date from published_date (DATE column) for existing rows
  await pool.query(`
    UPDATE books
    SET publication_date = TO_CHAR(published_date, 'YYYY-MM-DD')
    WHERE (publication_date IS NULL OR publication_date = '')
      AND published_date IS NOT NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_books_source ON books(source);
    CREATE INDEX IF NOT EXISTS idx_books_borrow_count ON books(borrow_count DESC);
  `);
}



export async function getCatalogDb() {
  if (!hasExplicitDatabaseUrl) {
    throw new Error("Catalog PostgreSQL is not configured.");
  }

  try {
    await initializeCatalogSchema();
  } catch (error) {
    catalogDbFailureBackoffUntil = Date.now() + 60_000;
    throw error;
  }

  return pool;
}
