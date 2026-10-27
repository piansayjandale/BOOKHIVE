import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { adminRepository } from "@/lib/admin/repository";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend("/api/admin/profile/password", request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const session = await getSession();
    if (!session?.id) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const currentPassword = String(body.currentPassword || "");
    const nextPassword = String(body.nextPassword || body.newPassword || "");

    if (!currentPassword || !nextPassword) {
      return NextResponse.json(
        { message: "Current password and new password are required." },
        { status: 400 }
      );
    }

    const userRes = await pool.query(
      "SELECT id::text AS id, name, password_hash FROM users WHERE id::text = $1::text LIMIT 1",
      [session.id]
    );
    const user = userRes.rows[0];

    if (user) {
      let valid = false;
      if (user.password_hash) {
        if (String(user.password_hash).startsWith("$2")) {
          valid = await bcrypt.compare(currentPassword, user.password_hash);
        } else {
          valid = currentPassword === user.password_hash;
        }
      }
      if (!valid) {
        return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });
      }

      const nextHash = await bcrypt.hash(nextPassword, 10);
      await pool.query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id::text = $1::text", [
        session.id,
        nextHash,
      ]);

      try {
        await pool.query(
          `INSERT INTO history_logs (actor, action, target, module, detail)
           VALUES ($1, 'Changed password', $2, 'Profile', 'Account password was updated.')`,
          [`${session.role} ${session.name}`, session.name]
        );
      } catch {}

      return NextResponse.json({ success: true, message: "Password updated successfully." });
    }

    const fallback = await adminRepository.changePassword(session.id, currentPassword, nextPassword);
    if ("error" in fallback) {
      return NextResponse.json({ message: fallback.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    console.error("Direct DB changePassword error:", err);
    return NextResponse.json({ message: "Failed to change password." }, { status: 500 });
  }
}
