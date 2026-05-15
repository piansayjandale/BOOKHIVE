import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { adminUserFormSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "All";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  return NextResponse.json(await adminRepository.listUsers({ search, role, page, pageSize }));
}

export async function POST(request: Request) {
  const session = await getSession();

  try {
    const payload = adminUserFormSchema.parse(await request.json());
    return NextResponse.json(await adminRepository.createUser(payload, session), { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid user payload." }, { status: 400 });
  }
}
