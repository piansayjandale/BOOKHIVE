import { NextResponse } from "next/server";

import { store } from "@/lib/data/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await store.getReports());
}
