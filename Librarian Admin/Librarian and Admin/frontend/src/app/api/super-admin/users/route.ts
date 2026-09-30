import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/super-admin/users", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/super-admin/users failed, using database fallback:", err);
  }

  // Fallback: Query PostgreSQL directly
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role") ?? "All";
    const status = searchParams.get("status") ?? "All";
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10));
    const offset = (page - 1) * pageSize;

    const filters: any[] = [];
    const whereClauses: string[] = [];

    if (role !== "All") {
      filters.push(role);
      whereClauses.push(`role = $${filters.length}`);
    }

    if (status !== "All") {
      filters.push(status);
      whereClauses.push(`status = $${filters.length}`);
    }

    if (search) {
      filters.push(`%${search.toLowerCase()}%`);
      const idx = filters.length;
      whereClauses.push(`(
        lower(name) LIKE $${idx}
        OR lower(email) LIKE $${idx}
        OR lower(id_number) LIKE $${idx}
        OR lower(department) LIKE $${idx}
      )`);
    }

    const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

    const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM users ${whereClause}`, filters);
    const total = countRes.rows[0]?.total ?? 0;

    filters.push(pageSize, offset);
    const limitIdx = filters.length - 1;
    const offsetIdx = filters.length;

    const usersRes = await pool.query(
      `SELECT
        id,
        name,
        email,
        id_number AS "idNumber",
        role,
        department,
        course,
        year_level AS "yearLevel",
        section,
        status,
        permissions,
        qr_code AS "qrCode",
        last_active AS "lastActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      filters
    );

    return NextResponse.json({
      users: usersRes.rows,
      total,
      page,
      pageSize,
    });
  } catch (fallbackError) {
    console.error("Super Admin users fallback error:", fallbackError);
    return NextResponse.json({ users: [], total: 0, page: 1, pageSize: 10 });
  }
}

export async function POST(request: Request) {
  return proxyToBackend("/api/super-admin/users", request);
}
