import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import {
  createSessionToken,
  getSession,
  getSessionCookieOptions,
  SESSION_COOKIE,
} from "@/lib/auth";
import { adminRepository } from "@/lib/admin/repository";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const proxyRes = await proxyToBackend("/api/admin/profile", request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const res = await pool.query(
      `SELECT
         u.id::text AS id,
         u.name,
         u.id_number AS "idNumber",
         u.email,
         u.role,
         u.department,
         u.course,
         u.status,
         u.avatar,
         COALESCE(u.last_active, u.created_at, NOW()) AS "lastActive",
         COALESCE(p.phone, '') AS phone,
         COALESCE(p.bio, '') AS bio
       FROM users u
       LEFT JOIN admin_profiles p ON p.user_id = u.id
       WHERE u.id::text = $1::text
       LIMIT 1`,
      [session.id]
    );

    if (res.rows[0]) {
      const row = res.rows[0];
      const avatar =
        row.avatar ||
        String(row.name || "BH")
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((part: string) => part[0]?.toUpperCase() ?? "")
          .join("");
      return NextResponse.json({
        ...row,
        avatar,
        lastActive: row.lastActive ? new Date(row.lastActive).toISOString() : new Date().toISOString(),
      });
    }

    const fallbackProfile = await adminRepository.getProfile(session.id);
    if (fallbackProfile) {
      return NextResponse.json(fallbackProfile);
    }

    return NextResponse.json({
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
      department: "Library Services",
      phone: "",
      bio: "",
      avatar: session.avatar,
      lastActive: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Direct DB getProfile error:", err);
    return NextResponse.json({ message: "Failed to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const rawBody = await request.text();
  const res = await proxyToBackend("/api/admin/profile", request, rawBody);
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
    return res;
  }

  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const name = body.name ?? session.name;
    const email = body.email ?? session.email;
    const department = body.department ?? "Library Services";
    const phone = body.phone ?? "";
    const bio = body.bio ?? "";

    const userRes = await pool.query(
      `UPDATE users
       SET name = $2, email = $3, department = $4, updated_at = NOW()
       WHERE id::text = $1::text
       RETURNING id::text AS id, name, email, role, department, avatar, last_active AS "lastActive"`,
      [session.id, name, email, department]
    );

    await pool
      .query(
        `INSERT INTO admin_profiles (user_id, phone, bio, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE
         SET phone = EXCLUDED.phone, bio = EXCLUDED.bio, updated_at = NOW()`,
        [session.id, phone, bio]
      )
      .catch(() => {});

    const updatedUser = userRes.rows[0] || {
      id: session.id,
      name,
      email,
      role: session.role,
      department,
      lastActive: new Date().toISOString(),
    };

    const avatar =
      updatedUser.avatar ||
      String(updatedUser.name || "BH")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() ?? "")
        .join("");

    const profilePayload = {
      ...updatedUser,
      phone,
      bio,
      avatar,
      lastActive: updatedUser.lastActive
        ? new Date(updatedUser.lastActive).toISOString()
        : new Date().toISOString(),
    };

    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Updated profile', $2, 'Profile', 'Account contact and department details were updated.')`,
        [`${session.role} ${name}`, name]
      );
    } catch {}

    const response = NextResponse.json(profilePayload);
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken({
        id: profilePayload.id,
        name: profilePayload.name,
        email: profilePayload.email,
        role: profilePayload.role,
        avatar: profilePayload.avatar,
      }),
      getSessionCookieOptions(),
    );
    return response;
  } catch (err: any) {
    console.error("Direct DB updateProfile error:", err);
    return NextResponse.json({ message: "Failed to update profile." }, { status: 500 });
  }
}
