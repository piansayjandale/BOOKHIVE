import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "csv-parse";
import { config as loadEnv } from "dotenv";

import { writeCatalogImportSnapshot } from "../src/lib/catalog/import-snapshot";
import { getCatalogDb } from "../src/lib/catalog/db";
import { toCatalogBookRecord, transformGoodreadsRow } from "../src/lib/catalog/shared";
import type { BookRecord } from "../src/lib/types";

loadEnv({ path: path.join(process.cwd(), ".env.local") });
loadEnv({ path: path.join(process.cwd(), ".env") });

const datasetUrl =
  "https://raw.githubusercontent.com/scostap/goodreads_bbe_dataset/main/Best_Books_Ever_dataset/books_1.Best_Books_Ever.csv";
const importsDirectory = path.join(process.cwd(), "data", "imports");
const defaultCsvPath = path.join(importsDirectory, "books_1.Best_Books_Ever.csv");

const argv = process.argv.slice(2);
const fileArg = argv.find((arg) => arg.startsWith("--file=") || arg.startsWith("-f="));
const fileArgIndex = argv.findIndex((arg) => arg === "--file" || arg === "-f");
const csvPath = fileArg
  ? path.resolve(process.cwd(), fileArg.split("=")[1])
  : fileArgIndex >= 0 && argv[fileArgIndex + 1]
  ? path.resolve(process.cwd(), argv[fileArgIndex + 1])
  : defaultCsvPath;
const forceDownload = argv.includes("--download");
const useLocalFile = fileArg !== undefined || fileArgIndex >= 0;

async function ensureDatasetFile() {
  fs.mkdirSync(importsDirectory, { recursive: true });

  if (!forceDownload && fs.existsSync(csvPath) && fs.statSync(csvPath).size > 1_000_000) {
    return csvPath;
  }

  if (useLocalFile) {
    throw new Error(
      `Local dataset file not found: ${csvPath}. Please download the Kaggle CSV from https://tinyurl.com/kaggledsets and save it there, or omit --file to import from the default public source.`,
    );
  }

  const response = await fetch(datasetUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Goodreads dataset: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(csvPath, Buffer.from(arrayBuffer));
  return csvPath;
}

async function importCsv() {
  const sourcePath = await ensureDatasetFile();
  let database: Awaited<ReturnType<typeof getCatalogDb>> | null = null;

  try {
    database = await getCatalogDb();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Catalog PostgreSQL unavailable (${message}). Continuing with local snapshot import only.`);
  }

  const upsertBookSql = `
    INSERT INTO books (
      id,
      source,
      source_book_id,
      title,
      author,
      isbn,
      publication_date,
      department,
      shelf_location,
      summary,
      series,
      genres,
      language,
      publisher,
      pages,
      rating,
      num_ratings,
      liked_percent,
      cover_img,
      bbe_score,
      bbe_votes,
      borrow_count,
      availability,
      ai_score,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
    )
    ON CONFLICT (id) DO UPDATE SET
      source = EXCLUDED.source,
      source_book_id = EXCLUDED.source_book_id,
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      isbn = EXCLUDED.isbn,
      publication_date = EXCLUDED.publication_date,
      department = EXCLUDED.department,
      shelf_location = EXCLUDED.shelf_location,
      summary = EXCLUDED.summary,
      series = EXCLUDED.series,
      genres = EXCLUDED.genres,
      language = EXCLUDED.language,
      publisher = EXCLUDED.publisher,
      pages = EXCLUDED.pages,
      rating = EXCLUDED.rating,
      num_ratings = EXCLUDED.num_ratings,
      liked_percent = EXCLUDED.liked_percent,
      cover_img = EXCLUDED.cover_img,
      bbe_score = EXCLUDED.bbe_score,
      bbe_votes = EXCLUDED.bbe_votes,
      borrow_count = EXCLUDED.borrow_count,
      availability = EXCLUDED.availability,
      ai_score = EXCLUDED.ai_score,
      updated_at = EXCLUDED.updated_at
  `;

  if (database) {
    await database.query("BEGIN");
  }

  let imported = 0;
  const snapshotBooks: BookRecord[] = [];

  try {
    const parser = fs.createReadStream(sourcePath).pipe(
      parse({
        bom: true,
        columns: true,
        relax_quotes: true,
        skip_empty_lines: true,
        trim: true,
      }),
    );

    for await (const row of parser as AsyncIterable<Record<string, string>>) {
      const book = transformGoodreadsRow(row, imported + 1);
      const now = new Date().toISOString();
      if (database) {
        await database.query(upsertBookSql, [
          book.id,
          book.source ?? "goodreads-best-books",
          book.sourceBookId ?? "",
          book.title,
          book.author,
          book.isbn,
          book.publicationDate,
          book.department,
          book.shelfLocation,
          book.summary,
          book.series ?? "",
          book.genres ?? "",
          book.language ?? "",
          book.publisher ?? "",
          book.pages ?? 0,
          book.rating ?? 0,
          book.numRatings ?? 0,
          book.likedPercent ?? 0,
          book.coverImg ?? "",
          book.bbeScore ?? 0,
          book.bbeVotes ?? 0,
          book.borrowCount ?? 0,
          book.availability ?? "Available",
          book.aiScore ?? 70,
          now,
          now,
        ]);
      }

      snapshotBooks.push(
        toCatalogBookRecord({
          ...book,
          availability: book.availability ?? "Available",
          aiScore: book.aiScore ?? 70,
          borrowCount: book.borrowCount ?? 0,
        }),
      );

      imported += 1;
      if (imported % 5000 === 0) {
        console.log(`Imported ${imported} books...`);
      }
    }

    const snapshotPath = writeCatalogImportSnapshot(snapshotBooks);

    if (database) {
      await database.query("COMMIT");
    }

    console.log(`Imported ${imported} books from ${path.relative(process.cwd(), sourcePath)}.`);
    console.log(`Wrote local catalog snapshot to ${path.relative(process.cwd(), snapshotPath)}.`);
    if (database) {
      console.log("Catalog PostgreSQL updated successfully.");
    }
  } catch (error) {
    if (database) {
      await database.query("ROLLBACK");
    }
    throw error;
  }
}

void importCsv().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
