import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const FALLBACK_LIBRARIANS = [
  {
    id: "821b7b9e-bd26-40a5-b4b3-91ba308130db",
    name: "Yana Brich R. Palmares",
    idNumber: "LIB-2026-0001",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    department: "Library Services",
    course: "Library Services",
    status: "Active",
    permissions: {
      home: true,
      records: true,
      transactions: true,
      reminders: true,
      reports: true,
      history: true,
      settings: true,
    },
  },
  {
    id: "ab3c2f9c-535a-45b7-99c6-794f537401a5",
    name: "Joseph Tan",
    idNumber: "LIB-2026-0002",
    email: "joseph.tan@stiwnu.edu.ph",
    role: "Librarian",
    department: "Library Services",
    course: "Library Services",
    status: "Active",
    permissions: {
      home: true,
      records: true,
      transactions: true,
      reminders: true,
      reports: true,
      history: true,
      settings: true,
    },
  },
  {
    id: "bc09ab5a-d432-4929-b71b-726257f82b84",
    name: "Maria Santos",
    idNumber: "LIB-2026-0003",
    email: "maria.santos@stiwnu.edu.ph",
    role: "Librarian",
    department: "Library Services",
    course: "Library Services",
    status: "Active",
    permissions: {
      home: true,
      records: true,
      transactions: true,
      reminders: true,
      reports: true,
      history: true,
      settings: true,
    },
  },
];

export async function GET(request: Request) {
  // 1. Try proxying to Express backend first
  try {
    const proxyRes = await proxyToBackend("/api/admin/librarians", request);
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (Array.isArray(data.librarians) && data.librarians.length > 0) {
        return NextResponse.json(data);
      }
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/librarians failed, falling back to direct database query:", err);
  }

  // 2. Direct PostgreSQL fallback
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.id_number AS "idNumber",
        u.email,
        u.role,
        u.department,
        u.course,
        u.status,
        u.avatar,
        u.permissions,
        u.last_active AS "lastActive"
      FROM users u
      WHERE u.role::text ILIKE '%librarian%'
      ORDER BY u.name ASC
    `);

    if (rows && rows.length > 0) {
      const librarians = rows.map((row) => ({
        ...row,
        permissions: row.permissions || {
          home: true,
          records: true,
          transactions: true,
          reminders: true,
          reports: true,
          history: true,
          settings: true,
        },
      }));
      return NextResponse.json({ librarians });
    }
  } catch (dbErr) {
    console.warn("Direct database query for librarians failed, using fallback:", dbErr);
  }

  // 3. In-memory fallback
  return NextResponse.json({ librarians: FALLBACK_LIBRARIANS });
}
