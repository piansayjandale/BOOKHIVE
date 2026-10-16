import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/announcements", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/announcements failed, using database fallback:", err);
  }

  // Fallback to database
  try {
    const { searchParams } = new URL(request.url);
    const audience = searchParams.get("audience") ?? "All";
    const status = searchParams.get("status") ?? "All";
    const search = searchParams.get("search")?.trim() ?? "";

    const filters: any[] = [];
    const whereClauses: string[] = [];

    if (audience !== "All") {
      filters.push(audience);
      whereClauses.push(`audience = $${filters.length}`);
    }

    if (status !== "All") {
      const isPublished = status === "Published";
      filters.push(isPublished);
      whereClauses.push(`published = $${filters.length}`);
    }

    if (search) {
      filters.push(`%${search.toLowerCase()}%`);
      const idx = filters.length;
      whereClauses.push(`(lower(title) LIKE $${idx} OR lower(content) LIKE $${idx})`);
    }

    const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
    const { rows } = await pool.query(
      `SELECT * FROM announcements ${whereClause} ORDER BY updated_at DESC`,
      filters
    );

    return NextResponse.json({ announcements: rows });
  } catch (dbErr) {
    console.warn("Direct DB announcements query fallback failed:", dbErr);
    return NextResponse.json({ announcements: [] });
  }
}

export async function POST(request: Request) {
  return proxyToBackend("/api/admin/announcements", request);
}
