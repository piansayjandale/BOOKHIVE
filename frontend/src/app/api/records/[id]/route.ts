import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { bookSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = bookSchema.partial().parse(await request.json());
    const { id } = await context.params;
    const book = await store.updateBook(id, payload, session);

    if (!book) {
      return NextResponse.json({ message: "Book not found." }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch {
    return NextResponse.json({ message: "Invalid update payload." }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const deleted = await store.deleteBook(id, session);

  if (!deleted) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
