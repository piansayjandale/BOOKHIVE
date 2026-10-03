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
      return NextResponse.json({ transaction: rows[0], ok: true });
    }
    return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
  } catch (dbError) {
    console.error("Direct DB admin transaction PATCH error:", dbError);
    return NextResponse.json({ message: "Failed to update transaction status." }, { status: 500 });
  }
}
