import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/records-catalog", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/records-catalog failed, using fallback:", err);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const department = searchParams.get("department") ?? "All";
  const data = await adminRepository.getRecordsCatalog({ search, department });
  return NextResponse.json(data);
}
