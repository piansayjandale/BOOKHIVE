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

    // 1. Borrow limit policy check
    try {
      const sRes = await pool.query(
        "SELECT borrow_limit FROM system_settings WHERE id = 1 LIMIT 1"
      );
      const bLimit = Number(sRes.rows[0]?.borrow_limit || 5);

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS "activeCount"
         FROM transactions
         WHERE (
           (student_id IS NOT NULL AND student_id != '' AND LOWER(student_id) = LOWER($1))
           OR (student_name IS NOT NULL AND student_name != '' AND LOWER(student_name) = LOWER($2))
         )
         AND type = 'Borrow'
         AND status::text NOT IN ('Returned', 'Declined', 'Cancelled', 'Rejected')`,
        [studentId, studentName]
      );
      const activeCount = Number(countRes.rows[0]?.activeCount || 0);

      if (activeCount >= bLimit) {
        return NextResponse.json(
          {
            message: `Borrow limit reached. You currently have ${activeCount} active book loans/requests (maximum allowed: ${bLimit}). Please return a book to the library before borrowing another.`,
            limitReached: true,
            code: "BORROW_LIMIT_REACHED",
          },
          { status: 400, headers: corsHeaders }
        );
      }

      // Check overdue loans
      const overdueRes = await pool.query(
        `SELECT COUNT(*)::int AS "overdueCount"
         FROM transactions
         WHERE (
           (student_id IS NOT NULL AND student_id != '' AND LOWER(student_id) = LOWER($1))
           OR (student_name IS NOT NULL AND student_name != '' AND LOWER(student_name) = LOWER($2))
         )
         AND type = 'Borrow'
         AND status::text NOT IN ('Returned', 'Declined', 'Cancelled', 'Rejected')
         AND due_date IS NOT NULL
         AND due_date < NOW()`,
        [studentId, studentName]
      );
      const overdueCount = Number(overdueRes.rows[0]?.overdueCount || 0);
      if (overdueCount > 0) {
        return NextResponse.json(
          {
            message: `Overdue return required. You have ${overdueCount} book loan(s) that are past their due date. Please return them to the library before borrowing additional books.`,
            code: "OVERDUE_RETURN_REQUIRED",
          },
          { status: 400, headers: corsHeaders }
        );
      }
    } catch (policyErr) {
      console.warn("[Borrow API] Policy check warning:", policyErr);
    }

    // 2. Concurrency / Duplicate check
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
            message: `A pending request for "${existingTx.resourceTitle || finalTitle}" already exists for your account.`,
            transaction: existingTx,
            isDuplicate: true,
          },
          { status: 200, headers: corsHeaders }
        );
      }
    } catch (dupErr) {
      console.warn("[Borrow API] Duplicate check warning:", dupErr);
    }

    // 3. Insert transaction
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
        'Borrow',
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
        [`Borrow request submitted for '${finalTitle}'`, studentName || studentId]
      );
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      {
        message: "Borrow request submitted.",
        transaction,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Borrow API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to submit borrow request." },
      { status: 500, headers: corsHeaders }
    );
  }
}
