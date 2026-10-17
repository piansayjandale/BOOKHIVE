import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { store } from "@/lib/data/store";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let rawBodyText = "";
  let body: any = null;
  try {
    rawBodyText = await request.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      body = JSON.parse(rawBodyText);
    }
  } catch {
    // Body parsing error
  }

  // 1. Try proxying to Express backend direct endpoint /api/transactions/:id
  try {
    const proxyRes = await proxyToBackend(`/api/transactions/${id}`, request, rawBodyText);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy to /api/transactions/${id} failed, trying /api/admin/transactions/${id}:`, err);
  }

  // 2. Try proxying to Express backend admin endpoint /api/admin/transactions/:id
  try {
    const proxyRes = await proxyToBackend(`/api/admin/transactions/${id}`, request, rawBodyText);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy to /api/admin/transactions/${id} failed, using direct DB update fallback:`, err);
  }

  // 3. Resilient Direct PostgreSQL Fallback
  try {
    const session = await getSession();
    const nextStatus = body?.status ?? "Approved";
    const nextType = body?.type;
    const comment = body?.comment ?? null;
    const isUuid = Boolean(
      session?.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(session.id))
    );
    const validDecidedBy = isUuid ? session?.id : null;

    let query: string;
    let params: any[];

    if (body?.action === "pickup" || body?.pickedUp === true || body?.status === "Picked Up") {
      query = `
        UPDATE transactions
        SET
          picked_up_at = NOW(),
          expires_at = NULL,
          due_date = NOW() + INTERVAL '7 days',
          decided_by = COALESCE($2, decided_by),
          decided_at = NOW()
        WHERE id::text = $1::text
        RETURNING *
      `;
      params = [id, validDecidedBy];
    } else if (nextType === "Borrow" || nextStatus === "Approved") {
      let shouldConvertToBorrow = nextType === "Borrow";
      let isReservationTarget = body?.type === "Reservation";

      if (nextStatus === "Approved" && !shouldConvertToBorrow) {
        try {
          const { rows: targetRows } = await pool.query(
            `SELECT id, type, isbn, resource_title, requested_at FROM transactions WHERE id::text = $1::text LIMIT 1`,
            [id]
          );
          const targetTx = targetRows[0];
          if (targetTx && targetTx.type === "Reservation") {
            isReservationTarget = true;
            const { rows: availRows } = await pool.query(
              `SELECT
                 COALESCE((
                   SELECT copies FROM books b
                   WHERE ($1::text IS NOT NULL AND $1::text != '' AND $1::text != 'N/A' AND b.isbn = $1::text)
                      OR ($2::text IS NOT NULL AND LOWER(b.title) = LOWER($2::text))
                   ORDER BY (CASE WHEN $1::text IS NOT NULL AND $1::text != '' AND $1::text != 'N/A' AND b.isbn = $1::text THEN 0 ELSE 1 END)
                   LIMIT 1
                 ), 1)::int AS "totalCopies",
                 COUNT(CASE WHEN sub_t.type = 'Borrow' AND sub_t.status IN ('Approved', 'Pending') THEN 1 END)::int AS "activeBorrows",
                 COUNT(CASE WHEN sub_t.type = 'Reservation' AND sub_t.status = 'Approved' AND sub_t.id::text != $3::text AND sub_t.requested_at < COALESCE($4::timestamptz, NOW()) THEN 1 END)::int AS "approvedAhead"
               FROM transactions sub_t
               WHERE (
                 ($1::text IS NOT NULL AND $1::text != '' AND $1::text != 'N/A' AND sub_t.isbn = $1::text)
                 OR ($2::text IS NOT NULL AND LOWER(sub_t.resource_title) = LOWER($2::text))
               )`,
              [targetTx.isbn || "", targetTx.resource_title || "", String(targetTx.id), targetTx.requested_at || null]
            );
            const totalCopies = Number(availRows[0]?.totalCopies ?? 1);
            const activeBorrows = Number(availRows[0]?.activeBorrows ?? 0);
            const approvedAhead = Number(availRows[0]?.approvedAhead ?? 0);
            const netAvailable = Math.max(0, totalCopies - activeBorrows);
            if (netAvailable > approvedAhead) {
              shouldConvertToBorrow = true;
            }
          }
        } catch {
          // ignore lookup error
        }
      }

      if (isReservationTarget && !shouldConvertToBorrow) {
        query = `
          UPDATE transactions
          SET
            status = $2,
            due_date = COALESCE(due_date, NOW() + INTERVAL '7 days'),
            decided_by = $3,
            decided_at = NOW(),
            comment = COALESCE($4, comment)
          WHERE id::text = $1::text
          RETURNING *
        `;
        params = [id, nextStatus, validDecidedBy, comment];
      } else {
        query = `
          UPDATE transactions
          SET
            ${shouldConvertToBorrow ? "type = 'Borrow'," : ""}
            status = $2,
            requested_at = NOW(),
            due_date = COALESCE(due_date, NOW() + INTERVAL '7 days'),
            decided_by = $3,
            decided_at = NOW(),
            available_at = COALESCE(available_at, NOW()),
            expires_at = CASE WHEN picked_up_at IS NOT NULL THEN NULL ELSE COALESCE(expires_at, NOW() + INTERVAL '24 hours') END,
            picked_up_at = CASE WHEN picked_up_at IS NOT NULL THEN picked_up_at ELSE NULL END,
            comment = COALESCE($4, comment)
          WHERE id::text = $1::text
          RETURNING *
        `;
        params = [id, nextStatus, validDecidedBy, comment];
      }
    } else {
      query = `
        UPDATE transactions
        SET
          status = $2,
          decided_by = $3,
          decided_at = NOW(),
          comment = COALESCE($4, comment)
        WHERE id::text = $1::text
        RETURNING *
      `;
      params = [id, nextStatus, validDecidedBy, comment];
    }

    let { rows } = await pool.query(query, params);

    // If ID was not matched directly (e.g. temporary client ID or desynced socket ID),
    // recover by matching record by book and student details
    if (rows.length === 0 && (body?.isbn || body?.resourceTitle || body?.studentId || body?.studentName)) {
      const isPickupAction = body?.action === "pickup" || body?.pickedUp === true || body?.status === "Picked Up";
      let fallbackQuery = "";
      let fallbackParams: any[] = [];

      if (isPickupAction) {
        fallbackQuery = `
          UPDATE transactions
          SET
            type = 'Borrow',
            status = 'Approved',
            picked_up_at = NOW(),
            expires_at = NULL,
            due_date = NOW() + INTERVAL '7 days',
            decided_by = COALESCE($1, decided_by),
            decided_at = NOW()
          WHERE id IN (
            SELECT id FROM transactions
            WHERE (
              ($2::text != '' AND $2::text != 'N/A' AND isbn = $2::text)
              OR ($3::text != '' AND LOWER(resource_title) = LOWER($3::text))
            )
            AND (
              ($4::text != '' AND LOWER(student_id) = LOWER($4::text))
              OR ($5::text != '' AND LOWER(student_name) = LOWER($5::text))
            )
            ORDER BY requested_at DESC
            LIMIT 1
          )
          RETURNING *
        `;
        fallbackParams = [
          validDecidedBy,
          body?.isbn || "",
          body?.resourceTitle || "",
          body?.studentId || "",
          body?.studentName || "",
        ];
      } else {
        fallbackQuery = `
          UPDATE transactions
          SET
            status = $1,
            due_date = COALESCE(due_date, NOW() + INTERVAL '7 days'),
            decided_by = $2,
            decided_at = NOW(),
            available_at = COALESCE(available_at, NOW()),
            expires_at = CASE WHEN picked_up_at IS NOT NULL THEN NULL ELSE COALESCE(expires_at, NOW() + INTERVAL '24 hours') END,
            picked_up_at = CASE WHEN picked_up_at IS NOT NULL THEN picked_up_at ELSE NULL END,
            comment = COALESCE($3, comment)
          WHERE id IN (
            SELECT id FROM transactions
            WHERE (
              ($4::text != '' AND $4::text != 'N/A' AND isbn = $4::text)
              OR ($5::text != '' AND LOWER(resource_title) = LOWER($5::text))
            )
            AND (
              ($6::text != '' AND LOWER(student_id) = LOWER($6::text))
              OR ($7::text != '' AND LOWER(student_name) = LOWER($7::text))
            )
            ORDER BY requested_at DESC
            LIMIT 1
          )
          RETURNING *
        `;
        fallbackParams = [
          nextStatus,
          validDecidedBy,
          comment,
          body?.isbn || "",
          body?.resourceTitle || "",
          body?.studentId || "",
          body?.studentName || "",
        ];
      }
      const fallbackRes = await pool.query(fallbackQuery, fallbackParams);
      rows = fallbackRes.rows;
    }

    if (rows.length > 0) {
      const tx = rows[0];
      try {
        const bookIdent = tx.isbn || tx.resource_title;
        if (bookIdent) {
          await pool.query(`
            UPDATE books b
            SET availability = CASE
              WHEN (
                COALESCE(b.copies, 1) - (
                  SELECT COUNT(*) FROM transactions sub_t
                  WHERE (sub_t.isbn = b.isbn OR LOWER(sub_t.resource_title) = LOWER(b.title))
                    AND sub_t.type = 'Borrow' AND sub_t.status IN ('Approved', 'Pending')
                )
              ) > 0 THEN 'Available'
              ELSE 'Unavailable'
            END,
            updated_at = NOW()
            WHERE (b.isbn IS NOT NULL AND b.isbn != '' AND b.isbn != 'N/A' AND b.isbn = $1)
               OR LOWER(b.title) = LOWER($2)
          `, [tx.isbn || "", tx.resource_title || ""]);
        }
      } catch (syncErr) {
        console.warn("Direct DB availability sync error:", syncErr);
      }
      return NextResponse.json({ transaction: rows[0], ok: true });
    }

    // Secondary in-memory store fallback
    try {
      const memoryTx = store.updateTransactionStatus(id, nextStatus as any);
      if (memoryTx) {
        return NextResponse.json({ transaction: memoryTx, ok: true });
      }
    } catch {}

    return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  } catch (dbError) {
    console.error("Direct DB transaction PATCH error:", dbError);
    return NextResponse.json({ message: "Failed to update transaction status." }, { status: 500 });
  }
}
