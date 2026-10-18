import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { store } from "@/lib/data/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/history", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/history failed:", err);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const mod = searchParams.get("module") ?? "All";
  const logs = store.listHistory(search, mod as any);
  return NextResponse.json({
    logs,
    history: logs,
    total: logs.length,
  });
}
