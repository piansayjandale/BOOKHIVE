import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

function mapAnnouncementRow(row: any) {
  const expiresAt = row.expires_at ? new Date(row.expires_at).toISOString() : null;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    audience: row.audience || "All",
    priority: row.priority || "Normal",
    published: Boolean(row.published),
    author: row.author || "BookHive Admin",
    durationDays: row.duration_days !== null && row.duration_days !== undefined ? Number(row.duration_days) : null,
    expiresAt,
    isExpired,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/announcements", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/announcements failed, using database fallback:", err);
  }

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
      whereClauses.push(`(lower(title) LIKE $${idx} OR lower(content) LIKE $${idx} OR lower(author) LIKE $${idx})`);
    }

    const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
    const { rows } = await pool.query(
      `SELECT * FROM announcements ${whereClause} ORDER BY updated_at DESC`,
      filters
    );

    return NextResponse.json({ announcements: rows.map(mapAnnouncementRow) });
  } catch (dbErr) {
    console.warn("Direct DB announcements query fallback failed:", dbErr);
    return NextResponse.json({ announcements: [] });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend("/api/admin/announcements", request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    if (!body.title || !body.content) {
      return NextResponse.json({ message: "Title and content are required." }, { status: 400 });
    }

    const session = await getSession().catch(() => null);
    const authorName = body.author || session?.name || "BookHive Admin";
    const actorLabel = session ? `${session.role} ${session.name}` : `Admin ${authorName}`;

    let durationDays: number | null = body.durationDays ? parseInt(String(body.durationDays), 10) : null;
    if (durationDays !== null && (isNaN(durationDays) || durationDays <= 0)) {
      durationDays = null;
    }
    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;

    const { rows } = await pool.query(
      `INSERT INTO announcements (title, content, audience, priority, published, author, duration_days, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.title,
        body.content,
        body.audience || "All",
        body.priority || "Normal",
        body.published ?? false,
        authorName,
        durationDays,
        expiresAt,
      ]
    );

    const announcement = mapAnnouncementRow(rows[0]);

    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, $2, $3, 'Announcements', $4)`,
        [
          actorLabel,
          announcement.published ? "Published announcement" : "Created announcement",
          announcement.title,
          `${announcement.audience} audience with ${announcement.priority.toLowerCase()} priority.`,
        ]
      );
      await pool.query(
        `INSERT INTO activity_logs (message, level) VALUES ($1, $2)`,
        [
          `${announcement.published ? "Announcement published" : "Announcement drafted"}: ${announcement.title}`,
          announcement.priority === "Urgent" ? "warning" : "success",
        ]
      );
    } catch {}

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (err: any) {
    console.error("Direct DB addAnnouncement error:", err);
    return NextResponse.json({ message: err?.message || "Failed to create announcement." }, { status: 500 });
  }
}
