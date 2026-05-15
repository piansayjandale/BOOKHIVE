import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { bookSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const department = searchParams.get("department") ?? "All";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "120") || 120));
    const offset = (page - 1) * pageSize;
    const result = await store.listBooks(search, department, pageSize, offset);
    return NextResponse.json({
      books: result.books,
      total: result.total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Error loading records:", error);
    return NextResponse.json(
      { message: "Failed to load records." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = bookSchema.parse(await request.json());
    const book = await store.addBook(payload, session);
    return NextResponse.json({ book }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid book payload." }, { status: 400 });
  }
}
