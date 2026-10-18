import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Candidate paths to canonical 48k books catalog
const candidatePaths = [
  path.resolve(__dirname, "../../data/imports/books.catalog.json"),
  path.resolve(__dirname, "../../../Librarian Admin/Librarian and Admin/frontend/data/imports/books.catalog.json"),
  path.resolve(__dirname, "../../../Student/data/imports/books.catalog.json"),
  path.resolve(process.cwd(), "data/imports/books.catalog.json"),
  path.resolve(process.cwd(), "Backend/data/imports/books.catalog.json"),
  path.resolve(process.cwd(), "Student/data/imports/books.catalog.json"),
];

let cachedBooks = null;
let prefixIndex = null;

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do",
  "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it",
  "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "with", "you", "your", "yours", "yourself", "yourselves",
  "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend",
  "recommended", "looking", "for", "about", "describe", "detail", "details", "analyse", "analyze"
]);

/**
 * Load and cache catalog books in memory
 */
export function getCatalogBooks() {
  if (cachedBooks) return cachedBooks;

  for (const catalogJsonPath of candidatePaths) {
    if (fs.existsSync(catalogJsonPath)) {
      try {
        const raw = fs.readFileSync(catalogJsonPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedBooks = parsed;
          console.log(`[Catalog Loader] Loaded ${cachedBooks.length} books from ${path.basename(catalogJsonPath)}`);
          return cachedBooks;
        }
      } catch (err) {
        console.warn(`[Catalog Loader] Failed to read ${catalogJsonPath}:`, err.message);
      }
    }
  }

  cachedBooks = [];
  return cachedBooks;
}

/**
 * Build prefix index for fast A-Z lookup
 */
function getPrefixIndex() {
  if (prefixIndex) return prefixIndex;

  const books = getCatalogBooks();
  const map = new Map();

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const title = (book.title || "").trim();
    if (!title) continue;

    const norm = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const clean = norm.replace(/[^a-z0-9]/g, "");
    const noArticle = norm.replace(/^(the|a|an)\s+/i, "").replace(/[^a-z0-9]/g, "");

    // Index 1-3 letter prefixes
    for (const prefix of [clean.slice(0, 1), clean.slice(0, 2), clean.slice(0, 3), noArticle.slice(0, 1), noArticle.slice(0, 2), noArticle.slice(0, 3)]) {
      if (!prefix) continue;
      let list = map.get(prefix);
      if (!list) {
        list = [];
        map.set(prefix, list);
      }
      list.push(book);
    }
  }

  prefixIndex = map;
  return prefixIndex;
}

/**
 * Search books by title prefix
 */
export function searchCatalogByPrefix(query, limit = 50) {
  if (!query) return [];

  const normQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cleanQuery = normQuery.replace(/[^a-z0-9]/g, "");
  if (!cleanQuery) return [];

  const books = getCatalogBooks();
  const exactMatches = [];
  const prefixMatches = [];
  const containsMatches = [];

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const title = (book.title || "").trim();
    if (!title) continue;

    const normTitle = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const cleanTitle = normTitle.replace(/[^a-z0-9]/g, "");
    const titleNoArticle = normTitle.replace(/^(the|a|an)\s+/i, "").replace(/[^a-z0-9]/g, "");

    if (cleanTitle === cleanQuery || normTitle === normQuery || titleNoArticle === cleanQuery) {
      exactMatches.push(book);
    } else if (cleanTitle.startsWith(cleanQuery) || (titleNoArticle.length > 0 && titleNoArticle.startsWith(cleanQuery))) {
      prefixMatches.push(book);
    } else if (cleanTitle.includes(cleanQuery)) {
      containsMatches.push(book);
    }

    if (exactMatches.length + prefixMatches.length >= limit * 2) break;
  }

  return [...exactMatches, ...prefixMatches, ...containsMatches].slice(0, limit);
}

/**
 * Search books by prompt keywords, prioritizing title matches
 */
