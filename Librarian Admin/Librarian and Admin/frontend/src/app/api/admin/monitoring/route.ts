import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

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
  const data = await adminRepository.getMonitoring({ actor, activityType, from });
  return NextResponse.json(data);
}
