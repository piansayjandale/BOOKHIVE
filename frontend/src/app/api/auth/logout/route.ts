import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (session) {
    await adminRepository.registerAuthEvent(session.name, "Signed out of BookHive", "info");
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
