import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import {
  createSessionToken,
  getSession,
  getSessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { adminProfileSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await adminRepository.getProfile(session.id);
  if (!profile) {
    return NextResponse.json({ message: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = adminProfileSchema.parse(await request.json());
    const profile = await adminRepository.updateProfile(session.id, payload);
    if (!profile) {
      return NextResponse.json({ message: "Profile not found." }, { status: 404 });
    }

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
  } catch {
    return NextResponse.json({ message: "Invalid profile payload." }, { status: 400 });
  }
}
