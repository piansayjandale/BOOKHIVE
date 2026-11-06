import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSessionToken, getSession, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { pool } from "@/lib/db";
import { BACKEND_URL } from "@/lib/config";
import type { SessionUser, Role } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetId = url.searchParams.get("userId") || request.headers.get("x-bookhive-user-id");
  const targetEmail = url.searchParams.get("email") || request.headers.get("x-bookhive-user-email");

  const session = await getSession();

  let queryId = targetId || session?.id;
  let queryEmail = targetEmail || session?.email;

  if (!queryId && !queryEmail) {
    if (!session) {
      return NextResponse.json({ user: null });
    }
    queryId = session.id;
    queryEmail = session.email;
  }

  // 1. Fetch fresh profile/permissions directly from PostgreSQL for the target user
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, sub_role AS "subRole", department, course, permissions, avatar
       FROM users
       WHERE id::text = $1::text OR LOWER(email) = LOWER($2)
       LIMIT 1`,
      [queryId || "", queryEmail || ""]
    );

    if (rows && rows.length > 0) {
      const dbUser = rows[0];
      const fallbackSubRole =
        dbUser.subRole ||
        (dbUser.role === "Librarian"
          ? dbUser.name?.includes("Jan Dale")
            ? "Circulation Librarian"
            : "Technical Librarian"
          : undefined);

      const updatedUser: SessionUser = {
        id: String(dbUser.id),
        name: dbUser.name || session?.name || "Librarian",
        email: dbUser.email || session?.email || "",
        role: (dbUser.role || session?.role || "Librarian") as Role,
        subRole: fallbackSubRole,
        permissions: dbUser.permissions || {},
        avatar: dbUser.avatar || session?.avatar || (dbUser.name ? dbUser.name.charAt(0).toUpperCase() : "L"),
      };

      const response = NextResponse.json({ user: updatedUser });

      // Only refresh the session cookie if this target matches the actual cookie holder
      if (session && (String(session.id) === String(updatedUser.id) || session.email?.toLowerCase() === updatedUser.email?.toLowerCase())) {
        response.cookies.set(
          SESSION_COOKIE,
          await createSessionToken(updatedUser),
          getSessionCookieOptions()
        );
      }
      return response;
    }
  } catch (err) {
    console.warn("Direct DB query for session permissions failed:", err);
  }

  // 2. Attempt fallback to Express backend
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get("bookhive_backend_token")?.value ||
      cookieStore.get(SESSION_COOKIE)?.value;

    const res = await fetch(`${BACKEND_URL}/api/admin/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      const profile = await res.json();
      if (profile.permissions && session) {
        const updatedUser: SessionUser = {
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

  if (session) {
    return NextResponse.json({ user: session });
  }

  return NextResponse.json({ user: null });
}
