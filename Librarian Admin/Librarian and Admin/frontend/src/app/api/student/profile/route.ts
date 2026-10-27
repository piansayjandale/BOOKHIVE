import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function extractAuthSub(request: Request): string {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf-8")
        );
        return payload.sub || payload.id || payload.email || "";
      }
    } catch {
      // ignore
    }
  }
  return "";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const email = searchParams.get("email");
    const authSub = extractAuthSub(request);

    const target = studentId || email || authSub;

    let user: any = null;
    if (target) {
      try {
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
            section,
            avatar,
            qr_code AS "qrCode",
            status,
            school_id_front AS "schoolIdFront",
            school_id_back AS "schoolIdBack",
            library_id_front AS "libraryIdFront",
            library_id_back AS "libraryIdBack"
          FROM users
          WHERE LOWER(id_number) = LOWER($1) OR LOWER(email) = LOWER($1) OR id::text = $1
          LIMIT 1`,
          [target]
        );
        if (rows.length > 0) user = rows[0];
      } catch (dbErr: any) {
        console.warn("[Student Profile API] Cloud DB notice, checking local roster:", dbErr.message);
      }

      if (!user) {
        const { FALLBACK_USERS_ROSTER } = await import("@/lib/data/users-roster");
        const low = target.toLowerCase();
        const match = FALLBACK_USERS_ROSTER.find(
          (u) =>
            u.id === target ||
            (u.idNumber && u.idNumber.toLowerCase() === low) ||
            u.email.toLowerCase() === low
        );
        if (match) {
          user = {
            ...match,
            studentId: match.idNumber,
          };
        }
      }
    }

    if (!user) {
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
    const {
      id,
      userId,
      studentId,
      idNumber,
      email,
      name,
      department,
      course,
      yearLevel,
      section,
      avatar,
      schoolIdFront,
      schoolIdBack,
      libraryIdFront,
      libraryIdBack,
    } = body;

    const authSub = extractAuthSub(request);
    const target = authSub || id || userId || studentId || idNumber || email;
    const nextIdNumber = idNumber || studentId || null;

    let updatedUser: any = null;
    if (target) {
      const updateRes = await pool.query(
        `UPDATE users
         SET 
           name = COALESCE(NULLIF($1, ''), name),
           email = COALESCE(NULLIF($2, ''), email),
           id_number = COALESCE(NULLIF($3, ''), id_number),
           department = COALESCE(NULLIF($4, ''), department),
           course = COALESCE(NULLIF($5, ''), course),
           year_level = COALESCE(NULLIF($6, ''), year_level),
           section = COALESCE(NULLIF($7, ''), section),
           avatar = COALESCE(NULLIF($8, ''), avatar),
           school_id_front = COALESCE(NULLIF($9, ''), school_id_front),
           school_id_back = COALESCE(NULLIF($10, ''), school_id_back),
           library_id_front = COALESCE(NULLIF($11, ''), library_id_front),
           library_id_back = COALESCE(NULLIF($12, ''), library_id_back),
           updated_at = NOW()
         WHERE id::text = $13 OR LOWER(id_number) = LOWER($13) OR LOWER(email) = LOWER($13)
         RETURNING
           id::text AS "id",
           name,
           email,
           role,
           id_number AS "idNumber",
           id_number AS "studentId",
           department,
           course,
           year_level AS "yearLevel",
           section,
           avatar,
           qr_code AS "qrCode",
           status,
           school_id_front AS "schoolIdFront",
           school_id_back AS "schoolIdBack",
           library_id_front AS "libraryIdFront",
           library_id_back AS "libraryIdBack"`,
        [
          name ?? null,
          email ?? null,
          nextIdNumber,
          department ?? null,
          course ?? null,
          yearLevel ?? null,
          section ?? null,
          avatar ?? null,
          schoolIdFront ?? null,
          schoolIdBack ?? null,
          libraryIdFront ?? null,
          libraryIdBack ?? null,
          target,
        ]
      );
      updatedUser = updateRes.rows[0] || null;
    }

    return NextResponse.json(
      {
        user: updatedUser,
        profile: updatedUser,
        message: "Profile updated successfully.",
        success: true,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to update profile." },
      { status: 500, headers: corsHeaders }
    );
  }
}
