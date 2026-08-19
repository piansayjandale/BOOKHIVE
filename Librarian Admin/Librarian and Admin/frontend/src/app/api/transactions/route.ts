import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { store } from "@/lib/data/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/transactions", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/transactions failed, using fallback:", err);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "All";
    const type = searchParams.get("type") ?? "All";

    const transactions = store.listTransactions(search, status, type);
    return NextResponse.json({ transactions });
  } catch (fallbackError) {
    console.error("Transactions list fallback error:", fallbackError);
    return NextResponse.json({ transactions: [] });
  }
}

export async function POST(request: Request) {
  return proxyToBackend("/api/admin/transactions", request);
}
