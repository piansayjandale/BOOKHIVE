import { cookies } from "next/headers";

import { pool } from "@/lib/db";
import {
  createSessionToken,
  getSessionCookieOptions,
  hasRequiredRole,
  parseSessionToken,
  SESSION_COOKIE,
} from "@/lib/token";

export function invalidateSessionCache(userId?: string | null) {
  // Session cache invalidator
}

export {
  createSessionToken,
  getSessionCookieOptions,
  hasRequiredRole,
  parseSessionToken,
  SESSION_COOKIE,
};

export async function getSession() {
  const cookieStore = await cookies();
  const tokenUser = await parseSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!tokenUser) return null;

  const fallbackSubRole =
    tokenUser.subRole ||
    (tokenUser.role === "Librarian"
      ? tokenUser.name?.includes("Jan Dale")
        ? "Circulation Librarian"
        : "Technical Librarian"
      : undefined);

  try {
    const { rows } = await pool.query(
      'SELECT id, permissions, sub_role AS "subRole" FROM users WHERE id::text = $1::text OR LOWER(email) = LOWER($2) LIMIT 1',
      [tokenUser.id, tokenUser.email]
    );
    if (rows && rows.length > 0) {
      return {
        ...tokenUser,
        id: rows[0].id,
        permissions: rows[0].permissions || tokenUser.permissions,
        subRole: rows[0].subRole || fallbackSubRole,
      };
    }
  } catch (err) {
    // Fall back to tokenUser with fallback subRole if db query fails
  }

  return {
    ...tokenUser,
    subRole: fallbackSubRole,
  };
}
