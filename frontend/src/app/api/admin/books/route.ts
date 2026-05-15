import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { adminBookFormSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const department = searchParams.get("department") ?? "All";
  const category = searchParams.get("category") ?? "All";
  const status = searchParams.get("status") ?? "All";
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");

  const payload = await adminRepository.listBooks({ search, department, category, status, page, pageSize });
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const session = await getSession();

  try {
    const payload = adminBookFormSchema.parse(await request.json());
    return NextResponse.json(
      { book: adminRepository.createBook(payload, session) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: "Invalid book payload." }, { status: 400 });
  }
}
