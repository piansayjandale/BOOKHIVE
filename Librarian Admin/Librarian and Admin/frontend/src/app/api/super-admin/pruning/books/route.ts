import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxyRes = await proxyToBackend("/api/super-admin/pruning/books", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const countRes = await pool.query("SELECT COUNT(*)::int AS count FROM books WHERE archived_at IS NOT NULL");
    const count = Number(countRes.rows[0]?.count || 0);
    await pool.query("DELETE FROM books WHERE archived_at IS NOT NULL");

    const session = await getSession().catch(() => null);
    const actor = session?.name || "Super Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Purged Archived Books', $2, 'System Management', $3)`,
        [
          `Super Admin ${actor}`,
          `${count} books`,
          `Permanently purged ${count} archived books from the database.`,
        ]
      );
    } catch {}

    return NextResponse.json({ purgedCount: count, entity: "Archived Books" });
  } catch (err: any) {
    console.error("Direct DB purgeArchivedBooks error:", err);
    return NextResponse.json({ purgedCount: 0, entity: "Archived Books", error: err?.message }, { status: 500 });
  }
}
