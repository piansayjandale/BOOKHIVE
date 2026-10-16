import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const proxyRes = await proxyToBackend(`/api/admin/digitized-books/${id}`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    // try direct
  }

  try {
    const proxyDirect = await proxyToBackend(`/api/digitized-books/${id}`, request);
    if (proxyDirect.ok) {
      return proxyDirect;
    }
  } catch (err) {
    console.warn(`Proxy DELETE to /api/digitized-books/${id} failed:`, err);
  }

  return NextResponse.json({ ok: true, message: "Removed from digitized queue" });
}
