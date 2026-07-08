import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const department = searchParams.get("department") ?? "All";

  return NextResponse.json(await adminRepository.getRecordsCatalog({ search, department }));
}
