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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend(`/api/admin/announcements/${id}`, request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const updates = rawBody ? JSON.parse(rawBody) : {};
    let durationDays: number | null | undefined =
      updates.durationDays !== undefined
        ? updates.durationDays
          ? parseInt(String(updates.durationDays), 10)
          : null
        : undefined;

    let expiresAt: string | null | undefined = undefined;
    if (durationDays !== undefined) {
      if (durationDays && !isNaN(durationDays) && durationDays > 0) {
        expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      } else {
        durationDays = null;
        expiresAt = null;
      }
    }

    const { rows } = await pool.query(
      `UPDATE announcements
       SET
         title = COALESCE($2, title),
         content = COALESCE($3, content),
         audience = COALESCE($4, audience),
         priority = COALESCE($5, priority),
         published = COALESCE($6, published),
         author = COALESCE($7, author),
         duration_days = CASE WHEN $8::boolean THEN $9::int ELSE duration_days END,
         expires_at = CASE WHEN $8::boolean THEN $10::timestamptz ELSE expires_at END,
         updated_at = NOW()
       WHERE id::text = $1::text
       RETURNING *`,
      [
        id,
        updates.title ?? null,
        updates.content ?? null,
        updates.audience ?? null,
        updates.priority ?? null,
        updates.published ?? null,
        updates.author ?? null,
        durationDays !== undefined,
        durationDays ?? null,
        expiresAt ?? null,
      ]
    );

    if (!rows[0]) {
      return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
    }

    const announcement = mapAnnouncementRow(rows[0]);
    const session = await getSession().catch(() => null);
    const actorLabel = session ? `${session.role} ${session.name}` : "BookHive Admin";

    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, $2, $3, 'Announcements', $4)`,
        [
          actorLabel,
          announcement.published ? "Published announcement" : "Updated announcement",
          announcement.title,
          `${announcement.audience} audience with ${announcement.priority.toLowerCase()} priority.`,
        ]
      );
    } catch {}

    return NextResponse.json({ announcement });
  } catch (err: any) {
    console.error("Direct DB updateAnnouncement error:", err);
    return NextResponse.json({ message: err?.message || "Failed to update announcement." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const proxyRes = await proxyToBackend(`/api/admin/announcements/${id}`, request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const existingRes = await pool.query("SELECT * FROM announcements WHERE id::text = $1::text", [id]);
    const existing = existingRes.rows[0];
    const delRes = await pool.query("DELETE FROM announcements WHERE id::text = $1::text", [id]);
    if (delRes.rowCount === 0) {
      return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
    }

    const session = await getSession().catch(() => null);
    const actorLabel = session ? `${session.role} ${session.name}` : "BookHive Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Deleted announcement', $2, 'Announcements', 'Notice removed from the active publishing queue.')`,
        [actorLabel, existing?.title || id]
      );
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Direct DB deleteAnnouncement error:", err);
    return NextResponse.json({ message: err?.message || "Failed to delete announcement." }, { status: 500 });
  }
}
