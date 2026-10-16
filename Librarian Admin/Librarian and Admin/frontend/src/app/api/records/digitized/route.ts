import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

function sanitizeIsbn(val?: string | null): string {
  if (!val) return "";
  return String(val)
    .replace(/[—–]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

const fallbackDigitizedBooks: any[] = [
  {
    id: "digi-001",
    title: "The Struggle",
    author: "Betty",
    isbn: "978-0-123456-78-9",
    genre: "Action and Adventure",
    category: "Action and Adventure",
    department: "General Reference",
    shelfLocation: "GEN-ACT-002",
    accessionNumber: "ACC-2026-0042",
    copies: 2,
    edition: "1st Edition",
    volume: "Vol. 1",
    publisher: "Scholastic Press",
    publishedDate: "2018-06-15",
    year: "2018",
    pages: 320,
    summary: "A thrilling adventure highlighting personal struggles, resilience and courage in the face of adversity.",
    docType: "Catalog Intake Slip",
    ocrEngine: "Tesseract Neural OCR",
    confidence: 96.4,
    rawText: "Title: The Struggle\nAuthor: Betty\nGenre: Action and Adventure\nDepartment: General Reference\nCopies: 2\nYear: 2018",
    scannedBy: "Librarian Mobile App (Scanner)",
    status: "Pending Review",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "digi-002",
    title: "Philippine Folk Literature: The Epics",
    author: "Damiana L. Eugenio",
    isbn: "978-971-542-294-9",
    genre: "Folklore & Literature",
    category: "Filipiniana",
    department: "Filipiniana",
    shelfLocation: "FIL-EUG-014",
    accessionNumber: "ACC-2026-0089",
    copies: 3,
    edition: "2nd Edition",
    volume: "Vol. 3",
    publisher: "University of the Philippines Press",
    publishedDate: "2001-08-20",
    year: "2001",
    pages: 450,
    summary: "Comprehensive collection and analysis of indigenous Philippine oral epics with English translations.",
    docType: "Title Page Scan",
    ocrEngine: "Tesseract Neural OCR",
    confidence: 98.2,
    rawText: "Philippine Folk Literature: The Epics\nDamiana L. Eugenio\nUP Press 2001\nISBN 978-971-542-294-9",
    scannedBy: "Librarian Mobile App (Scanner)",
    status: "Pending Review",
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
  }
];

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/digitized-books", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    // try direct
  }

  try {
    const proxyDirect = await proxyToBackend("/api/digitized-books", request);
    if (proxyDirect.ok) {
      return proxyDirect;
    }
  } catch (err) {
    console.warn("Proxy to /api/digitized-books failed, using fallback:", err);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.toLowerCase() || "";
  const department = searchParams.get("department") || "All";

  const filtered = fallbackDigitizedBooks.filter((book) => {
    if (department !== "All" && book.department !== department) return false;
    if (search) {
      const match =
        book.title.toLowerCase().includes(search) ||
        book.author.toLowerCase().includes(search) ||
        book.isbn.toLowerCase().includes(search) ||
        book.rawText.toLowerCase().includes(search);
      if (!match) return false;
    }
    return true;
  });

  return NextResponse.json({ books: filtered, total: filtered.length });
}

export async function POST(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/digitized-books", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    // try direct
  }

  try {
    const proxyDirect = await proxyToBackend("/api/digitized-books", request);
    if (proxyDirect.ok) {
      return proxyDirect;
    }
  } catch (err) {
    console.warn("Proxy POST to /api/digitized-books failed:", err);
  }

  try {
    const body = await request.json();
    const newBook = {
      ...body,
      id: `digi-${Date.now()}`,
      isbn: sanitizeIsbn(body.isbn) || `SCAN-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: "Pending Review",
    };
    fallbackDigitizedBooks.unshift(newBook);
    return NextResponse.json({ book: newBook, success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Failed to parse body" }, { status: 400 });
  }
}
