import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await adminRepository.getAnalytics());
}
