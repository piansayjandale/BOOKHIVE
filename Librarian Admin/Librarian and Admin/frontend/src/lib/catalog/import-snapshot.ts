import * as fs from "node:fs";
import * as path from "node:path";

import type { BookRecord } from "@/lib/types";

export function resolveSnapshotPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "data", "imports", "books.catalog.json"),
    path.join(process.cwd(), "Librarian Admin", "Librarian and Admin", "frontend", "data", "imports", "books.catalog.json"),
    path.resolve(__dirname, "..", "..", "..", "data", "imports", "books.catalog.json"),
    path.resolve(__dirname, "..", "..", "data", "imports", "books.catalog.json"),
    path.resolve(__dirname, "data", "imports", "books.catalog.json"),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).size > 100) return p;
    } catch {}
  }
  return null;
}

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

function normalizeSnapshotBook(value: unknown, idx: number): BookRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, any>;
  const title = String(item.title || "").trim();
  if (!title) return null;

  const isbn = String(item.isbn || `BOOK-${idx}`);
  const id = String(item.id || isbn || `book-${idx}`);
  const department = (item.department || "Circulation") as BookRecord["department"];
  const category = String(item.category || item.department || "General");

  return {
    id,
    isbn,
    title,
    author: String(item.author || "STI Library Author"),
    department,
    genres: String(item.genres || item.category || item.department || "General"),
    shelfLocation: String(item.shelfLocation || item.shelf || "CIR-01A.1"),
    summary: String(item.summary || item.description || "Library catalog resource."),
    publicationDate: String(item.publicationDate || "2024-01-01"),
    availability: (item.availability || "Available") as BookRecord["availability"],
    borrowCount: Number(item.borrowCount || 0),
    aiScore: Number(item.aiScore || 4.5),
    copies: Number(item.copies || 1),
    archived: Boolean(item.archived || false),
  };
}

export function readCatalogImportSnapshot(): BookRecord[] {
  try {
    const filePath = resolveSnapshotPath() || catalogImportSnapshotPath;
    const stats = fs.statSync(filePath);
    if (cachedSnapshot && cachedSnapshot.mtimeMs === stats.mtimeMs) {
      return cachedSnapshot.books;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const books: BookRecord[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const normalized = normalizeSnapshotBook(parsed[i], i);
      if (normalized) books.push(normalized);
    }

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