export function searchCatalogByKeyword(query, limit = 50) {
  if (!query) return [];

  const rawQuery = query.toLowerCase().trim();
  const coreQuery = rawQuery
    .replace(
      /^(please\s+)?(can\s+you\s+)?(find|show|search|get|give|recommend|suggest|look\s+for|looking\s+for|i\s+want\s+to\s+read|i\s+need)\s+(me\s+)?(a\s+|an\s+|the\s+|some\s+|any\s+)?(books?\s+|novels?\s+|references?\s+|titles?\s+)?(about\s+|on\s+|for\s+|titled\s+|called\s+|named\s+|by\s+|with\s+)?/i,
      ""
    )
    .replace(/^(books?\s+|novels?\s+|references?\s+)(about\s+|on\s+|for\s+|like\s+|titled\s+|called\s+)/i, "")
    .trim() || rawQuery;

  const allWords = coreQuery.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const filteredWords = allWords.filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const words = filteredWords.length > 0 ? filteredWords : allWords;
  if (words.length === 0) return [];

  const books = getCatalogBooks();
  const exactAndAllTitleMatches = [];
  const partialTitleMatches = [];
  const metadataMatches = [];

  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const titleLower = (b.title || "").toLowerCase();
    const cleanTitle = titleLower.replace(/[^a-z0-9\s]/g, " ");

    let titleHits = 0;
    for (const w of words) {
      if (cleanTitle.includes(w)) {
        titleHits++;
      }
    }

    if (titleHits === words.length) {
      exactAndAllTitleMatches.push(b);
    } else if (titleHits > 0) {
      partialTitleMatches.push(b);
    } else {
      const summaryLower = (b.summary || b.description || "").toLowerCase();
      const authorLower = (b.author || "").toLowerCase();
      const categoryLower = (b.category || b.department || "").toLowerCase();
      const meta = `${summaryLower} ${authorLower} ${categoryLower}`;

      let metaHits = 0;
      for (const w of words) {
        if (meta.includes(w)) {
          metaHits++;
        }
      }
      if (metaHits >= Math.min(2, words.length)) {
        metadataMatches.push(b);
      }
    }

    if (exactAndAllTitleMatches.length >= limit) break;
  }

  return [...exactAndAllTitleMatches, ...partialTitleMatches, ...metadataMatches].slice(0, limit);
}

/**
 * Format catalog book record for database insertion or API response
 */
export function formatCatalogBook(raw) {
  const department = raw.department || "Circulation Section";
  const category = raw.category || (raw.genres ? String(raw.genres).split(",")[0] : "General");
  return {
    id: raw.id || `cat-${raw.isbn || Math.random().toString(36).slice(2)}`,
    title: raw.title || "Untitled Book",
    author: raw.author || "Unknown Author",
    isbn: raw.isbn || "",
    department,
    category,
    shelf_location: raw.shelfLocation || raw.shelf_location || "CIR-01A.1",
    shelfLocation: raw.shelfLocation || raw.shelf_location || "CIR-01A.1",
    summary: raw.summary || raw.description || "",
    description: raw.summary || raw.description || "",
    rating: Number(raw.rating || 4.5),
    cover_img: raw.coverUrl || raw.coverImg || raw.cover_img || "",
    coverUrl: raw.coverUrl || raw.coverImg || raw.cover_img || "",
    genres: raw.genres || "",
    language: raw.language || "English",
    publisher: raw.publisher || "STI Publishing",
    borrow_count: Number(raw.borrowCount || raw.borrow_count || 12),
    copies: Number(raw.copies || 1),
    availability: raw.availability || raw.status || "Available",
    published_date: raw.publicationDate || raw.published_date || "2020-01-01",
    apa_citation: raw.apaCitation || `${raw.author || "Unknown"}. (${String(raw.publicationDate || "2020").slice(0, 4)}). ${raw.title || "Untitled"}.`,
  };
}

/**
 * Ensures critical canonical books (such as Romeo and Juliet) and catalog books
 * are populated into the PostgreSQL database on startup.
 */
