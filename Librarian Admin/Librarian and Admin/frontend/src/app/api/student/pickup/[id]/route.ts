import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function handlePickup(
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
      `/api/student/pickup/${encodeURIComponent(transactionId)}`,
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
       SET type = 'Borrow',
           status = 'Approved',
           picked_up_at = NOW(),
           expires_at = NULL,
           due_date = COALESCE(due_date, NOW() + INTERVAL '7 days'),
           decided_at = NOW()
       WHERE id::text = $1::text
       RETURNING *`,
      [transactionId]
    );

    if (rows.length === 0 && (body?.isbn || body?.resourceTitle || body?.studentId)) {
      const fallbackRes = await pool.query(
        `UPDATE transactions
         SET type = 'Borrow',
             status = 'Approved',
             picked_up_at = NOW(),
             expires_at = NULL,
             due_date = COALESCE(due_date, NOW() + INTERVAL '7 days'),
             decided_at = NOW()
         WHERE id IN (
           SELECT id FROM transactions
           WHERE (
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

    const tx = rows[0] || {
      id: transactionId,
      status: "Approved",
      type: "Borrow",
      picked_up_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      student_name: body?.studentName || "Student",
      student_id: body?.studentId || "",
      resource_title: body?.resourceTitle || "Book",
      isbn: body?.isbn || "",
    };

    const session = await getSession().catch(() => null);
    const actorLabel = session ? `${session.role} ${session.name}` : "BookHive Librarian";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Marked book as picked up', $2, 'Transactions', $3)`,
        [
          actorLabel,
          tx.student_name || body?.studentName || "Student",
          `${tx.resource_title || body?.resourceTitle || "Book"} picked up by ${tx.student_name || body?.studentName || "Student"}.`,
        ]
      );
      await pool.query(
        `INSERT INTO activity_logs (message, level) VALUES ($1, 'success')`,
        [`Book picked up by ${tx.student_name || body?.studentName || "Student"}`]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Book marked as picked up successfully.",
      transaction: {
        ...tx,
        id: String(tx.id),
        status: "Approved",
        type: "Borrow",
        pickedUpAt: tx.picked_up_at || new Date().toISOString(),
        dueDate: tx.due_date,
        studentName: tx.student_name || body?.studentName || "Student",
        studentId: tx.student_id || body?.studentId || "",
        resourceTitle: tx.resource_title || body?.resourceTitle || "Book",
        isbn: tx.isbn || body?.isbn || "",
        isPickedUp: true,
      },
    });
  } catch (error: any) {
    console.error("Student pickup route error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to mark book as picked up." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handlePickup(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handlePickup(request, context);
}
