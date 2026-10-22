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
    `;
    const params: any[] = [];

    if (department && department !== "All") {
      sql += ` AND department = $1`;
      params.push(department);
    }

    sql += ` ORDER BY borrow_count DESC, title ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

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
      const isAvailable = b.availability === "Available";
      const availableCopies = isAvailable ? totalCopies : 0;
      return {
        ...b,
        totalCopies,
        copies: totalCopies,
        isAvailable,
        availableCopies,
        status: b.availability || "Available",
        availability: b.availability || "Available",
        borrowedCount: 0,
        reservedCount: 0,
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
    console.error("[Student Books API] Error:", err);
    return NextResponse.json(
      { message: "Failed to load catalog.", books: [] },
      { status: 200, headers: corsHeaders }
    );
  }
}
