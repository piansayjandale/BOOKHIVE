import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: any = null;
  try {
    const cloned = request.clone();
    body = await cloned.json();
  } catch {
    // Body parsing error
  }

  // 1. Try proxying to Express backend admin endpoint /api/admin/transactions/:id
  try {
    const proxyRes = await proxyToBackend(`/api/admin/transactions/${id}`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy to /api/admin/transactions/${id} failed, trying /api/transactions/${id}:`, err);
  }

  // 2. Try proxying to Express backend direct endpoint /api/transactions/:id
  try {
    const proxyRes = await proxyToBackend(`/api/transactions/${id}`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy to /api/transactions/${id} failed, using direct DB update fallback:`, err);
  }

  // 3. Resilient Direct PostgreSQL Fallback
  try {
    const session = await getSession();
    const nextStatus = body?.status ?? "Approved";
    const comment = body?.comment ?? null;
    const isUuid = Boolean(
      session?.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(session.id))
    );
    const validDecidedBy = isUuid ? session?.id : null;

    const query = `
      UPDATE transactions
      SET
        status = $2,
        decided_by = $3,
        decided_at = NOW(),
        comment = COALESCE($4, comment)
      WHERE id::text = $1::text
      RETURNING *
    `;

    const { rows } = await pool.query(query, [id, nextStatus, validDecidedBy, comment]);
    if (rows.length > 0) {
      const tx = rows[0];
      let promotedTx: any = null;

      if (nextStatus === "Returned" || nextStatus === "Declined") {
        try {
          const promoRes = await pool.query(
            `
            SELECT 
              id, 
              user_id AS "userId", 
              student_name AS "studentName", 
              student_id AS "studentId", 
              resource_title AS "resourceTitle", 
              isbn, 
              department
            FROM transactions
            WHERE LOWER(type::text) = 'reservation'
              AND LOWER(status::text) IN ('approved', 'approved reservation', 'reserved')
              AND (
                ($1::text != '' AND $1::text != 'N/A' AND (isbn = $1::text OR REPLACE(COALESCE(isbn, ''), '-', '') = REPLACE($1::text, '-', '')))
                OR ($2::text != '' AND LOWER(TRIM(COALESCE(resource_title, ''))) = LOWER(TRIM($2::text)))
              )
            ORDER BY requested_at ASC
            LIMIT 1
            `,
            [tx.isbn || "", tx.resource_title || ""]
          );

          if (promoRes.rows.length > 0) {
            const nextInLine = promoRes.rows[0];
            const updatePromoRes = await pool.query(
              `
              UPDATE transactions
              SET
                type = 'Borrow',
                status = 'Approved',
                requested_at = NOW(),
                due_date = NOW() + INTERVAL '7 days',
                available_at = NOW(),
                expires_at = NOW() + INTERVAL '24 hours',
                picked_up_at = NULL,
                decided_at = NOW(),
                comment = 'Automatically converted from reservation to active borrow upon previous copy return. 24-hour pickup window started.'
              WHERE id::text = $1::text
              RETURNING *
              `,
              [String(nextInLine.id)]
            );

            if (updatePromoRes.rows.length > 0) {
              const p = updatePromoRes.rows[0];
              promotedTx = {
                id: String(p.id),
                studentName: p.student_name || nextInLine.studentName || "Student Borrower",
                studentId: p.student_id || nextInLine.studentId || "N/A",
                resourceTitle: p.resource_title || nextInLine.resourceTitle || "Book",
                isbn: p.isbn || nextInLine.isbn || "N/A",
                department: p.department || nextInLine.department || "Circulation",
                type: "Borrow",
                status: "Approved",
                requestedAt: p.requested_at,
                dueDate: p.due_date,
                availableAt: p.available_at,
                expiresAt: p.expires_at,
                pickedUpAt: null,
                isPickedUp: false,
                comment: p.comment,
              };
            }
          }
        } catch (promoErr) {
          console.warn("Direct DB admin promote reservation error:", promoErr);
        }
      }

      return NextResponse.json({ transaction: tx, promotedTransaction: promotedTx, ok: true });
    }
    return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  } catch (dbError) {
    console.error("Direct DB admin transaction PATCH error:", dbError);
    return NextResponse.json({ message: "Failed to update transaction status." }, { status: 500 });
  }
}
