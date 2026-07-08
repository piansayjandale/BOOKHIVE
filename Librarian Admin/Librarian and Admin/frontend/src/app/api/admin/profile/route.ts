import { NextResponse } from "next/server";

import { proxyToBackend } from "@/lib/proxy";
import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyToBackend("/api/admin/profile", request);
}

export async function PATCH(request: Request) {
  const res = await proxyToBackend("/api/admin/profile", request);
  if (res.status === 200) {
    try {
      const profile = await res.json();
      const response = NextResponse.json(profile);
      response.cookies.set(
        SESSION_COOKIE,
        await createSessionToken({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          avatar: profile.avatar,
        }),
        getSessionCookieOptions(),
      );
      return response;
    } catch (err) {
      console.error("Failed to parse and update profile session:", err);
    }
  }
  return res;
}
