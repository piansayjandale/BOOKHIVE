import { cookies } from "next/headers";

import { pool } from "@/lib/db";
import {
  createSessionToken,
  getSessionCookieOptions,
  hasRequiredRole,
  parseSessionToken,
  SESSION_COOKIE,
} from "@/lib/token";

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

  try {
    const { rows } = await pool.query(
      "SELECT id, permissions FROM users WHERE id = $1 OR email = $2 LIMIT 1",
      [tokenUser.id, tokenUser.email]
    );
    if (rows && rows.length > 0 && rows[0].permissions) {
      return {
        ...tokenUser,
        id: rows[0].id,
        permissions: rows[0].permissions,
      };
    }
  } catch (err) {
    // Fall back to tokenUser if db is unavailable
  }

  return tokenUser;
}
