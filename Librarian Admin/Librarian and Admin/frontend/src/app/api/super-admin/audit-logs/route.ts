import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxyRes = await proxyToBackend("/api/super-admin/audit-logs", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const actor = searchParams.get("actor") ?? "All";
    const moduleName = searchParams.get("module") ?? "All";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10));

    const filters: any[] = [];
    const where: string[] = [];

    if (actor && actor !== "All") {
      filters.push(`%${actor.toLowerCase()}%`);
      where.push(`LOWER(actor) LIKE $${filters.length}`);
    }

    if (moduleName && moduleName !== "All") {
      filters.push(moduleName);
      where.push(`module = $${filters.length}`);
    }

    if (search) {
      filters.push(`%${search.toLowerCase()}%`);
      const idx = filters.length;
      where.push(
        `(LOWER(action) LIKE $${idx} OR LOWER(target) LIKE $${idx} OR LOWER(detail) LIKE $${idx} OR LOWER(actor) LIKE $${idx})`
      );
    }

    if (from) {
      const fromVal = from.includes(" ") || from.includes("T") ? from : `${from} 00:00:00`;
      filters.push(fromVal);
      where.push(`created_at >= $${filters.length}`);
    }
    if (to) {
      const toVal = to.includes(" ") || to.includes("T") ? to : `${to} 23:59:59.999`;
      filters.push(toVal);
      where.push(`created_at <= $${filters.length}`);
    }

    const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM history_logs ${whereClause}`, filters);
    const total = Number(countRes.rows[0]?.count || 0);

    const offset = (page - 1) * pageSize;
    filters.push(pageSize, offset);

    const { rows } = await pool.query(
      `SELECT
         id::text AS id,
         actor,
         action,
         target,
         module,
         detail,
         created_at AS "createdAt"
       FROM history_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${filters.length - 1} OFFSET $${filters.length}`,
      filters
    );

    return NextResponse.json({ logs: rows, total, page, pageSize });
  } catch (err) {
    console.warn("Direct DB audit-logs fallback error:", err);
    return NextResponse.json({ logs: [], total: 0, page: 1, pageSize: 20 });
  }
}
