import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxyRes = await proxyToBackend("/api/super-admin/pruning/accounts", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const countRes = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE status = 'Suspended' OR status = 'Archived'");
    const count = Number(countRes.rows[0]?.count || 0);
    await pool.query("DELETE FROM users WHERE status = 'Suspended' OR status = 'Archived'");

    const session = await getSession().catch(() => null);
    const actor = session?.name || "Super Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Purged Deactivated Accounts', $2, 'System Management', $3)`,
        [
          `Super Admin ${actor}`,
          `${count} accounts`,
          `Permanently purged ${count} deactivated / suspended accounts from the database.`,
        ]
      );
    } catch {}

    return NextResponse.json({ purgedCount: count, entity: "Deactivated Accounts" });
  } catch (err: any) {
    console.error("Direct DB purgeDeactivatedAccounts error:", err);
    return NextResponse.json({ purgedCount: 0, entity: "Deactivated Accounts", error: err?.message }, { status: 500 });
  }
}
