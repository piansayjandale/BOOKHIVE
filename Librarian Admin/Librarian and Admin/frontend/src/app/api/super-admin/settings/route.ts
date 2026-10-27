import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function loadSuperAdminSettings() {
  const latestEasApk = "https://expo.dev/artifacts/eas/xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8.apk";
  try {
    const res = await pool.query("SELECT * FROM system_settings WHERE id = 1");
    const settings = res.rows[0] || {};
    const syncLogs = await pool
      .query("SELECT * FROM institutional_sync_logs ORDER BY synced_at DESC LIMIT 5")
      .catch(() => ({ rows: [] }));

    const isStaleApk =
      !settings.latest_apk_url ||
      settings.latest_apk_url.includes("XFgckz2TnI1Z76BNl4QKdN6GqdBxBMw0p7wHXKXVla8") ||
      settings.latest_apk_url.includes("mH97U3T7g48Yn3KFtIHH0Uyal0bzBl5MWx5iu39M_uI") ||
      settings.latest_apk_url.includes("m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ") ||
      settings.latest_apk_url.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") ||
      settings.latest_apk_url.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") ||
      settings.latest_apk_url.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU");
    const isStaleVersion =
      !settings.min_app_version ||
      ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5"].includes(String(settings.min_app_version).trim());

    return {
      settings: {
        theme: settings.theme || "dark",
        borrowLimit: Number(settings.borrow_limit || 5),
        borrowDurationDays: Number(settings.borrow_duration_days || 7),
        storageUsedPercent: Number(settings.storage_used_percent || 24),
        indexingStatus: settings.indexing_status || "Healthy",
        aiEngine: settings.ai_engine || "BookHive AI",
        notificationsEnabled: settings.notifications_enabled ?? true,
        emailNotifications: settings.email_notifications ?? true,
        allowAdminTransactionControl: settings.allow_admin_transaction_control ?? false,
        aiStrictMode: settings.ai_strict_mode ?? true,
        isMaintenanceMode: Boolean(settings.is_maintenance_mode ?? false),
        maintenanceTitle: settings.maintenance_title || "System Maintenance & Update",
        maintenanceMessage:
          settings.maintenance_message ||
          "BookHive is currently undergoing scheduled maintenance and updates. Services are temporarily paused.",
        maintenanceUntil: settings.maintenance_until || null,
        minAppVersion: isStaleVersion ? "1.0.6" : settings.min_app_version,
        latestApkUrl: isStaleApk ? latestEasApk : settings.latest_apk_url,
      },
      institutionalSync: {
        provider: "STI WNU Active Directory & Academic Ecosystem",
        autoSyncSchedule: "Daily at 02:00 AM PHT",
        lastSyncLogs: syncLogs.rows || [],
      },
    };
  } catch {
    return {
      settings: {
        theme: "dark",
        borrowLimit: 5,
        borrowDurationDays: 7,
        storageUsedPercent: 24,
        indexingStatus: "Healthy",
        aiEngine: "BookHive AI",
        notificationsEnabled: true,
        emailNotifications: true,
        allowAdminTransactionControl: true,
        aiStrictMode: true,
        isMaintenanceMode: false,
        maintenanceTitle: "System Maintenance & Update",
        maintenanceMessage:
          "BookHive is currently undergoing scheduled maintenance and updates. Services are temporarily paused.",
        maintenanceUntil: null,
        minAppVersion: "1.0.6",
        latestApkUrl: latestEasApk,
      },
      institutionalSync: {
        provider: "STI WNU Active Directory & Academic Ecosystem",
        autoSyncSchedule: "Daily at 02:00 AM PHT",
        lastSyncLogs: [],
      },
    };
  }
}

export async function GET(request: Request) {
  const proxyRes = await proxyToBackend("/api/super-admin/settings", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  const data = await loadSuperAdminSettings();
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend("/api/super-admin/settings", request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const data = rawBody ? JSON.parse(rawBody) : {};
    const fields: string[] = [];
    const values: any[] = [];

    if (data.borrowLimit !== undefined) {
      values.push(Number(data.borrowLimit));
      fields.push(`borrow_limit = $${values.length}`);
    }
    if (data.borrowDurationDays !== undefined) {
      values.push(Number(data.borrowDurationDays));
      fields.push(`borrow_duration_days = $${values.length}`);
    }
    if (data.aiStrictMode !== undefined) {
      values.push(Boolean(data.aiStrictMode));
      fields.push(`ai_strict_mode = $${values.length}`);
    }
    if (data.allowAdminTransactionControl !== undefined) {
      values.push(Boolean(data.allowAdminTransactionControl));
      fields.push(`allow_admin_transaction_control = $${values.length}`);
    }
    if (data.notificationsEnabled !== undefined) {
      values.push(Boolean(data.notificationsEnabled));
      fields.push(`notifications_enabled = $${values.length}`);
    }
    if (data.isMaintenanceMode !== undefined) {
      values.push(Boolean(data.isMaintenanceMode));
      fields.push(`is_maintenance_mode = $${values.length}`);
    }
    if (data.maintenanceTitle !== undefined) {
      values.push(String(data.maintenanceTitle).trim());
      fields.push(`maintenance_title = $${values.length}`);
    }
    if (data.maintenanceMessage !== undefined) {
      values.push(String(data.maintenanceMessage).trim());
      fields.push(`maintenance_message = $${values.length}`);
    }
    if (data.maintenanceUntil !== undefined) {
      values.push(data.maintenanceUntil ? new Date(data.maintenanceUntil) : null);
      fields.push(`maintenance_until = $${values.length}`);
    }
    if (data.minAppVersion !== undefined) {
      values.push(String(data.minAppVersion).trim());
      fields.push(`min_app_version = $${values.length}`);
    }
    if (data.latestApkUrl !== undefined) {
      values.push(String(data.latestApkUrl).trim());
      fields.push(`latest_apk_url = $${values.length}`);
    }

    if (fields.length > 0) {
      await pool.query(`UPDATE system_settings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = 1`, values);
    }

    const session = await getSession().catch(() => null);
    const actor = session?.name || "Super Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Updated Global Settings', 'System Configuration', 'Settings', 'Updated global platform parameters and environment constants.')`,
        [`Super Admin ${actor}`]
      );
    } catch {}

    const updated = await loadSuperAdminSettings();
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Direct DB superAdmin updateSettings error:", err);
    return NextResponse.json({ message: "Failed to update global settings." }, { status: 500 });
  }
}
