import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/users", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/users failed, using repository:", err);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "All";
  const status = searchParams.get("status") ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "100", 10)));
  const data = await adminRepository.listUsers({ search, role, status, page, pageSize });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/users", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/users failed, using repository:", err);
  }

  try {
    const body = await request.json();
    const result = await adminRepository.createUser(body);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to create user." }, { status: 500 });
  }
}
