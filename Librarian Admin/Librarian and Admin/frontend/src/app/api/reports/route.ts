import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { buildRichReports } from "@/lib/admin/reports-helper";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/reports", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/reports failed, using fallback:", err);
  }

  try {
    const reports = await buildRichReports();
    return NextResponse.json(reports);
  } catch (fallbackError) {
    console.error("Reports fallback error:", fallbackError);
    return NextResponse.json({ message: "Failed to load reports." }, { status: 500 });
  }
}
