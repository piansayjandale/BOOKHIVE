import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

function inferActivityType(moduleName = "", action = ""): "Auth" | "AI" | "Transaction" | "Book" | "User" | "System" {
  const m = String(moduleName || "").toLowerCase();
  const a = String(action || "").toLowerCase();
  if (m.includes("auth") || a.includes("login") || a.includes("password")) return "Auth";
  if (m.includes("search") || a.includes("search")) return "AI";
  if (m.includes("transaction") || a.includes("borrow") || a.includes("return") || a.includes("reserv") || a.includes("pick")) return "Transaction";
  if (m.includes("record") || m.includes("book") || a.includes("book")) return "Book";
  if (m.includes("user") || m.includes("account") || m.includes("profile") || a.includes("account") || a.includes("user")) return "User";
  return "System";
}

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/monitoring", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/monitoring failed, using fallback:", err);
  }

  const { searchParams } = new URL(request.url);
  const actor = searchParams.get("actor") ?? undefined;
  const activityType = searchParams.get("activityType") ?? undefined;
  const from = searchParams.get("from") ?? undefined;

  try {
    const [histRes, aiRes, authRes] = await Promise.all([
      pool
        .query(
          `SELECT id::text AS id, actor, action, target, module, detail, created_at AS timestamp
           FROM history_logs
           ORDER BY created_at DESC
           LIMIT 120`
        )
        .catch(() => ({ rows: [] })),
      pool
        .query(
          `SELECT id::text AS id, actor_name AS actor, prompt, matches_found, created_at AS timestamp
           FROM ai_search_logs
           ORDER BY created_at DESC
           LIMIT 60`
        )
        .catch(() => ({ rows: [] })),
      pool
        .query(
          `SELECT id::text AS id, actor, message, severity, created_at AS timestamp
           FROM auth_logs
           ORDER BY created_at DESC
           LIMIT 60`
        )
        .catch(() => ({ rows: [] })),
    ]);

    const combined: any[] = [];
    for (const h of histRes.rows) {
      const actType = inferActivityType(h.module, h.action);
      const actLower = String(h.action || "").toLowerCase();
      combined.push({
        id: `hist-${h.id}`,
        actor: h.actor || "System",
        activityType: actType,
        message: `${h.action}: ${h.target}${h.detail ? ` — ${h.detail}` : ""}`,
        severity: actLower.includes("delete") || actLower.includes("decline") || actLower.includes("purge") ? "warning" : "success",
        timestamp: h.timestamp ? new Date(h.timestamp).toISOString() : new Date().toISOString(),
      });
    }
    for (const s of aiRes.rows) {
      combined.push({
        id: `ai-${s.id}`,
        actor: s.actor || "Student",
        activityType: "AI",
        message: `Prompt search for "${s.prompt}" with ${Number(s.matches_found || 0)} matches`,
        severity: "info",
        timestamp: s.timestamp ? new Date(s.timestamp).toISOString() : new Date().toISOString(),
      });
    }
    for (const a of authRes.rows) {
      combined.push({
        id: `auth-${a.id}`,
        actor: a.actor || "User",
        activityType: "Auth",
        message: a.message || "Authentication event",
        severity: a.severity || "info",
        timestamp: a.timestamp ? new Date(a.timestamp).toISOString() : new Date().toISOString(),
      });
    }

    combined.sort((l, r) => new Date(r.timestamp).getTime() - new Date(l.timestamp).getTime());

    const filtered = combined.filter((entry) => {
      const matchesActor = !actor || actor === "All" || entry.actor.toLowerCase().includes(actor.toLowerCase());
      const matchesType = !activityType || activityType === "All" || entry.activityType === activityType;
      const matchesDate = !from || entry.timestamp >= from;
      return matchesActor && matchesType && matchesDate;
    });

    if (filtered.length > 0 || combined.length > 0) {
      return NextResponse.json({
        logs: filtered,
        totals: {
          authEvents: filtered.filter((e) => e.activityType === "Auth").length,
          aiEvents: filtered.filter((e) => e.activityType === "AI").length,
          transactionEvents: filtered.filter((e) => e.activityType === "Transaction").length,
          userEvents: filtered.filter((e) => e.activityType === "User").length,
        },
      });
    }
  } catch (dbErr) {
    console.warn("Direct DB monitoring query fallback notice:", dbErr);
  }

  const data = await adminRepository.getMonitoring({ actor, activityType, from });
  return NextResponse.json(data);
}
