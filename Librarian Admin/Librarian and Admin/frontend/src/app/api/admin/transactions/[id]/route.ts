import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { store } from "@/lib/data/store";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: any = null;
  try {
    const cloned = request.clone();
    body = await cloned.json();
  } catch {
    // Body parsing error
  }

  try {
    const proxyRes = await proxyToBackend(`/api/admin/transactions/${id}`, request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn(`Proxy to /api/admin/transactions/${id} failed, using fallback:`, err);
  }

  try {
    const session = await getSession();
    const nextStatus = body?.status ?? "Approved";
    const result = store.updateTransactionStatus(id, nextStatus, session);
    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (fallbackErr) {
    console.error("Fallback PATCH error:", fallbackErr);
    return NextResponse.json({ message: "Failed to update transaction status." }, { status: 500 });
  }
}
