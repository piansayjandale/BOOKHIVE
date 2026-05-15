import { hasExplicitDatabaseUrl, pool } from "@/lib/db";

let catalogDbFailureBackoffUntil = 0;

async function initializeCatalogSchema() {
  if (Date.now() < catalogDbFailureBackoffUntil) {
    throw new Error("Catalog PostgreSQL temporarily unavailable.");
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      catalog_id SERIAL PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'bookhive',
      source_book_id TEXT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      isbn TEXT NOT NULL,
      publication_date TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL,
      shelf_location TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      series TEXT NOT NULL DEFAULT '',
      genres TEXT NOT NULL DEFAULT '',
      language TEXT NOT NULL DEFAULT '',
      publisher TEXT NOT NULL DEFAULT '',
      pages INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0,
      num_ratings INTEGER NOT NULL DEFAULT 0,
      liked_percent REAL NOT NULL DEFAULT 0,
      cover_img TEXT NOT NULL DEFAULT '',
      bbe_score INTEGER NOT NULL DEFAULT 0,
      bbe_votes INTEGER NOT NULL DEFAULT 0,
      borrow_count INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT 'Available',
      ai_score INTEGER NOT NULL DEFAULT 70,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_books_department ON books(department);
    CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
    CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
    CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
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
