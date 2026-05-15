import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { adminBookFormSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/admin/books/[id]">) {
  const session = await getSession();
  const { id } = await context.params;

  try {
    const rawPayload = (await request.json()) as Record<string, unknown>;
    if (rawPayload.archive === true) {
      const archived = adminRepository.archiveBook(id);
      if (!archived) {
        return NextResponse.json({ message: "Book not found." }, { status: 404 });
      }

      return NextResponse.json({ book: archived });
    }

    const payload = adminBookFormSchema.partial().parse(rawPayload);
    const book = adminRepository.updateBook(id, payload, session);
    if (!book) {
      return NextResponse.json({ message: "Book not found." }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch {
    return NextResponse.json({ message: "Invalid book payload." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/books/[id]">) {
  const session = await getSession();
  const { id } = await context.params;
  const deleted = adminRepository.deleteBook(id, session);

  if (!deleted) {
    return NextResponse.json({ message: "Book not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
