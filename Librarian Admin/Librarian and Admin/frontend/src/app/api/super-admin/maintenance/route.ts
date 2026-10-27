import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function loadMaintenanceState() {
  const latestEasApk = "https://expo.dev/artifacts/eas/xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8.apk";
  try {
    const res = await pool.query("SELECT * FROM system_settings WHERE id = 1");
    const s = res.rows[0] || {};
    let inMaintenance = Boolean(s.is_maintenance_mode);
    const until = s.maintenance_until ? new Date(s.maintenance_until).toISOString() : null;
    let remainingSeconds = 0;

    if (until) {
      const diffMs = new Date(until).getTime() - Date.now();
      if (diffMs > 0) {
        remainingSeconds = Math.max(0, Math.round(diffMs / 1000));
      } else if (inMaintenance) {
        inMaintenance = false;
        await pool.query("UPDATE system_settings SET is_maintenance_mode = FALSE, updated_at = NOW() WHERE id = 1").catch(() => {});
      }
    }

    const isStaleApk =
      !s.latest_apk_url ||
      s.latest_apk_url.includes("XFgckz2TnI1Z76BNl4QKdN6GqdBxBMw0p7wHXKXVla8") ||
      s.latest_apk_url.includes("mH97U3T7g48Yn3KFtIHH0Uyal0bzBl5MWx5iu39M_uI") ||
      s.latest_apk_url.includes("m90mnPT1hrznA0zP1xdm95K-P6ZMwCNdlYIbZ6kO-uQ") ||
      s.latest_apk_url.includes("wq4OYzJNpymhY6ysiXCuUri2xPkuZwsavxKd1eAqaoQ") ||
      s.latest_apk_url.includes("u0IuSm_N5wixAJ9iBDJMwuQbe4aKO4HzZfYAjYao-dU") ||
      s.latest_apk_url.includes("9vqmAP6x6yMOIC_o6J9CLqo8sKcXd0rOtUXxAa7M5UU");
    const isStaleVersion =
      !s.min_app_version ||
      ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.0.4", "1.0.5"].includes(String(s.min_app_version).trim());

    return {
      inMaintenance,
      title: s.maintenance_title || "System Maintenance & Update",
      message:
        s.maintenance_message ||
        "BookHive is currently undergoing scheduled maintenance and updates. Services are temporarily paused.",
      until,
      remainingSeconds,
      minVersion: isStaleVersion ? "1.0.6" : s.min_app_version,
      latestApkUrl: isStaleApk ? latestEasApk : s.latest_apk_url,
    };
  } catch {
    return {
      inMaintenance: false,
      title: "System Maintenance & Update",
      message: "BookHive is currently undergoing scheduled maintenance and updates.",
      until: null,
      remainingSeconds: 0,
      minVersion: "1.0.6",
      latestApkUrl: latestEasApk,
    };
  }
}

async function handleMaintenanceUpdate(request: Request) {
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend("/api/super-admin/maintenance", request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { inMaintenance, title, message, durationHours, durationMinutes, until, minVersion, latestApkUrl } = body;
    let targetUntil: string | null = null;

    if (inMaintenance) {
      if (until) {
        targetUntil = new Date(until).toISOString();
      } else {
        const hrs = Number(durationHours) > 0 ? Number(durationHours) : 2;
        const mins = Number(durationMinutes) > 0 ? Number(durationMinutes) : 0;
        const totalMinutes = hrs * 60 + mins;
        targetUntil = new Date(Date.now() + totalMinutes * 60 * 1000).toISOString();
      }
    }

    const fields: string[] = ["is_maintenance_mode = $1"];
    const values: any[] = [Boolean(inMaintenance)];

    if (title !== undefined) {
      values.push(String(title).trim());
      fields.push(`maintenance_title = $${values.length}`);
    }
    if (message !== undefined) {
      values.push(String(message).trim());
      fields.push(`maintenance_message = $${values.length}`);
    }
    values.push(targetUntil ? new Date(targetUntil) : null);
    fields.push(`maintenance_until = $${values.length}`);

    if (minVersion !== undefined) {
      values.push(String(minVersion).trim());
      fields.push(`min_app_version = $${values.length}`);
    }
    if (latestApkUrl !== undefined) {
      values.push(String(latestApkUrl).trim());
      fields.push(`latest_apk_url = $${values.length}`);
    }

    await pool.query(`UPDATE system_settings SET ${fields.join(", ")}, updated_at = NOW() WHERE id = 1`, values);
    const state = await loadMaintenanceState();

    const session = await getSession().catch(() => null);
    const actor = session?.name || "Super Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, $2, 'System Infrastructure', 'Settings', $3)`,
        [
          `Super Admin ${actor}`,
          inMaintenance ? "Enabled Remote Maintenance Mode" : "Disabled Maintenance Mode",
          inMaintenance
            ? `Activated maintenance lock until ${targetUntil || "unspecified"}. Target app version: ${state.minVersion}.`
            : "Disabled maintenance mode. Mobile apps unlocked and normal operation resumed.",
        ]
      );
    } catch {}

    return NextResponse.json({ success: true, maintenance: state });
  } catch (err: any) {
    console.error("Direct DB updateMaintenance error:", err);
    return NextResponse.json({ message: "Failed to update maintenance state." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const proxyRes = await proxyToBackend("/api/super-admin/maintenance", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  const state = await loadMaintenanceState();
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  return handleMaintenanceUpdate(request);
}

export async function PATCH(request: Request) {
  return handleMaintenanceUpdate(request);
}
