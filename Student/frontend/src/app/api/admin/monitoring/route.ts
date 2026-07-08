import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const actor = searchParams.get("actor") ?? "All";
  const activityType = searchParams.get("activityType") ?? "All";
  const from = searchParams.get("from") ?? "";

  return NextResponse.json(await adminRepository.getMonitoring({ actor, activityType, from }));
}
