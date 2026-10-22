import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const proxyRes = await proxyToBackend(`/api/admin/users/${id}`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy update user ${id} failed, using repository:`, err);
  }

  try {
    const body = await request.json();
    const user = await adminRepository.updateUser(id, body);
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ user, success: true });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to update user." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const proxyRes = await proxyToBackend(`/api/admin/users/${id}`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy delete user ${id} failed, using repository:`, err);
  }

  try {
    const ok = await adminRepository.deleteUser(id);
    return NextResponse.json({ ok, success: true });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message || "Failed to archive user." }, { status: 500 });
  }
}
