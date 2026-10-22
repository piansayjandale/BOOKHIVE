import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";
import { createSessionToken } from "@/lib/token";

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
      "/api/student/register",
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
    const { email, password, name, idNumber, department, course } = body || {};
    if (!email || !password || !name || !idNumber) {
      return NextResponse.json(
        { message: "Email, password, name, and idNumber are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const cleanIdNumber = String(idNumber).trim();
    const cleanName = String(name).trim();

    const { FALLBACK_USERS_ROSTER } = await import("@/lib/data/users-roster");

    // Check roster
    const inRoster = FALLBACK_USERS_ROSTER.some(
      (u) =>
        u.email.toLowerCase() === normalizedEmail ||
        (u.idNumber && u.idNumber.toLowerCase() === cleanIdNumber.toLowerCase())
    );
    if (inRoster) {
      return NextResponse.json(
        { message: "Email or Student ID already in use." },
        { status: 409 }
      );
    }

    let user: any = null;
    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    try {
      const existing = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = $1 OR LOWER(id_number) = LOWER($2) LIMIT 1`,
        [normalizedEmail, cleanIdNumber]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { message: "Email or Student ID already in use." },
          { status: 409 }
        );
      }

      const { rows } = await pool.query(
        `INSERT INTO users (
          id, name, email, role, department, course, id_number, status, password_hash, qr_code
        ) VALUES (
          gen_random_uuid(), $1, $2, 'Student', $3, $4, $5, 'Active', $6, gen_random_uuid()
        )
        RETURNING id, name, email, role, department, course, id_number AS "idNumber", status, avatar,
                  school_id_front AS "schoolIdFront", school_id_back AS "schoolIdBack",
                  library_id_front AS "libraryIdFront", library_id_back AS "libraryIdBack",
                  qr_code AS "qrCode"`,
        [
          cleanName,
          normalizedEmail,
          department ? String(department).trim() : "CICT",
          course ? String(course).trim() : "BSIT",
          cleanIdNumber,
          passwordHash,
        ]
      );
      if (rows && rows.length > 0) {
        user = rows[0];
      }
    } catch (dbErr: any) {
      console.warn("[Student Register API] DB notice (creating in-memory student account):", dbErr.message);
    }

    if (!user) {
      user = {
        id: `stu-${Date.now()}`,
        name: cleanName,
        email: normalizedEmail,
        role: "Student",
        department: department ? String(department).trim() : "CICT",
        course: course ? String(course).trim() : "BSIT",
        idNumber: cleanIdNumber,
        status: "Active",
        avatar: "",
        schoolIdFront: "",
        schoolIdBack: "",
        libraryIdFront: "",
        libraryIdBack: "",
        qrCode: `qr-${Date.now()}`,
        password_hash: passwordHash,
      };
      // Keep in roster memory
      FALLBACK_USERS_ROSTER.push(user);
    }

    const token = await createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || undefined,
    });

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          idNumber: user.idNumber,
          department: user.department,
          course: user.course,
          status: user.status,
          avatar: user.avatar || "",
          schoolIdFront: user.schoolIdFront || "",
          schoolIdBack: user.schoolIdBack || "",
          libraryIdFront: user.libraryIdFront || "",
          libraryIdBack: user.libraryIdBack || "",
          qrCode: user.qrCode,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Student register route error:", error);
    return NextResponse.json(
      { message: "Failed to register student." },
      { status: 500 }
    );
  }
}
