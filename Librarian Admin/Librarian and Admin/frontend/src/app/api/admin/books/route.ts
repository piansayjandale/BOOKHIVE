import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/books", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/books failed, using repository fallback:", err);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const department = searchParams.get("department") ?? "All";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "60", 10);

    const data = await adminRepository.listBooks({ search, department, page, pageSize });
    return NextResponse.json(data);
  } catch (fallbackError) {
    console.error("Admin books list fallback error:", fallbackError);
    return NextResponse.json({ books: [], total: 0 });
  }
}

export async function POST(request: Request) {
  return proxyToBackend("/api/admin/books", request);
}
