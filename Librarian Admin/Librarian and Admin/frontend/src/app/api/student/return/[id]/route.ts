import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function handleReturn(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const transactionId = decodeURIComponent(id || "").trim();

  let rawBodyText = "";
  let body: any = {};
  try {
    rawBodyText = await request.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      body = JSON.parse(rawBodyText);
    }
  } catch {
    // ignore empty body
  }

  // 1. Try proxying to Express backend
  try {
    const proxyRes = await proxyToBackend(
      `/api/student/return/${encodeURIComponent(transactionId)}`,
      request,
      rawBodyText
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback to direct DB
  }

  try {
    let { rows } = await pool.query(
      `UPDATE transactions
       SET status = 'Returned',
           decided_at = NOW(),
           comment = COALESCE($2, comment, 'Returned via Librarian Scanner')
       WHERE id::text = $1::text
       RETURNING *`,
      [transactionId, body?.comment || null]
    );

    if (rows.length === 0 && (body?.isbn || body?.resourceTitle || body?.studentId)) {
      const fallbackRes = await pool.query(
        `UPDATE transactions
         SET status = 'Returned',
             decided_at = NOW()
         WHERE id IN (
           SELECT id FROM transactions
           WHERE status::text IN ('Approved', 'Pending')
             AND (
               ($1::text != '' AND $1::text != 'N/A' AND isbn = $1::text)
               OR ($2::text != '' AND LOWER(resource_title) = LOWER($2::text))
             )
             AND ($3::text = '' OR LOWER(student_id) = LOWER($3::text))
           ORDER BY requested_at DESC
           LIMIT 1
         )
         RETURNING *`,
        [body?.isbn || "", body?.resourceTitle || "", body?.studentId || ""]
      );
      rows = fallbackRes.rows;
    }

    if (rows.length === 0) {
      return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
    }

    const tx = rows[0];

    // Sync book availability
    try {
      await pool.query(
        `UPDATE books b
         SET availability = CASE
           WHEN (
             COALESCE(b.copies, 1) - (
               SELECT COUNT(*) FROM transactions sub_t
               WHERE (sub_t.isbn = b.isbn OR LOWER(sub_t.resource_title) = LOWER(b.title))
                 AND sub_t.type::text = 'Borrow' AND sub_t.status::text IN ('Approved', 'Pending')
             )
           ) > 0 THEN 'Available'
           ELSE 'Unavailable'
         END,
         updated_at = NOW()
         WHERE (b.isbn IS NOT NULL AND b.isbn != '' AND b.isbn != 'N/A' AND b.isbn = $1)
            OR LOWER(b.title) = LOWER($2)`,
        [tx.isbn || "", tx.resource_title || ""]
      );
    } catch {
      // non-fatal
    }

    // Promote next waitlisted reservation if any
    let promotedTransaction: any = null;
    try {
      const promoRes = await pool.query(
        `SELECT id, user_id AS "userId", student_name AS "studentName", student_id AS "studentId",
                resource_title AS "resourceTitle", isbn, department
         FROM transactions
         WHERE LOWER(type::text) = 'reservation'
           AND LOWER(status::text) IN ('approved', 'pending', 'reserved')
           AND picked_up_at IS NULL
           AND (
             ($1::text != '' AND $1::text != 'N/A' AND isbn = $1::text)
             OR ($2::text != '' AND LOWER(TRIM(COALESCE(resource_title, ''))) = LOWER(TRIM($2::text)))
           )
         ORDER BY requested_at ASC
         LIMIT 1`,
        [tx.isbn || "", tx.resource_title || ""]
      );

      if (promoRes.rows.length > 0) {
        const nextInLine = promoRes.rows[0];
        const updatePromo = await pool.query(
          `UPDATE transactions
           SET type = 'Borrow',
               status = 'Approved',
               requested_at = NOW(),
               due_date = NOW() + INTERVAL '7 days',
               available_at = NOW(),
               expires_at = NOW() + INTERVAL '24 hours',
               picked_up_at = NULL,
               decided_at = NOW(),
               comment = 'Automatically converted from reservation to active borrow upon previous copy return. 24-hour pickup window started.'
           WHERE id::text = $1::text
           RETURNING *`,
          [String(nextInLine.id)]
        );
        if (updatePromo.rows.length > 0) {
          promotedTransaction = updatePromo.rows[0];
        }
      }
    } catch {
      // non-fatal
    }

    const session = await getSession().catch(() => null);
    const actorLabel = session ? `${session.role} ${session.name}` : "BookHive Librarian";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Returned transaction', $2, 'Transactions', $3)`,
        [
          actorLabel,
          tx.student_name || "Student",
          `${tx.resource_title || "Book"} returned by ${tx.student_name || "Student"}.`,
        ]
      );
      await pool.query(
        `INSERT INTO activity_logs (message, level) VALUES ($1, 'success')`,
        [`${tx.student_name || "Student"} returned '${tx.resource_title || "Book"}'`]
      );
    } catch {}

    return NextResponse.json({
      message: "Book returned successfully.",
      transaction: {
        ...tx,
        id: String(tx.id),
        studentName: tx.student_name,
        studentId: tx.student_id,
        resourceTitle: tx.resource_title,
        status: "Returned",
      },
      promotedTransaction,
      ok: true,
    });
  } catch (error: any) {
    console.error("Student return route error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to return book." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleReturn(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleReturn(request, context);
}
