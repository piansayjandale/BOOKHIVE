import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_PATH = path.join(__dirname, '../../Student/data/imports/books.catalog.json');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd'
});

async function exportCatalog() {
  console.log('Connecting to PostgreSQL database...');
  await client.connect();

  console.log('Querying all books from DB...');
  const res = await client.query(`
    SELECT 
      isbn, 
      title, 
      author, 
      department, 
      category, 
      shelf_location AS "shelfLocation",
      summary, 
      TO_CHAR(published_date, 'YYYY-MM-DD') AS "publicationDate", 
      availability, 
      rating, 
      copies 
    FROM books 
    WHERE archived_at IS NULL 
    ORDER BY id ASC
  `);

  console.log(`Retrieved ${res.rows.length} books.`);

  const formattedBooks = res.rows.map(row => {
    let summary = (row.summary || '').trim();
    if (summary.length > 180) {
      summary = summary.substring(0, 177) + '...';
    }

    return {
      isbn: row.isbn || '',
      title: row.title || 'Untitled Book',
      author: row.author || 'Unknown Author',
      department: row.department || 'Circulation Section',
      category: row.category || 'General',
      shelfLocation: row.shelfLocation || 'CIR-01A.1',
      summary: summary || 'Library catalog resource.',
      publicationDate: row.publicationDate || '2024-01-01',
      availability: row.availability || 'Available',
      rating: Number(row.rating) || 4.5,
      copies: Number(row.copies) || 1
    };
  });

  console.log(`Writing to ${TARGET_PATH}...`);
  fs.writeFileSync(TARGET_PATH, JSON.stringify(formattedBooks));

  const stats = fs.statSync(TARGET_PATH);
  console.log(`✓ Successfully exported ${formattedBooks.length} books!`);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  await client.end();
}

exportCatalog().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
