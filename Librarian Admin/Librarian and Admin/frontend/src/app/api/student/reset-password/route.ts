import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let rawBodyText = "";
  let body: any = {};
  try {
    rawBodyText = await request.text();
    if (rawBodyText && rawBodyText.trim().length > 0) {
      body = JSON.parse(rawBodyText);
    }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const proxyRes = await proxyToBackend(
      "/api/student/reset-password",
      request,
      rawBodyText
    );
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {
    // fallback to direct DB
  }

  try {
    const { identifier, email, newPassword } = body || {};
    const target = String(identifier || email || "").trim();

    if (!target || !newPassword) {
      return NextResponse.json(
        { message: "Identifier (email or ID number) and new password are required." },
        { status: 400 }
      );
    }

    if (String(newPassword).trim().length < 6) {
      return NextResponse.json(
        { message: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    const { rows } = await pool.query(
      `UPDATE users
       SET password_hash = $2,
           updated_at = NOW()
       WHERE LOWER(email) = LOWER($1) OR LOWER(id_number) = LOWER($1)
       RETURNING id, name, email, id_number AS "idNumber"`,
      [target, passwordHash]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "No existing account found with that email or ID number." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. You may now log in with your new password.",
      user: rows[0],
    });
  } catch (error: any) {
    console.error("Student reset-password route error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to reset password." },
      { status: 500 }
    );
  }
}
