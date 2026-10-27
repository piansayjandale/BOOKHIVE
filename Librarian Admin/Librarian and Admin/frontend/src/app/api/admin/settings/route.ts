import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/settings", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/settings failed, using fallback:", err);
  }

  try {
    const res = await pool.query("SELECT * FROM system_settings WHERE id = 1 LIMIT 1");
    if (res.rows[0]) {
      const s = res.rows[0];
      return NextResponse.json({
        theme: s.theme || "dark",
        borrowLimit: Number(s.borrow_limit || 5),
        borrowDurationDays: Number(s.borrow_duration_days || 7),
        storageUsedPercent: Number(s.storage_used_percent || 24),
        indexingStatus: s.indexing_status || "Healthy",
        aiEngine: s.ai_engine || "BookHive AI",
        notificationsEnabled: s.notifications_enabled ?? true,
        emailNotifications: s.email_notifications ?? true,
        allowAdminTransactionControl: s.allow_admin_transaction_control ?? false,
        aiStrictMode: s.ai_strict_mode ?? true,
      });
    }
  } catch {}

  const data = await adminRepository.getSettings();
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend("/api/admin/settings", request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const fields: string[] = [];
    const values: any[] = [];

    if (body.theme !== undefined) {
      values.push(String(body.theme));
      fields.push(`theme = $${values.length}`);
    }
    if (body.borrowLimit !== undefined) {
      values.push(Number(body.borrowLimit));
      fields.push(`borrow_limit = $${values.length}`);
    }
    if (body.borrowDurationDays !== undefined) {
      values.push(Number(body.borrowDurationDays));
      fields.push(`borrow_duration_days = $${values.length}`);
    }
    if (body.storageUsedPercent !== undefined) {
      values.push(Number(body.storageUsedPercent));
      fields.push(`storage_used_percent = $${values.length}`);
    }
    if (body.indexingStatus !== undefined) {
      values.push(String(body.indexingStatus));
      fields.push(`indexing_status = $${values.length}`);
    }
    if (body.aiEngine !== undefined) {
      values.push(String(body.aiEngine));
      fields.push(`ai_engine = $${values.length}`);
    }
    if (body.notificationsEnabled !== undefined) {
      values.push(Boolean(body.notificationsEnabled));
      fields.push(`notifications_enabled = $${values.length}`);
    }
    if (body.emailNotifications !== undefined) {
      values.push(Boolean(body.emailNotifications));
      fields.push(`email_notifications = $${values.length}`);
    }
    if (body.allowAdminTransactionControl !== undefined) {
      values.push(Boolean(body.allowAdminTransactionControl));
      fields.push(`allow_admin_transaction_control = $${values.length}`);
    }
    if (body.aiStrictMode !== undefined) {
      values.push(Boolean(body.aiStrictMode));
      fields.push(`ai_strict_mode = $${values.length}`);
    }

    if (fields.length > 0) {
      await pool.query(`UPDATE system_settings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = 1`, values);
    }

    const session = await getSession().catch(() => null);
    const actorName = session ? `${session.role} ${session.name}` : "BookHive Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Updated settings', 'System Preferences', 'Settings', 'Borrow limits and platform defaults were synchronized.')`,
        [actorName]
      );
    } catch {}

    const res = await pool.query("SELECT * FROM system_settings WHERE id = 1 LIMIT 1");
    if (res.rows[0]) {
      const s = res.rows[0];
      return NextResponse.json({
        theme: s.theme || "dark",
        borrowLimit: Number(s.borrow_limit || 5),
        borrowDurationDays: Number(s.borrow_duration_days || 7),
        storageUsedPercent: Number(s.storage_used_percent || 24),
        indexingStatus: s.indexing_status || "Healthy",
        aiEngine: s.ai_engine || "BookHive AI",
        notificationsEnabled: s.notifications_enabled ?? true,
        emailNotifications: s.email_notifications ?? true,
        allowAdminTransactionControl: s.allow_admin_transaction_control ?? false,
        aiStrictMode: s.ai_strict_mode ?? true,
      });
    }

    const updated = await adminRepository.updateSettings(body, session);
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Direct DB updateSettings error:", err);
    return NextResponse.json({ message: "Failed to update settings." }, { status: 500 });
  }
}
