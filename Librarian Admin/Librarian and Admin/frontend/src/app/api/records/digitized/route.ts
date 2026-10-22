import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

function sanitizeIsbn(val?: string | null): string {
  if (!val) return "";
  return String(val)
    .replace(/[—–]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function mapDigitizedRow(row: any) {
  return {
    id: String(row.id),
    title: row.title || "Untitled Book",
    author: row.author || "Unknown Author",
    isbn: row.isbn || "",
    genre: row.genre || row.category || "General",
    category: row.category || row.genre || "General",
    department: row.department || "Circulation",
    shelfLocation: row.shelf_location || row.shelfLocation || "",
    accessionNumber: row.accession_number || row.accessionNumber || "",
    copies: Number(row.copies ?? 1),
    edition: row.edition || "1st Edition",
    volume: row.volume || "Vol. 1",
    publisher: row.publisher || "",
    publishedDate: row.publication_date
      ? new Date(row.publication_date).toISOString().split("T")[0]
      : row.publishedDate || "",
    year: row.year || "",
    pages: Number(row.pages ?? 1),
    summary: row.summary || "",
    docType: row.doc_type || row.docType || "Catalog Intake Slip",
    ocrEngine: row.ocr_engine || row.ocrEngine || "Tesseract Neural OCR",
    confidence: Number(row.confidence ?? 95.0),
    rawText: row.raw_text || row.rawText || "",
    scannedBy: row.scanned_by || row.scannedBy || "Librarian Mobile App",
    status: row.status || "Pending Review",
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/digitized-books", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback to direct DB
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const department = searchParams.get("department") || "All";

    const filters: any[] = [];
    const whereClauses: string[] = ["status = 'Pending Review'"];

    if (department !== "All") {
      filters.push(department);
      whereClauses.push(`department = $${filters.length}`);
    }

    if (search) {
      filters.push(`%${search}%`);
      const idx = filters.length;
      whereClauses.push(
        `(LOWER(title) LIKE $${idx} OR LOWER(author) LIKE $${idx} OR LOWER(isbn) LIKE $${idx} OR LOWER(raw_text) LIKE $${idx})`
      );
    }

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT * FROM digitized_books ${where} ORDER BY created_at DESC`,
      filters
    );
    const books = rows.map(mapDigitizedRow);
    return NextResponse.json({ books, total: books.length });
  } catch (err) {
    console.warn("Direct DB digitized_books GET fallback:", err);
    return NextResponse.json({ books: [], total: 0 });
  }
}

export async function POST(request: Request) {
  let rawBodyText = "";
  let body: any = {};
  try {
    rawBodyText = await request.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      body = JSON.parse(rawBodyText);
    }
  } catch {
    return NextResponse.json({ message: "Failed to parse body" }, { status: 400 });
  }

  try {
    const proxyRes = await proxyToBackend(
      "/api/admin/digitized-books",
      request,
      rawBodyText
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback to direct DB
  }

  try {
    const cleanIsbn =
      sanitizeIsbn(body.isbn) || `SCAN-${Date.now().toString().slice(-6)}`;
    const pubDate =
      body.publicationDate ||
      body.publishedDate ||
      new Date().toISOString().split("T")[0];

    const { rows } = await pool.query(
      `INSERT INTO digitized_books (
        title, author, isbn, genre, category, department, shelf_location,
        accession_number, copies, edition, volume, publisher, publication_date,
        year, pages, summary, doc_type, ocr_engine, confidence, raw_text,
        scanned_by, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, COALESCE($13::date, NOW()::date),
        $14, $15, $16, $17, $18, $19, $20,
        $21, 'Pending Review'
      )
      RETURNING *`,
      [
        body.title || "Untitled Book",
        body.author || "Unknown Author",
        cleanIsbn,
        body.genre || body.category || "General",
        body.category || body.genre || "General",
        body.department || "Circulation",
        body.shelfLocation || body.shelf || "",
        body.accessionNumber || "",
        Math.max(1, Number(body.copies ?? 1)),
        body.edition || "1st Edition",
        body.volume || "Vol. 1",
        body.publisher || "",
        pubDate,
        body.year || String(new Date().getFullYear()),
        Number(body.pages ?? 1),
        body.summary || body.description || "",
        body.docType || "Catalog Intake Slip",
        body.ocrEngine || "Tesseract Neural OCR",
        Number(body.confidence ?? 95.0),
        body.rawText || "",
        body.scannedBy || "Librarian Mobile App",
      ]
    );

    const book = rows[0] ? mapDigitizedRow(rows[0]) : { ...body, isbn: cleanIsbn };
    return NextResponse.json({ book, success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Direct DB digitized_books POST error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to save digitized book" },
      { status: 500 }
    );
  }
}
