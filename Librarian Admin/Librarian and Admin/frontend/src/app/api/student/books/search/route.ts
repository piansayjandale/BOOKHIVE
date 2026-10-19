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
        id::text AS "id",
        title,
        author,
        isbn,
        department,
        category,
        shelf_location AS "shelfLocation",
        summary,
        rating,
        cover_img AS "coverImg",
        cover_img AS "cover_img",
        genres,
        language,
        publisher,
        borrow_count AS "borrowCount",
        copies,
        availability
      FROM books
      WHERE archived_at IS NULL
        AND (
          LOWER(title) LIKE $1
          OR LOWER(author) LIKE $1
          OR LOWER(isbn) LIKE $1
          OR LOWER(category) LIKE $1
        )
    `;
    const params: any[] = [pattern];

    if (department && department !== "All") {
      sql += ` AND department = $2`;
      params.push(department);
    }

    sql += ` ORDER BY 
      CASE 
        WHEN LOWER(title) = LOWER($${params.length + 1}) THEN 1
        WHEN LOWER(title) LIKE LOWER($${params.length + 2}) THEN 2
        ELSE 3
      END,
      borrow_count DESC,
      title ASC
      LIMIT $${params.length + 3}`;
    params.push(q, `${cleanQ}%`, limit);

    const { rows } = await pool.query(sql, params);

    return NextResponse.json(
      {
        books: rows,
        total: rows.length,
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
