import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { store } from "@/lib/data/store";
import { hasExplicitDatabaseUrl, pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (hasExplicitDatabaseUrl) {
    try {
      const res = await pool.query(
        `SELECT id, actor, action, target, module, detail, created_at AS "timestamp"
         FROM history_logs
         ORDER BY created_at DESC
         LIMIT 100`
      );
      if (res.rows.length > 0) {
        return NextResponse.json({
          logs: res.rows,
          history: res.rows,
          total: res.rows.length,
        });
      }
    } catch (pgError) {
      console.warn("Direct DB history query failed:", pgError);
    }
  }

  if (!hasExplicitDatabaseUrl) {
    try {
      const proxyRes = await proxyToBackend("/api/admin/history", request);
      if (proxyRes.ok) {
        return proxyRes;
      }
    } catch (err) {
      console.warn("Proxy to /api/admin/history failed:", err);
    }
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const mod = searchParams.get("module") ?? "All";
  const logs = store.listHistory(search, mod as any);
  return NextResponse.json({
    logs,
    history: logs,
    total: logs.length,
  });
}
