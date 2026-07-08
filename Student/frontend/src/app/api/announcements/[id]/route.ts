import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { announcementSchema } from "@/lib/validation";

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
    const payload = announcementSchema.partial().parse(await request.json());
    const { id } = await context.params;
    const announcement = store.updateAnnouncement(id, payload, session);

    if (!announcement) {
      return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
    }

    return NextResponse.json({ announcement });
  } catch {
    return NextResponse.json({ message: "Invalid announcement update." }, { status: 400 });
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
  const deleted = store.deleteAnnouncement(id, session);

  if (!deleted) {
    return NextResponse.json({ message: "Announcement not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
