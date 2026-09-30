import { NextResponse } from "next/server";
import { ALL_SYSTEM_GENRES } from "@/lib/catalog/call-number";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ genres: ALL_SYSTEM_GENRES });
}
