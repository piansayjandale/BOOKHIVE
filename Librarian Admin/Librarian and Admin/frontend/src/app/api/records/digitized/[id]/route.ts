import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const proxyRes = await proxyToBackend(
      `/api/admin/digitized-books/${id}`,
      request
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback to direct DB
  }

  try {
    await pool.query(
      "DELETE FROM digitized_books WHERE id::text = $1::text",
      [id]
    );
  } catch (err) {
    console.warn("Direct DB DELETE digitized_books error:", err);
  }

  return NextResponse.json({ ok: true, message: "Removed from digitized queue" });
}
