import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));
    const department = searchParams.get("department");

    const params: any[] = [];
    let deptClause = "";
    if (department && department !== "All") {
      params.push(department);
      deptClause = ` AND b.department = $${params.length}`;
    }

    const countRes = await pool
      .query(`SELECT COUNT(*)::int AS total FROM books b WHERE b.archived_at IS NULL ${deptClause}`, params)
      .catch(() => ({ rows: [{ total: 0 }] }));
    const totalCount = Number(countRes.rows[0]?.total || 0);

    params.push(limit, offset);
    const sql = `
      WITH paged_books AS (
        SELECT b.*
        FROM books b
        WHERE b.archived_at IS NULL ${deptClause}
        ORDER BY b.borrow_count DESC, b.title ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      )
      SELECT 
        b.id::text AS "id",
        b.title,
        b.author,
        b.isbn,
        b.department,
        b.category,
        b.shelf_location AS "shelfLocation",
        b.shelf_location AS "shelf",
        b.summary,
        b.summary AS "description",
        b.rating,
        b.cover_img AS "coverImg",
        b.cover_img AS "cover_img",
        b.cover_img AS "coverUrl",
        b.cover_img AS "coverImage",
        b.genres,
        b.language,
        b.publisher,
        b.publication_date AS "publicationDate",
        b.published_date AS "publishedDate",
        b.pages,
        b.volume,
        b.edition,
        b.accession_number AS "accessionNumber",
        b.borrow_count AS "borrowCount",
        b.copies,
        b.availability,
        COALESCE((
          SELECT COUNT(*)::int FROM transactions t
          WHERE t.type = 'Borrow' AND t.status IN ('Approved', 'Pending')
            AND ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
              OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title)))
        ), 0) AS "borrowedCount",
        COALESCE((
          SELECT COUNT(*)::int FROM transactions t
          WHERE t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW())
            AND ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
              OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title)))
        ), 0) AS "reservedCount"
      FROM paged_books b
      ORDER BY b.borrow_count DESC, b.title ASC
    `;

    let rows: any[] = [];
    try {
      const res = await pool.query(sql, params);
      rows = res.rows;
    } catch (dbErr: any) {
      console.warn("[Student Books API] Cloud DB query notice, using seedBooks fallback:", dbErr.message);
      const { seedBooks } = await import("@/lib/data/seed");
      rows = (seedBooks || []).slice(offset, offset + limit);
    }

    const mappedBooks = rows.map((b: any) => {
      const totalCopies = Math.max(1, Number(b.copies || 1));
      const borrowedCount = Number(b.borrowedCount || 0);
      const reservedCount = Number(b.reservedCount || 0);
      const availableCopies = Math.max(0, totalCopies - borrowedCount);
      const isAvailable = availableCopies > 0 && b.availability !== "Unavailable";
      const pubDate =
        b.publicationDate ||
        (b.publishedDate ? new Date(b.publishedDate).toISOString().split("T")[0] : "");
      return {
        ...b,
        publicationDate: pubDate,
        publishedDate: pubDate,
        year: pubDate ? String(pubDate).substring(0, 4) : "",
        totalCopies,
        copies: totalCopies,
        isAvailable,
        availableCopies,
        status: isAvailable ? "Available" : reservedCount > 0 ? "Reserved" : "Unavailable",
        availability: isAvailable ? "Available" : reservedCount > 0 ? "Reserved" : "Unavailable",
        borrowedCount,
        reservedCount,
      };
    });

    return NextResponse.json(
      {
        books: mappedBooks,
        total: totalCount || mappedBooks.length,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Student Books API] Error:", err);
    return NextResponse.json(
      { message: "Failed to load catalog.", books: [] },
      { status: 200, headers: corsHeaders }
    );
  }
}
