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
    const {
      bookId,
      studentName = "",
      studentId = "",
      department = "Circulation",
      isbn = "N/A",
      resourceTitle = "",
      dueDate,
      studentIdImage = null,
    } = body;

    const finalTitle = (resourceTitle || "").trim() || "Library Book";
    const finalIsbn = (isbn || "").trim() || "N/A";
    const finalDept = (department || "").trim() || "Circulation";

    if (!studentId && !studentName) {
      return NextResponse.json(
        { message: "Student credentials (studentId or studentName) are required." },
        { status: 400, headers: corsHeaders }
      );
    }

    let validDueDate: string;
    if (dueDate && String(dueDate) !== "Not set" && !isNaN(new Date(dueDate).getTime())) {
      validDueDate = new Date(dueDate).toISOString();
    } else {
      validDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    // 1. Concurrency / Duplicate check
    try {
      const dupCheck = await pool.query(
        `SELECT id, status, type, requested_at AS "requestedAt", resource_title AS "resourceTitle", isbn
         FROM transactions
         WHERE (
           (student_id IS NOT NULL AND student_id != '' AND LOWER(student_id) = LOWER($1))
           OR (student_name IS NOT NULL AND student_name != '' AND LOWER(student_name) = LOWER($2))
         )
         AND (
           (isbn IS NOT NULL AND isbn != '' AND isbn != 'N/A' AND isbn = $3)
           OR (resource_title IS NOT NULL AND resource_title != '' AND LOWER(resource_title) = LOWER($4))
         )
         AND status = 'Pending'
         ORDER BY requested_at DESC
         LIMIT 1`,
        [studentId, studentName, finalIsbn, finalTitle]
      );

      if (dupCheck.rows.length > 0) {
        const existingTx = dupCheck.rows[0];
        return NextResponse.json(
          {
            message: `A pending reservation for "${existingTx.resourceTitle || finalTitle}" already exists for your account.`,
            transaction: existingTx,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
    } catch (dupErr) {
      console.warn("[Reserve API] Duplicate check warning:", dupErr);
    }

    // 2. Insert reservation transaction
    const insertSql = `
      INSERT INTO transactions (
        user_id,
        student_name,
        student_id,
        resource_title,
        isbn,
        department,
        type,
        status,
        due_date,
        requested_at,
        student_id_image,
        created_at
      )
      VALUES (
        (SELECT id FROM users WHERE LOWER(id_number) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1),
        $2,
        $1,
        $3,
        $4,
        $5,
        'Reservation',
        'Pending',
        $6,
        NOW(),
        $7,
        NOW()
      )
      RETURNING
        id,
        user_id AS "userId",
        student_name AS "studentName",
        student_id AS "studentId",
        resource_title AS "resourceTitle",
        isbn,
        department,
        type,
        status,
        requested_at AS "requestedAt",
        due_date AS "dueDate",
        student_id_image AS "studentIdImage",
        created_at AS "createdAt"
    `;

    const { rows } = await pool.query(insertSql, [
      studentId,
      studentName || "Student Borrower",
      finalTitle,
      finalIsbn,
      finalDept,
      validDueDate,
      studentIdImage,
    ]);

    const transaction = rows[0];

    // Log activity
    try {
      await pool.query(
        `INSERT INTO activity_logs (id, title, type, user_name, created_at)
         VALUES (gen_random_uuid(), $1, 'info', $2, NOW())`,
        [`Reservation request submitted for '${finalTitle}'`, studentName || studentId]
      );
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      {
        message: "Reservation request submitted.",
        transaction,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Reserve API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to submit reservation request." },
      { status: 500, headers: corsHeaders }
    );
  }
}
