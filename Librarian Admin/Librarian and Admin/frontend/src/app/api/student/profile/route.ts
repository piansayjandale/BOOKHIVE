import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const email = searchParams.get("email");

    const authHeader = request.headers.get("authorization");
    let authSub = "";
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.slice(7);
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64url").toString("utf-8")
          );
          authSub = payload.sub || payload.id || payload.email || "";
        }
      } catch {
        // ignore
      }
    }

    const target = studentId || email || authSub;

    let user: any = null;
    if (target) {
      const { rows } = await pool.query(
        `SELECT 
          id::text AS "id",
          name,
          email,
          role,
          id_number AS "idNumber",
          id_number AS "studentId",
          department,
          course,
          year_level AS "yearLevel",
          avatar,
          qr_code AS "qrCode",
          status
        FROM users
        WHERE LOWER(id_number) = LOWER($1) OR LOWER(email) = LOWER($1) OR id::text = $1
        LIMIT 1`,
        [target]
      );
      if (rows.length > 0) user = rows[0];
    }

    if (!user) {
      // Return default active student placeholder if lookup was generic
      user = {
        name: "Student",
        email: "student@stiwnu.edu.ph",
        role: "Student",
        idNumber: "STI-WNU",
        studentId: "STI-WNU",
        department: "CICT",
        course: "BSIT",
        status: "Active",
      };
    }

    return NextResponse.json({ user, profile: user }, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[Student Profile API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to load profile." },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { studentId, email, name, department, course, phone, address, avatar } = body;

    const target = studentId || email;
    if (target) {
      await pool.query(
        `UPDATE users
         SET 
           name = COALESCE(NULLIF($1, ''), name),
           department = COALESCE(NULLIF($2, ''), department),
           course = COALESCE(NULLIF($3, ''), course),
           avatar = COALESCE(NULLIF($4, ''), avatar),
           updated_at = NOW()
         WHERE LOWER(id_number) = LOWER($5) OR LOWER(email) = LOWER($5)`,
        [name, department, course, avatar, target]
      );
    }

    return NextResponse.json(
      { message: "Profile updated successfully.", success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to update profile." },
      { status: 500, headers: corsHeaders }
    );
  }
}
