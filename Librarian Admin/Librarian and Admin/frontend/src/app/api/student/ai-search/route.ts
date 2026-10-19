import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = (body.query || body.q || "").trim();
    const department = body.department || "All";

    if (!query) {
      return NextResponse.json({ results: [], books: [] }, { status: 200, headers: corsHeaders });
    }

    const cleanQ = query.toLowerCase();
    const tokens = cleanQ
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t: string) => t.length >= 2)
      .slice(0, 8);

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
        borrow_count AS "borrowCount",
        availability
      FROM books
      WHERE archived_at IS NULL
    `;
    const params: any[] = [];

    if (department && department !== "All") {
      sql += ` AND department = $1`;
      params.push(department);
    }

    const subIdx = params.length + 1;
    params.push(`%${cleanQ}%`);

    if (tokens.length > 0) {
      const tokenPatterns = tokens.map((t: string) => `%${t}%`);
      const tokenIdx = params.length + 1;
      params.push(tokenPatterns);

      sql += ` AND (
        LOWER(title) LIKE LOWER($${subIdx})
        OR LOWER(author) LIKE LOWER($${subIdx})
        OR LOWER(summary) LIKE LOWER($${subIdx})
        OR LOWER(genres) LIKE LOWER($${subIdx})
        OR LOWER(title) LIKE ANY($${tokenIdx})
        OR LOWER(summary) LIKE ANY($${tokenIdx})
      )`;
    } else {
      sql += ` AND (
        LOWER(title) LIKE LOWER($${subIdx})
        OR LOWER(author) LIKE LOWER($${subIdx})
        OR LOWER(summary) LIKE LOWER($${subIdx})
      )`;
    }

    sql += ` ORDER BY 
      CASE 
        WHEN LOWER(title) = LOWER($${params.length + 1}) THEN 1
        WHEN LOWER(title) LIKE LOWER($${params.length + 2}) THEN 2
        ELSE 3
      END,
      borrow_count DESC,
      rating DESC
      LIMIT 60`;
    params.push(query, `${cleanQ}%`);

    const { rows } = await pool.query(sql, params);

    const formatted = rows.map((r: any) => {
      const isAvailable = r.availability !== "Unavailable" && r.availability !== "Borrowed";
      const totalCopies = Math.max(1, Number(r.copies || 1));
      const availableCopies = isAvailable ? totalCopies : 0;
      return {
        id: r.id,
        title: r.title,
        author: r.author,
        isbn: r.isbn,
        department: r.department,
        totalCopies,
        copies: totalCopies,
        isAvailable,
        availableCopies,
        availability: isAvailable ? "Available" : "Unavailable",
        status: isAvailable ? "Available" : "Unavailable",
        borrowedCount: 0,
        reservedCount: 0,
        summary: r.summary,
        genres: r.genres,
        rating: r.rating ? Number(r.rating) : 4.5,
        coverImg: r.coverImg,
        cover_img: r.cover_img,
        relevance: (r.title || "").toLowerCase().includes(cleanQ) ? 95 : 85,
      };
    });

    return NextResponse.json(
      {
        results: formatted,
        books: formatted,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Student AI Search API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Search failed.", results: [], books: [] },
      { status: 500, headers: corsHeaders }
    );
  }
}
