import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { catalogRepository } from "@/lib/catalog/repository";
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let rawBodyText = "";
  let body: any = {};
  try {
    rawBodyText = await request.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      body = JSON.parse(rawBodyText);
    }
  } catch {
    // ignore
  }

  try {
    const proxyRes = await proxyToBackend(
      `/api/admin/digitized-books/${id}/approve`,
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
    let existing: any = null;
    try {
      const { rows } = await pool.query(
        "SELECT * FROM digitized_books WHERE id::text = $1::text LIMIT 1",
        [id]
      );
      if (rows[0]) existing = rows[0];
    } catch {}

    const created = await catalogRepository.addBook({
      title: body.title || existing?.title || "Untitled Book",
      author: body.author || existing?.author || "Unknown Author",
      isbn:
        sanitizeIsbn(body.isbn || existing?.isbn) ||
        `CAT-${Date.now().toString().slice(-6)}`,
      department: body.department || existing?.department || "Circulation",
      category: body.category || body.genre || existing?.genre || "General",
      genres: body.genres || body.genre || existing?.genre || "General",
      shelfLocation:
        body.shelfLocation || existing?.shelf_location || "Circulation Desk",
      accessionNumber:
        body.accessionNumber || existing?.accession_number || undefined,
      copies: Number(body.copies ?? existing?.copies ?? 1),
      edition: body.edition || existing?.edition || "1st Edition",
      volume: body.volume || existing?.volume || "Vol. 1",
      publisher: body.publisher || existing?.publisher || "",
      publishedDate:
        body.publishedDate ||
        body.publicationDate ||
        (existing?.publication_date
          ? new Date(existing.publication_date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]),
      summary: body.summary || existing?.summary || "",
      availability: "Available",
      coverImg: "",
    } as any);

    try {
      await pool.query(
        "UPDATE digitized_books SET status = 'Cataloged', updated_at = NOW() WHERE id::text = $1::text",
        [id]
      );
    } catch {}

    return NextResponse.json({
      book: created,
      success: true,
      message: "Officially cataloged and added to records.",
    });
  } catch (error: any) {
    console.error("Approve digitized book fallback error:", error);
    return NextResponse.json(
      { message: error?.message || "Failed to approve and catalog book." },
      { status: 500 }
    );
  }
}
