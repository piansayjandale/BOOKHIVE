import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { BACKEND_URL } from "@/lib/config";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identifier, email, newPassword } = await request.json();
    const target = String(identifier || email || "").trim();

    if (!target || !newPassword) {
      return NextResponse.json(
        { message: "Identifier (email or ID number) and new password are required." },
        { status: 400 }
      );
    }

    if (BACKEND_URL && !BACKEND_URL.includes("onrender.com")) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: target, newPassword }),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data);
        }
        if (res.status < 500) {
          const err = await res.json();
          return NextResponse.json(
            { message: err.message || "Password reset failed." },
            { status: res.status }
          );
        }
      } catch {
        // Fallback to direct Neon PostgreSQL execution
      }
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    const updateRes = await pool.query(
      `UPDATE users
       SET password_hash = $2, updated_at = NOW()
       WHERE LOWER(email) = LOWER($1) OR LOWER(id_number) = LOWER($1)
       RETURNING id::text AS id, name, email, id_number AS "idNumber"`,
      [target, passwordHash]
    );

    if (updateRes.rowCount === 0) {
      return NextResponse.json(
        { message: "No account found matching that email or ID number." },
        { status: 404 }
      );
    }

    try {
      await pool.query(
        `INSERT INTO auth_logs (actor, message, severity, created_at)
         VALUES ($1, $2, 'info', NOW())`,
        [updateRes.rows[0].name || target, `Password reset completed for ${target}`]
      );
    } catch {}

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully. You may now sign in.",
      user: updateRes.rows[0],
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "Unable to complete password reset." },
      { status: 500 }
    );
  }
}
