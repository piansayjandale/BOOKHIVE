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
    const q = (searchParams.get("q") || searchParams.get("query") || "").trim();
    const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 50)));
    const department = searchParams.get("department");

    if (!q) {
      return NextResponse.json({ books: [], total: 0 }, { status: 200, headers: corsHeaders });
    }

    const cleanQ = q.toLowerCase();
    const pattern = `%${cleanQ}%`;

    let sql = `
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
      FROM books b
      WHERE b.archived_at IS NULL
        AND (
          LOWER(b.title) LIKE $1
          OR LOWER(b.author) LIKE $1
          OR LOWER(b.isbn) LIKE $1
          OR LOWER(b.category) LIKE $1
          OR LOWER(COALESCE(b.genres, '')) LIKE $1
        )
    `;
    const params: any[] = [pattern];

    if (department && department !== "All") {
      sql += ` AND b.department = $2`;
      params.push(department);
    }

    sql += ` ORDER BY 
      CASE 
        WHEN LOWER(b.title) = LOWER($${params.length + 1}) THEN 1
        WHEN LOWER(b.title) LIKE LOWER($${params.length + 2}) THEN 2
        ELSE 3
      END,
      b.borrow_count DESC,
      b.title ASC
      LIMIT $${params.length + 3}`;
    params.push(q, `${cleanQ}%`, limit);

    const { rows } = await pool.query(sql, params);

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
        total: mappedBooks.length,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Student Book Search API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to search books.", books: [] },
      { status: 500, headers: corsHeaders }
    );
  }
}
