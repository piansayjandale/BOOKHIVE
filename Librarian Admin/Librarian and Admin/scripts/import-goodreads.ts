import { parse } from "csv-parse";
import fs from "fs";
import { resolve } from "path";
import { Pool } from "pg";

// Reusing existing env vars since we are outside next.js context natively
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function createShelfLocation(department: string, seed: string) {
  const hash = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const aisle = (hash % 20) + 1;
  const shelf = String.fromCharCode(65 + (hash % 6));
  const deptPrefix = department.substring(0, 3).toUpperCase();
  return `${deptPrefix}-${aisle}${shelf}`;
}

function determineDepartment(genres: string): string {
  const lowerGenres = genres.toLowerCase();
  if (lowerGenres.includes("computer") || lowerGenres.includes("tech") || lowerGenres.includes("programming")) {
    return "Computer Science";
  }
  if (lowerGenres.includes("business") || lowerGenres.includes("economics") || lowerGenres.includes("management")) {
    return "Business & Accountancy";
  }
  if (lowerGenres.includes("science") || lowerGenres.includes("biology") || lowerGenres.includes("physics") || lowerGenres.includes("engineer")) {
    return "Engineering";
  }
  if (lowerGenres.includes("art") || lowerGenres.includes("design") || lowerGenres.includes("history")) {
    return "Arts & Sciences";
  }
  if (lowerGenres.includes("education") || lowerGenres.includes("teaching")) {
    return "Education";
  }
  return "Arts & Sciences";
}

async function main() {
  const args = process.argv.slice(2);
  const fileArgIndex = args.indexOf("--file");
  if (fileArgIndex === -1 || !args[fileArgIndex + 1]) {
    console.error("Usage: tsx import-goodreads.ts --file <path-to-csv>");
    process.exit(1);
  }
  
  const filePath = resolve(process.cwd(), args[fileArgIndex + 1]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error(`Please download the dataset from https://tinyurl.com/kaggledsets and place it at the requested path.`);
    process.exit(1);
  }

  console.log(`Starting import from ${filePath}...`);
  
  // Removed CREATE TABLE since schema.sql handles it.
  
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    })
  );

  let processedCount = 0;
  let insertedCount = 0;
  const batchSize = 100;
  let batch: any[] = [];

  for await (const record of parser) {
    processedCount++;
    
    // Parse the record
    const title = record.title || "Unknown Title";
    const author = record.author || "Unknown Author";
    const isbn = record.isbn || `N/A-${processedCount}`;
    const department = determineDepartment(record.genres || "");
    const shelfLocation = createShelfLocation(department, `${title}-${author}`);
    const summary = record.description || "";
    
    const numRatings = parseInt(record.numRatings, 10) || 0;
    const bbeVotes = parseInt(record.bbeVotes, 10) || 0;
    const borrowCount = Math.floor((numRatings / 1000) + (bbeVotes / 10)); // Mock logic
    
    const publishDate = record.publishDate || record.firstPublishDate || new Date().toISOString().split('T')[0];
    const parsedDate = new Date(publishDate);
    const validDate = isNaN(parsedDate.getTime()) ? new Date().toISOString().split('T')[0] : parsedDate.toISOString().split('T')[0];
    
    const apaCitation = `${author}. (${validDate.substring(0, 4)}). ${title}. ${record.publisher || 'Unknown Publisher'}.`;

    batch.push([
      title,
      author,
      isbn,
      department,
      record.genres ? record.genres.split(',')[0].trim() : "General", // category
      shelfLocation,
      validDate,
      summary.substring(0, 5000), // Avoid crazy long descriptions
      apaCitation,
      "Available",
      borrowCount
    ]);

    if (batch.length >= batchSize) {
      await insertBatch(batch);
      insertedCount += batch.length;
      batch = [];
      console.log(`Inserted ${insertedCount} records...`);
    }
  }

  if (batch.length > 0) {
    await insertBatch(batch);
    insertedCount += batch.length;
  }

  console.log(`Done! Successfully processed ${processedCount} rows and inserted ${insertedCount} books.`);
  process.exit(0);
}

async function insertBatch(batch: any[]) {
  if (batch.length === 0) return;
  
  const placeholders = batch.map((_, i) => {
    const offset = i * 11;
    return `(${Array.from({ length: 11 }, (_, j) => `$${offset + j + 1}`).join(", ")})`;
  }).join(", ");

  const values = batch.flat();

  const query = `
    INSERT INTO books (
      title, author, isbn, department, category, shelf_location, 
      published_date, summary, apa_citation, availability, borrow_count
    ) VALUES ${placeholders}
    ON CONFLICT (isbn) DO NOTHING
  `;

  try {
    await pool.query(query, values);
  } catch (error) {
    console.error("Batch insert error:", error);
  }
}

main().catch(console.error);
