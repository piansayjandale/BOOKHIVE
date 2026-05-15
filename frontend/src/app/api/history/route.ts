import { NextResponse } from "next/server";

import { store } from "@/lib/data/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const moduleName = searchParams.get("module") ?? "All";
  return NextResponse.json({ history: store.listHistory(search, moduleName) });
}
