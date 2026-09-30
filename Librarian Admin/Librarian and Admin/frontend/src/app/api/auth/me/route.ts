import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSessionToken, getSession, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { pool } from "@/lib/db";
import { BACKEND_URL } from "@/lib/config";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  // 1. Fetch fresh profile/permissions directly from PostgreSQL
  try {
    const { rows } = await pool.query(
      "SELECT id, permissions FROM users WHERE id = $1 OR email = $2 LIMIT 1",
      [session.id, session.email]
    );

    if (rows && rows.length > 0 && rows[0].permissions) {
      const updatedUser = {
        ...session,
        id: rows[0].id,
        permissions: rows[0].permissions,
      };
      const response = NextResponse.json({ user: updatedUser });
      response.cookies.set(
        SESSION_COOKIE,
        await createSessionToken(updatedUser),
        getSessionCookieOptions()
      );
      return response;
    }
  } catch (err) {
    console.warn("Direct DB query for session permissions failed:", err);
  }

  // 2. Attempt fallback to Express backend
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    const res = await fetch(`${BACKEND_URL}/api/admin/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const profile = await res.json();
      if (profile.permissions) {
        const updatedUser = {
          ...session,
          permissions: profile.permissions,
        };
        const response = NextResponse.json({ user: updatedUser });
        response.cookies.set(
          SESSION_COOKIE,
          await createSessionToken(updatedUser),
          getSessionCookieOptions()
        );
        return response;
      }
    }
  } catch (err) {
    // Fall back to session if backend request fails
  }

  return NextResponse.json({ user: session });
}
