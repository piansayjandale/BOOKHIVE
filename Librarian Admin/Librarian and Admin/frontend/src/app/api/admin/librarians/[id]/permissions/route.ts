import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";
import { createSessionToken, getSession, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const { permissions } = body;

  let updatedUser: any = null;

  // 1. Try proxying to Express backend first
  try {
    const proxyRes = await proxyToBackend(`/api/admin/librarians/${id}/permissions`, {
      ...request,
      json: async () => ({ permissions }),
    } as any);

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      updatedUser = data.user;
    }
  } catch (err) {
    console.warn(`Proxy to /api/admin/librarians/${id}/permissions failed, updating database directly:`, err);
  }

  // 2. Direct PostgreSQL fallback if not updated via proxy
  if (!updatedUser) {
    try {
      const permissionsJson = JSON.stringify(permissions || {});
      const { rows } = await pool.query(
        `UPDATE users
         SET permissions = $1::jsonb, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, id_number AS "idNumber", email, role, department, permissions`,
        [permissionsJson, id]
      );

      if (rows && rows.length > 0) {
        updatedUser = rows[0];
      } else {
        updatedUser = { id, permissions };
      }
    } catch (dbErr: any) {
      console.error("Direct database update failed:", dbErr);
      return NextResponse.json(
        { message: dbErr?.message || "Failed to update librarian permissions" },
        { status: 500 }
      );
    }
  }

  const response = NextResponse.json({
    message: "Librarian permissions updated successfully",
    user: updatedUser,
  });

  // 3. If currently logged-in user matches, instantly refresh the session cookie
  try {
    const session = await getSession();
    if (session && (session.id === id || session.email === updatedUser.email)) {
      const nextUser = {
        ...session,
        id: updatedUser.id,
        permissions: updatedUser.permissions,
      };
      response.cookies.set(
        SESSION_COOKIE,
        await createSessionToken(nextUser),
        getSessionCookieOptions()
      );
    }
  } catch (cookieErr) {
    console.warn("Failed to refresh session cookie in PATCH permissions:", cookieErr);
  }

  return response;
}
