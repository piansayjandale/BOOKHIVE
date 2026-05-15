import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { settingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ settings: store.getSettings() });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = settingsSchema.partial().parse(await request.json());
    return NextResponse.json({ settings: store.updateSettings(payload, session) });
  } catch {
    return NextResponse.json({ message: "Invalid settings payload." }, { status: 400 });
  }
}
