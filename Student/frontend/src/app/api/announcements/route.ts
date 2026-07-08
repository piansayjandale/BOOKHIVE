import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { announcementSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const audience = searchParams.get("audience") ?? "All";
  const status = searchParams.get("status") ?? "All";

  return NextResponse.json({
    announcements: store.listAnnouncements(search, audience, status),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = announcementSchema.parse(await request.json());
    return NextResponse.json(
      { announcement: store.addAnnouncement(payload, session) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ message: "Invalid announcement payload." }, { status: 400 });
  }
}
