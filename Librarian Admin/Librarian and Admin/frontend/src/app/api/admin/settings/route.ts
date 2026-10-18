import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";

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

  const data = await adminRepository.getSettings();
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  return proxyToBackend("/api/admin/settings", request);
}
