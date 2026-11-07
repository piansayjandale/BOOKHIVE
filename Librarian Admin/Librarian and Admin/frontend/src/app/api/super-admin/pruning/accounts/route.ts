import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const proxyRes = await proxyToBackend("/api/super-admin/pruning/accounts", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const countRes = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE (status::text = 'Suspended' OR status::text = 'Archived') AND status::text != 'Purged' AND purged_at IS NULL");
    const count = Number(countRes.rows[0]?.count || 0);
    await pool.query("UPDATE users SET status = 'Purged', purged_at = NOW(), updated_at = NOW() WHERE (status::text = 'Suspended' OR status::text = 'Archived') AND status::text != 'Purged'");

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

    try {
      const repoUsers = await adminRepository.listUsers({ page: 1, pageSize: 1000 });
      if (repoUsers?.users) {
        for (const u of repoUsers.users) {
          if (u.status === "Suspended" || u.status === "Archived") {
            await adminRepository.deleteUser(u.id);
          }
        }
      }
    } catch {}

    return NextResponse.json({ purgedCount: count, entity: "Deactivated Accounts" });
  } catch (err: any) {
    console.error("Direct DB purgeDeactivatedAccounts error:", err);
    return NextResponse.json({ purgedCount: 0, entity: "Deactivated Accounts", error: err?.message }, { status: 500 });
  }
}