export async function ensureEssentialBooksSeeded(pool) {
  if (!pool) return;

  try {
    // 1. Check if "Romeo and Juliet" exists in DB
    const rjCheck = await pool.query(
      "SELECT id FROM books WHERE LOWER(TRIM(title)) = 'romeo and juliet' LIMIT 1"
    );

    if (rjCheck.rows.length === 0) {
      console.log("[Catalog Loader] 'Romeo and Juliet' missing from books table. Seeding canonical books...");
      const books = getCatalogBooks();
      const canonicalTitles = [
        "romeo and juliet",
        "the romeo and juliet code",
        "shakespeare's romeo and juliet remixed",
        "ibong adarna",
        "noli me tangere",
        "el filibusterismo",
        "florante at laura"
      ];

      const toInsert = books.filter((b) =>
        canonicalTitles.includes((b.title || "").trim().toLowerCase())
      );

      for (const b of toInsert) {
        const fb = formatCatalogBook(b);
        await pool.query(
          `INSERT INTO books (
            title, author, isbn, department, category, shelf_location,
            published_date, summary, apa_citation, availability, borrow_count, copies
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (isbn) DO UPDATE SET title = EXCLUDED.title`,
          [
            fb.title,
            fb.author,
            fb.isbn,
            fb.department,
            fb.category,
            fb.shelf_location,
            fb.published_date,
            fb.summary,
            fb.apa_citation,
            fb.availability,
            fb.borrow_count,
            fb.copies,
          ]
        );
        console.log(`[Catalog Loader] Seeded canonical book: ${fb.title}`);
      }
    }

    // 2. Check total book count; if low (< 40,000), backfill catalog books in background
    const countRes = await pool.query("SELECT count(id)::int as count FROM books");
    const totalCount = countRes.rows[0]?.count || 0;
    if (totalCount < 40000) {
      console.log(`[Catalog Loader] Database contains ${totalCount} books. Starting asynchronous catalog sync...`);
      // Run background backfill in batches
      setTimeout(() => {
        backfillCatalogToDatabase(pool).catch((e) =>
          console.warn("[Catalog Loader] Background backfill error:", e.message)
        );
      }, 2000);
    }
  } catch (err) {
    console.warn("[Catalog Loader] ensureEssentialBooksSeeded warning:", err.message);
  }
}

/**
 * Asynchronously backfills books from catalog into PostgreSQL database in batches
 */
async function backfillCatalogToDatabase(pool) {
  const books = getCatalogBooks();
  if (books.length === 0) return;

  const BATCH_SIZE = 250;
  let batch = [];
  let inserted = 0;

  for (let i = 0; i < books.length; i++) {
    const fb = formatCatalogBook(books[i]);
    batch.push(fb);

    if (batch.length >= BATCH_SIZE) {
      await insertBatchBooks(pool, batch);
      inserted += batch.length;
      batch = [];
      // Yield to event loop to not starve request handling
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  if (batch.length > 0) {
    await insertBatchBooks(pool, batch);
    inserted += batch.length;
  }

  console.log(`[Catalog Loader] Background sync completed. Processed ${inserted} books.`);
}

async function insertBatchBooks(pool, items) {
  if (items.length === 0) return;

  const valuePlaceholders = [];
  const values = [];
  let paramIndex = 1;

  for (const item of items) {
    valuePlaceholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11})`
    );
    values.push(
      item.title,
      item.author,
      item.isbn,
      item.department,
      item.category,
      item.shelf_location,
      item.published_date,
      item.summary,
      item.apa_citation,
      item.availability,
      item.borrow_count,
      item.copies
    );
    paramIndex += 12;
  }

  const query = `
    INSERT INTO books (
      title, author, isbn, department, category, shelf_location,
      published_date, summary, apa_citation, availability, borrow_count, copies
    ) VALUES ${valuePlaceholders.join(", ")}
    ON CONFLICT (isbn) DO NOTHING
  `;

  try {
    await pool.query(query, values);
  } catch (err) {
    // Non-fatal duplicate or format error
  }
}
