import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { transactionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "All";
  const type = searchParams.get("type") ?? "All";
  return NextResponse.json({ transactions: store.listTransactions(search, status, type) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = transactionSchema.parse(await request.json());
    const transaction = store.addTransaction(payload, session);
    return NextResponse.json({ transaction }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid transaction payload." }, { status: 400 });
  }
}
