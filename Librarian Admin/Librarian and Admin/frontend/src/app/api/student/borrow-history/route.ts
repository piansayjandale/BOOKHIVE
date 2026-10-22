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
    const studentId = searchParams.get("studentId");
    const email = searchParams.get("email");

    // Extract auth header if present
    const authHeader = request.headers.get("authorization");
    let authSub = "";
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf-8")
          );
          authSub = payload.sub || payload.id || payload.studentId || payload.email || "";
        }
      } catch {
        // ignore decode failure
      }
    }

    const targetIdentifier = studentId || email || authSub;

    let query: string;
    let params: any[];

    if (targetIdentifier) {
      query = `
        SELECT
          t.id::text AS "id",
          t.user_id::text AS "userId",
          t.student_name AS "studentName",
          t.student_id AS "studentId",
          t.department,
          t.isbn,
          t.resource_title AS "resourceTitle",
          t.resource_title AS "title",
          t.type::text AS "type",
          t.status::text AS "status",
          t.requested_at::text AS "requestedAt",
          t.due_date::text AS "dueDate",
          t.picked_up_at::text AS "pickedUpAt",
          t.created_at::text AS "createdAt",
          b.cover_img AS "coverImg",
          b.cover_img AS "cover_img"
        FROM transactions t
        LEFT JOIN books b ON (
          (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
          OR (LOWER(t.resource_title) = LOWER(b.title))
        )
        WHERE (
          LOWER(t.student_id) = LOWER($1)
          OR LOWER(t.student_name) = LOWER($1)
          OR t.user_id::text = $1
          OR LOWER(t.student_id) = (SELECT LOWER(id_number) FROM users WHERE id::text = $1 OR LOWER(id_number) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1)
          OR t.user_id = (SELECT id FROM users WHERE id::text = $1 OR LOWER(id_number) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1)
        )
        ORDER BY t.requested_at DESC
        LIMIT 200
      `;
      params = [targetIdentifier];
    } else {
      query = `
        SELECT
          t.id::text AS "id",
          t.user_id::text AS "userId",
          t.student_name AS "studentName",
          t.student_id AS "studentId",
          t.department,
          t.isbn,
          t.resource_title AS "resourceTitle",
          t.resource_title AS "title",
          t.type::text AS "type",
          t.status::text AS "status",
          t.requested_at::text AS "requestedAt",
          t.due_date::text AS "dueDate",
          t.picked_up_at::text AS "pickedUpAt",
          t.created_at::text AS "createdAt",
          b.cover_img AS "coverImg",
          b.cover_img AS "cover_img"
        FROM transactions t
        LEFT JOIN books b ON (
          (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
          OR (LOWER(t.resource_title) = LOWER(b.title))
        )
        ORDER BY t.requested_at DESC
        LIMIT 200
      `;
      params = [];
    }

    const { rows } = await pool.query(query, params);

    return NextResponse.json(
      {
        transactions: rows,
        history: rows,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Borrow History API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to load borrow history.", transactions: [], history: [] },
      { status: 500, headers: corsHeaders }
    );
  }
}
