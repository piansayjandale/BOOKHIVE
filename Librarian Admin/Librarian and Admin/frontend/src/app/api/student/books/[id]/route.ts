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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = decodeURIComponent(id).trim();

    const { rows } = await pool.query(
      `SELECT 
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
      WHERE id::text = $1 OR isbn = $1 OR LOWER(title) = LOWER($1)
      LIMIT 1`,
      [cleanId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Book not found." },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { book: rows[0] },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Get Book API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to load book." },
      { status: 500, headers: corsHeaders }
    );
  }
}
