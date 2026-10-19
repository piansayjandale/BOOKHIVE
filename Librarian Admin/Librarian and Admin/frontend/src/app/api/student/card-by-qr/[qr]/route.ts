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
  { params }: { params: Promise<{ qr: string }> }
) {
  try {
    const { qr } = await params;
    const cleanId = decodeURIComponent(qr).trim();

    const { rows } = await pool.query(
      `SELECT 
        id::text AS "id",
        name,
        email,
        role,
        id_number AS "idNumber",
        id_number AS "studentId",
        department,
        course,
        year_level AS "yearLevel",
        avatar,
        qr_code AS "qrCode",
        status
      FROM users
      WHERE LOWER(id_number) = LOWER($1)
         OR LOWER(email) = LOWER($1)
         OR id::text = $1
         OR qr_code = $1
      LIMIT 1`,
      [cleanId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Student card not found." },
        { status: 404, headers: corsHeaders }
      );
    }

    const student = rows[0];

    // Fetch student's active loans & history
    const txRes = await pool.query(
      `SELECT
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
        t.created_at::text AS "createdAt"
       FROM transactions t
       WHERE (LOWER(t.student_id) = LOWER($1) OR LOWER(t.student_name) = LOWER($2))
       ORDER BY t.requested_at DESC
       LIMIT 50`,
      [student.idNumber, student.name]
    );

    return NextResponse.json(
      {
        student,
        transactions: txRes.rows,
        borrowHistory: txRes.rows,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Card By QR API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to resolve student card." },
      { status: 500, headers: corsHeaders }
    );
  }
}
