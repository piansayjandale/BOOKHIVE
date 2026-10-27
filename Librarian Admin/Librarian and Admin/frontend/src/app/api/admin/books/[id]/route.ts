import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

function mapDbBookRow(row: any) {
  const pubDate =
    row.publication_date ??
    (row.published_date ? new Date(row.published_date).toISOString().split("T")[0] : "");
  return {
    id: String(row.id),
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    department: row.department,
    category: row.category || "General",
    shelfLocation: row.shelf_location,
    publishedDate: pubDate,
    publicationDate: pubDate,
    archived: row.archived_at !== null && row.archived_at !== undefined,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    availability: row.availability ?? "Available",
    borrowCount: Number(row.borrow_count ?? 0),
    copies: Number(row.copies ?? 1),
    apaCitation: row.apa_citation ?? `${row.author}. (${(pubDate || "").substring(0, 4)}). ${row.title}.`,
    summary: row.summary ?? "",
    genres: row.genres ?? "",
    language: row.language ?? "English",
    publisher: row.publisher ?? "",
    pages: Number(row.pages ?? 0),
    rating: Number(row.rating ?? 4.0),
    aiScore: Number(row.ai_score ?? 70),
    volume: row.volume ?? "Vol. 1",
    edition: row.edition ?? "1st Edition",
    accessionNumber: row.accession_number ?? undefined,
    price: row.price !== undefined && row.price !== null ? Number(row.price) : 0,
    coverImg: row.cover_img ?? "",
    coverImage: row.cover_img ?? "",
    coverUrl: row.cover_img ?? "",
  };
}

async function handleUpdateBook(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend(`/api/admin/books/${id}`, request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const updates = rawBody ? JSON.parse(rawBody) : {};
    const existingRes = await pool.query("SELECT * FROM books WHERE id::text = $1::text", [id]);
    const existing = existingRes.rows[0];
    if (!existing) {
      return NextResponse.json({ message: "Book not found." }, { status: 404 });
    }

    let nextArchivedAt = existing.archived_at;
    if (updates.archived !== undefined) {
      nextArchivedAt = updates.archived ? existing.archived_at ?? new Date().toISOString() : null;
    }

    const coverUri = updates.coverImg ?? updates.coverImage ?? updates.coverUrl ?? null;

    const updateRes = await pool.query(
      `UPDATE books
       SET
         title = COALESCE($1, title),
         author = COALESCE($2, author),
         isbn = COALESCE($3, isbn),
         department = COALESCE($4, department),
         category = COALESCE($5, category),
         shelf_location = COALESCE($6, shelf_location),
         published_date = COALESCE($7::date, published_date),
         summary = COALESCE($8, summary),
         availability = COALESCE($9, availability),
         borrow_count = COALESCE($10, borrow_count),
         publication_date = COALESCE($11, publication_date),
         series = COALESCE($12, series),
         genres = COALESCE($13, genres),
         language = COALESCE($14, language),
         publisher = COALESCE($15, publisher),
         pages = COALESCE($16, pages),
         rating = COALESCE($17, rating),
         cover_img = COALESCE($18, cover_img),
         ai_score = COALESCE($19, ai_score),
         copies = COALESCE($20, copies),
         accession_number = COALESCE($21, accession_number),
         volume = COALESCE($22, volume),
         edition = COALESCE($23, edition),
         price = COALESCE($24, price),
         archived_at = $25,
         updated_at = NOW()
       WHERE id::text = $26::text
       RETURNING *`,
      [
        updates.title ?? null,
        updates.author ?? null,
        updates.isbn ?? null,
        updates.department ?? null,
        updates.category ?? (updates.genres ? updates.genres.split(",")[0]?.trim() : null),
        updates.shelfLocation ?? null,
        updates.publishedDate ?? updates.publicationDate ?? null,
        updates.summary ?? null,
        updates.availability ?? null,
        updates.borrowCount !== undefined ? Number(updates.borrowCount) : null,
        updates.publicationDate ?? updates.publishedDate ?? null,
        updates.series ?? null,
        updates.genres ?? null,
        updates.language ?? null,
        updates.publisher ?? null,
        updates.pages !== undefined ? Number(updates.pages) : null,
        updates.rating !== undefined ? Number(updates.rating) : null,
        coverUri,
        updates.aiScore !== undefined ? Number(updates.aiScore) : null,
        updates.copies !== undefined ? Number(updates.copies) : null,
        updates.accessionNumber ?? null,
        updates.volume ?? null,
        updates.edition ?? null,
        updates.price !== undefined ? Number(String(updates.price).replace(/,/g, "")) : null,
        nextArchivedAt,
        id,
      ]
    );

    const updatedBook = mapDbBookRow(updateRes.rows[0]);
    const session = await getSession().catch(() => null);
    const actorName = session ? `${session.role} ${session.name}` : "BookHive Librarian";

    try {
      const actionLabel =
        updates.archived === true
          ? "Archived book record"
          : updates.archived === false
            ? "Restored book record"
            : "Updated book metadata";
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, $2, $3, 'Records', $4)`,
        [
          actorName,
          actionLabel,
          updatedBook.title,
          "Catalog metadata adjusted for discovery and circulation.",
        ]
      );
      await pool.query(
        `INSERT INTO activity_logs (message, level) VALUES ($1, 'info')`,
        [`Book updated: ${updatedBook.title}`]
      );
    } catch {}

    return NextResponse.json({ book: updatedBook, record: updatedBook });
  } catch (err: any) {
    console.error("Direct DB updateBook error:", err);
    return NextResponse.json(
      { message: err?.message || "Failed to update book." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateBook(request, context);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateBook(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const proxyRes = await proxyToBackend(`/api/admin/books/${id}`, request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    const existingRes = await pool.query("SELECT * FROM books WHERE id::text = $1::text", [id]);
    const existing = existingRes.rows[0];
    if (!existing) {
      return NextResponse.json({ message: "Book not found." }, { status: 404 });
    }

    const session = await getSession().catch(() => null);
    const actorName = session ? `${session.role} ${session.name}` : "BookHive Librarian";

    if (permanent || existing.archived_at) {
      await pool.query("DELETE FROM books WHERE id::text = $1::text", [id]);
      try {
        await pool.query(
          `INSERT INTO history_logs (actor, action, target, module, detail)
           VALUES ($1, 'Deleted book record', $2, 'Records', 'Catalog record permanently removed.')`,
          [actorName, existing.title]
        );
        await pool.query(
          `INSERT INTO activity_logs (message, level) VALUES ($1, 'warning')`,
          [`Book removed: ${existing.title}`]
        );
      } catch {}
      return NextResponse.json({ success: true, deleted: true });
    } else {
      const archiveRes = await pool.query(
        "UPDATE books SET archived_at = NOW(), updated_at = NOW() WHERE id::text = $1::text RETURNING *",
        [id]
      );
      const archivedBook = mapDbBookRow(archiveRes.rows[0]);
      try {
        await pool.query(
          `INSERT INTO history_logs (actor, action, target, module, detail)
           VALUES ($1, 'Archived book record', $2, 'Records', 'Catalog record archived from active circulation.')`,
          [actorName, existing.title]
        );
        await pool.query(
          `INSERT INTO activity_logs (message, level) VALUES ($1, 'warning')`,
          [`Book archived: ${existing.title}`]
        );
      } catch {}
      return NextResponse.json({ success: true, book: archivedBook, record: archivedBook });
    }
  } catch (err: any) {
    console.error("Direct DB delete/archive Book error:", err);
    return NextResponse.json(
      { message: err?.message || "Failed to delete or archive book." },
      { status: 500 }
    );
  }
}
