import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { store } from "@/lib/data/store";
import { hasExplicitDatabaseUrl, pool } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const mod = searchParams.get("module") ?? "All";
  const limit = Math.max(1, Math.min(2000, parseInt(searchParams.get("limit") ?? "1000", 10)));
  const session = await getSession();
  const actorParam = searchParams.get("actor")?.trim() || session?.name || "";

  if (hasExplicitDatabaseUrl) {
    try {
      const filters: any[] = [];
      const whereClauses: string[] = [];
      
      let actorWhereHistory = "";
      let actorWhereSearch = "";

      if (actorParam) {
        const parts = actorParam.split(/\s+/).filter(p => p.length > 2 && !p.includes("."));
        const surname = parts[parts.length - 1];
        if (surname && surname.toLowerCase() !== actorParam.toLowerCase()) {
          whereClauses.push(`(lower(actor) LIKE $${filters.length + 1} OR lower(actor) LIKE $${filters.length + 2})`);
          filters.push(`%${actorParam.toLowerCase()}%`, `%${surname.toLowerCase()}%`);
          const safeActor = actorParam.toLowerCase().replace(/'/g, "''");
          const safeSurname = surname.toLowerCase().replace(/'/g, "''");
          actorWhereHistory = `WHERE (lower(actor) LIKE '%${safeActor}%' OR lower(actor) LIKE '%${safeSurname}%')`;
          actorWhereSearch = `WHERE (lower(actor_name) LIKE '%${safeActor}%' OR lower(actor_name) LIKE '%${safeSurname}%')`;
        } else {
          whereClauses.push(`lower(actor) LIKE $${filters.length + 1}`);
          filters.push(`%${actorParam.toLowerCase()}%`);
          const safeActor = actorParam.toLowerCase().replace(/'/g, "''");
          actorWhereHistory = `WHERE lower(actor) LIKE '%${safeActor}%'`;
          actorWhereSearch = `WHERE lower(actor_name) LIKE '%${safeActor}%'`;
        }
      }

      if (mod !== "All") {
        if (mod === "Pickups Only" || mod === "Pickups" || mod === "Pick Up") {
          whereClauses.push(`(lower(module) LIKE '%pick%' OR lower(action) LIKE '%pick%' OR lower(detail) LIKE '%pick%')`);
        } else if (mod === "Transactions") {
          filters.push("Transactions");
          whereClauses.push(`module = $${filters.length} AND NOT (lower(action) LIKE '%pick%' OR lower(detail) LIKE '%pick%')`);
        } else if (mod === "Records") {
          filters.push("Records");
          whereClauses.push(`module = $${filters.length}`);
        } else {
          filters.push(mod);
          whereClauses.push(`module = $${filters.length}`);
        }
      }

      if (search) {
        filters.push(`%${search.toLowerCase()}%`);
        const searchIdx = filters.length;
        whereClauses.push(`(
          lower(actor) LIKE $${searchIdx}
          OR lower(action) LIKE $${searchIdx}
          OR lower(target) LIKE $${searchIdx}
          OR lower(detail) LIKE $${searchIdx}
        )`);
      }

      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

      filters.push(limit);
      const limitIdx = filters.length;

      const histAnd = actorWhereHistory ? `${actorWhereHistory} AND` : "WHERE";
      const searchAnd = actorWhereSearch ? `${actorWhereSearch} AND` : "WHERE";

      const [
        res,
        totalLogsRes,
        catalogEventsRes,
        txTableRes,
        txPickupsRes,
        histPickupsRes,
        histTxRes,
        searchLogsRes,
        filterSearchRes,
        aiSearchRes,
      ] = await Promise.all([
        pool.query(
          `SELECT id, actor, action, target, module, detail, created_at AS "timestamp"
           FROM history_logs
           ${whereClause}
           ORDER BY created_at DESC
           LIMIT $${limitIdx}`,
          filters
        ),
        pool.query(`SELECT COUNT(*)::int as c FROM history_logs ${actorWhereHistory}`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM history_logs ${histAnd} module = 'Records'`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM history_logs ${histAnd} module = 'Transactions' AND NOT (lower(action) LIKE '%pick%' OR lower(detail) LIKE '%pick%')`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM history_logs ${histAnd} (lower(module) LIKE '%pick%' OR lower(action) LIKE '%pick%' OR lower(detail) LIKE '%pick%')`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM history_logs ${histAnd} (lower(module) LIKE '%pick%' OR lower(action) LIKE '%pick%' OR lower(detail) LIKE '%pick%')`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM history_logs ${histAnd} module = 'Transactions' AND NOT (lower(action) LIKE '%pick%' OR lower(detail) LIKE '%pick%')`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM ai_search_logs ${actorWhereSearch}`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM ai_search_logs ${searchAnd} (mode = 'filter' OR mode = 'prefix')`).catch(() => ({ rows: [{ c: 0 }] })),
        pool.query(`SELECT COUNT(*)::int as c FROM ai_search_logs ${searchAnd} (mode = 'ai' OR mode IS NULL)`).catch(() => ({ rows: [{ c: 0 }] })),
      ]);

      const counts = {
        total: totalLogsRes.rows[0]?.c ?? res.rows.length,
        records: catalogEventsRes.rows[0]?.c ?? 0,
        transactions: txTableRes.rows[0]?.c ?? 0,
        pickups: txPickupsRes.rows[0]?.c ?? 0,
        historyPickups: histPickupsRes.rows[0]?.c ?? 0,
        historyTransactions: histTxRes.rows[0]?.c ?? 0,
        search: searchLogsRes.rows[0]?.c ?? 0,
        filterSearches: filterSearchRes.rows[0]?.c ?? 0,
        aiSearches: aiSearchRes.rows[0]?.c ?? 0,
      };

      return NextResponse.json({
        logs: res.rows,
        history: res.rows,
        total: res.rows.length,
        counts,
      });
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

  const logs = store.listHistory(search, mod as any);
  return NextResponse.json({
    logs,
    history: logs,
    total: logs.length,
    counts: {
      total: logs.length,
      records: logs.filter(l => l.module === "Records").length,
      transactions: logs.filter(l => l.module === "Transactions").length,
      pickups: logs.filter(l => (l.action || "").toLowerCase().includes("pick") || (l.detail || "").toLowerCase().includes("pick")).length,
      search: 0,
      filterSearches: 0,
      aiSearches: 0,
    }
  });
}
