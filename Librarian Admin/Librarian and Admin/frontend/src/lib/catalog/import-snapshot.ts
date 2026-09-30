import * as fs from "node:fs";
import * as path from "node:path";

import type { BookRecord } from "@/lib/types";

export const catalogImportSnapshotPath = path.join(
  process.cwd(),
  "data",
  "imports",
  "books.catalog.json",
);

let cachedSnapshot:
  | {
      mtimeMs: number;
      books: BookRecord[];
    }
  | null = null;

function isBookRecord(value: unknown): value is BookRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<BookRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.author === "string" &&
    typeof candidate.isbn === "string" &&
    typeof candidate.department === "string" &&
    typeof candidate.shelfLocation === "string" &&
    typeof candidate.summary === "string"
  );
}

export function readCatalogImportSnapshot() {
  try {
    const stats = fs.statSync(catalogImportSnapshotPath);
    if (cachedSnapshot && cachedSnapshot.mtimeMs === stats.mtimeMs) {
      return cachedSnapshot.books;
    }

    const raw = fs.readFileSync(catalogImportSnapshotPath, "utf8");
    const parsed = JSON.parse(raw);
    const books = Array.isArray(parsed) ? parsed.filter(isBookRecord) : [];

    cachedSnapshot = {
      mtimeMs: stats.mtimeMs,
      books,
    };

    return books;
  } catch {
    return [] as BookRecord[];
  }
}

export function writeCatalogImportSnapshot(books: BookRecord[]) {
  fs.mkdirSync(path.dirname(catalogImportSnapshotPath), { recursive: true });
  fs.writeFileSync(catalogImportSnapshotPath, JSON.stringify(books));

  cachedSnapshot = {
    mtimeMs: fs.statSync(catalogImportSnapshotPath).mtimeMs,
    books,
  };

  return catalogImportSnapshotPath;
}
