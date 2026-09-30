import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import pg from 'pg';

import { getDatabaseConfig } from '../src/db/connection-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

const CSV_PATH = path.join(__dirname, '../data/imports/books_1.Best_Books_Ever.csv');
const dbConfig = getDatabaseConfig();

function determineDepartment(genres = '', title = '') {
  const g = `${genres} ${title}`.toLowerCase();
  if (g.includes('filipino') || g.includes('philippine') || g.includes('tagalog') || g.includes('rizal') || g.includes('manila')) {
    return 'Filipiniana';
  }
  if (g.includes('reference') || g.includes('encyclopedia') || g.includes('dictionary') || g.includes('handbook') || g.includes('manual') || g.includes('atlas')) {
    return 'General Reference';
  }
  if (g.includes('periodical') || g.includes('magazine') || g.includes('journal') || g.includes('newspaper') || g.includes('annual')) {
    return 'Periodical';
  }
  if (g.includes('special') || g.includes('manuscript') || g.includes('rare') || g.includes('archive') || g.includes('heritage')) {
    return 'Special Collections';
  }
  if (g.includes('textbook') || g.includes('academic') || g.includes('course') || g.includes('curriculum') || g.includes('lecture')) {
    return 'Reserve';
  }
  return 'Circulation';
}

function createShelfLocation(department, seed) {
  const deptPrefix = {
    'Circulation': 'CIR',
    'General Reference': 'GEN',
    'Filipiniana': 'FIL',
    'Reserve': 'RES',
    'Periodical': 'PER',
    'Special Collections': 'SPE'
  }[department] || 'CIR';

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const aisle = String((hash % 30) + 1).padStart(2, '0');
  const shelf = String.fromCharCode(65 + (hash % 6));
  const bay = (hash % 8) + 1;
  return `${deptPrefix}-${aisle}${shelf}.${bay}`;
}

function cleanIsbn(rawIsbn, bookId, index) {
  if (!rawIsbn) return `BK2-${String(bookId || index).padStart(8, '0')}`;
  const cleaned = rawIsbn.replace(/[^0-9X]/gi, '').trim();
  if (cleaned.length >= 8 && cleaned.length <= 17) {
    return cleaned;
  }
  return `BK2-${String(bookId || index).padStart(8, '0')}`;
}

function cleanDate(publishDate, firstPublishDate) {
  const candidates = [publishDate, firstPublishDate];
  for (const raw of candidates) {
    if (!raw) continue;
    const str = String(raw).trim();
    // Try matching 4-digit year 1800-2026
    const yearMatch = str.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
    if (yearMatch) {
      const year = yearMatch[0];
      // Try full YYYY-MM-DD
      const dateMatch = str.match(/\b(1[89]\d{2}|20[0-2]\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
      if (dateMatch) {
        return dateMatch[0];
      }
      return `${year}-01-01`;
    }
  }
  return '2020-01-01';
}

async function runImport() {
  console.log('====================================================');
  console.log('📚 BookHive-2nd: Kaggle Goodreads Dataset Importer');
  console.log('====================================================');

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: CSV dataset not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbConfig.connectionString,
    ssl: dbConfig.ssl,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  console.log(`✓ Connected to PostgreSQL (${dbConfig.host}:${dbConfig.database}, SSL: ${dbConfig.ssl ? 'Enabled' : 'Disabled'})`);

  console.log(`Reading CSV from ${CSV_PATH}...`);
  const stream = fs.createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      bom: true,
      trim: true,
    })
  );

  let totalProcessed = 0;
  let totalInserted = 0;
  let batch = [];
  const BATCH_SIZE = 400;
  const seenIsbns = new Set();
  const startTime = Date.now();

  const insertBatch = async (items) => {
    if (items.length === 0) return;

    const values = [];
    const valuePlaceholders = [];
    let paramIndex = 1;

    for (const item of items) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11})`
      );
      values.push(
        item.title,
        item.author,
        item.isbn,
        item.department,
        item.category,
        item.shelfLocation,
        item.publishedDate,
        item.summary,
        item.apaCitation,
        item.availability,
        item.borrowCount,
        item.copies
      );
      paramIndex += 12;
    }

    const query = `
      INSERT INTO books (
        title, author, isbn, department, category, shelf_location,
        published_date, summary, apa_citation, availability, borrow_count, copies
      ) VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (isbn) DO NOTHING
    `;

    const res = await client.query(query, values);
    totalInserted += res.rowCount || items.length;
  };

  for await (const row of stream) {
    totalProcessed++;

    const title = (row.title || 'Untitled Book').trim().substring(0, 500);
    const author = (row.author || 'Unknown Author').trim().substring(0, 300);
    const rawIsbn = row.isbn || row.bookId || '';
    const isbn = cleanIsbn(rawIsbn, row.bookId, totalProcessed);

    // Skip duplicates in same import stream
    if (seenIsbns.has(isbn)) continue;
    seenIsbns.add(isbn);

    const genres = (row.genres || '').replace(/[\[\]']/g, '');
    const department = determineDepartment(genres, title);
    const category = (genres.split(',')[0] || 'General Fiction').trim().substring(0, 100);
    const shelfLocation = createShelfLocation(department, `${title}-${author}`);
    const publishedDate = cleanDate(row.publishDate, row.firstPublishDate);
    const summary = (row.description || 'No description available.').trim().substring(0, 4000);

    const year = publishedDate.substring(0, 4);
    const publisher = (row.publisher || 'STI Publishing').trim().substring(0, 150);
    const apaCitation = `${author} (${year}). ${title}. ${publisher}.`;

    const numRatings = parseInt(row.numRatings, 10) || 0;
    const bbeVotes = parseInt(row.bbeVotes, 10) || 0;
    const borrowCount = Math.min(999, Math.max(0, Math.floor(numRatings / 2000 + bbeVotes / 25)));
    const copies = (totalProcessed % 5) + 1;

    batch.push({
      title,
      author,
      isbn,
      department,
      category,
      shelfLocation,
      publishedDate,
      summary,
      apaCitation,
      availability: 'Available',
      borrowCount,
      copies
    });

    if (batch.length >= BATCH_SIZE) {
      await insertBatch(batch);
      batch = [];
      if (totalProcessed % 5000 === 0 || totalProcessed === 1000) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏳ Processed ${totalProcessed.toLocaleString()} records... (${totalInserted.toLocaleString()} inserted, ${elapsed}s elapsed)`);
      }
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    batch = [];
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n====================================================');
  console.log(`🎉 Dataset Import COMPLETE in ${duration}s!`);
  console.log(`✓ Processed: ${totalProcessed.toLocaleString()} rows`);
  console.log(`✓ Total Books in 'bookhive_2nd': ${totalInserted.toLocaleString()}`);
  console.log('====================================================');

  const deptCounts = await client.query(`
    SELECT department, COUNT(*)::int as count 
    FROM books 
    GROUP BY department 
    ORDER BY count DESC
  `);
  console.log('\nDepartment Distribution:');
  console.table(deptCounts.rows);

  await client.end();
}

runImport().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
