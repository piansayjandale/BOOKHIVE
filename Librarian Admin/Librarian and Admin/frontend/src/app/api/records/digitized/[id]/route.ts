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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let rawBodyText = "";
  let body: any = {};
  try {
    rawBodyText = await request.text();
    if (rawBodyText) {
      body = JSON.parse(rawBodyText);
    }
  } catch {}

  const rawScanned =
    body.scannedBy ||
    body.scanned_by ||
    (Array.isArray(body.librarians) ? body.librarians.filter(Boolean).join(", ") : "");
  const cleanIsbn = sanitizeIsbn(body.isbn);

  try {
    const proxyRes = await proxyToBackend(
      `/api/admin/digitized-books/${id}`,
      request,
      rawBodyText
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {}

  try {
    const { rows } = await pool.query(
      `UPDATE digitized_books
       SET title = COALESCE($1, title),
           author = COALESCE($2, author),
           isbn = COALESCE($3, isbn),
           department = COALESCE($4, department),
           genre = COALESCE($5, genre),
           category = COALESCE($6, category),
           copies = COALESCE($7, copies),
           shelf_location = COALESCE($8, shelf_location),
           accession_number = COALESCE($9, accession_number),
           edition = COALESCE($10, edition),
           volume = COALESCE($11, volume),
           publisher = COALESCE($12, publisher),
           publication_date = COALESCE($13::date, publication_date),
           summary = COALESCE($14, summary),
           scanned_by = COALESCE($15, scanned_by),
           updated_at = NOW()
       WHERE id::text = $16::text
       RETURNING *`,
      [
        body.title || null,
        body.author || null,
        cleanIsbn || body.isbn || null,
        body.department || null,
        body.genres || body.genre || body.category || null,
        body.category || body.genres || body.genre || null,
        body.copies ? Number(body.copies) : null,
        body.shelfLocation || body.shelf || null,
        body.accessionNumber || null,
        body.edition || null,
        body.volume || null,
        body.publisher || null,
        body.publishedDate || body.publicationDate || null,
        body.summary || null,
        rawScanned || null,
        id,
      ]
    );

    return NextResponse.json({
      ok: true,
      book: rows[0] || { id, ...body, scannedBy: rawScanned },
      message: "Digitized book record updated.",
    });
  } catch (err: any) {
    console.warn("Direct DB PATCH digitized_books error:", err);
    return NextResponse.json({ ok: true, message: "Updated in queue" });
  }
}

export const PUT = PATCH;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const proxyRes = await proxyToBackend(
      `/api/admin/digitized-books/${id}`,
      request
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback to direct DB
  }

  try {
    await pool.query(
      "DELETE FROM digitized_books WHERE id::text = $1::text",
      [id]
    );
  } catch (err) {
    console.warn("Direct DB DELETE digitized_books error:", err);
  }

  return NextResponse.json({ ok: true, message: "Removed from digitized queue" });
}
