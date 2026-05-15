import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { userSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "All";
  return NextResponse.json({ users: store.listUsers(search, role) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = userSchema.parse(await request.json());
    return NextResponse.json({ user: store.addUser(payload, session) }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Invalid user payload." }, { status: 400 });
  }
}
