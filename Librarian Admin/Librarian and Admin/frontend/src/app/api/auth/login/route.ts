import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { getDashboardPathForRole } from "@/lib/routing";
import { loginSchema } from "@/lib/validation";
import type { SessionUser } from "@/lib/types";
import { BACKEND_URL } from "@/lib/config";

export const runtime = "nodejs";

// Fallback dev credentials when database is not available
const DEV_CREDENTIALS: Record<string, any> = {
  "superadmin@stiwnu.edu.ph": {
    id: "super-001",
    name: "Super Administrator",
    email: "superadmin@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    idNumber: "SUP-2026-0001",
  },
  "sup-2026-0001": {
    id: "super-001",
    name: "Super Administrator",
    email: "superadmin@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    idNumber: "SUP-2026-0001",
  },
  "yana.palmares@stiwnu.edu.ph": {
    id: "user-001",
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    idNumber: "SUP-2026-0001",
  },
  "user-yana-001": {
    id: "user-001",
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Super Admin",
    password: "BookHiveSuperAdmin!2026",
    idNumber: "SUP-2026-0001",
  },
  "admin@stiwnu.edu.ph": {
    id: "user-admin-001",
    name: "Library Administrator",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
  },
  "adm-2026-0001": {
    id: "user-admin-001",
    name: "Library Administrator",
    email: "admin@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
    idNumber: "ADM-2026-0001",
  },
  "librarian@stiwnu.edu.ph": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
  "lib-2026-0001": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
  "joseph.tan@stiwnu.edu.ph": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
  "lib-2026-002": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
  "user-joseph-001": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
  "technical.librarian@stiwnu.edu.ph": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
  "circulation.librarian@stiwnu.edu.ph": {
    id: "user-002",
    name: "Yana Brich R. Palmares",
    email: "librarian@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
    idNumber: "LIB-2026-0001",
  },
};

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const identifier = payload.identifier.trim().toLowerCase();
    const password = payload.password.trim();

    // First, try to authenticate against the database via the Express backend
    let account = null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok) {
        const data = await res.json();
        account = data.user;
      }
    } catch (dbError) {
      console.warn("Express backend authentication failed:", dbError);
    }

    // Fall back to dev credentials if database is unavailable or returns null
    if (!account && process.env.NODE_ENV === "development") {
      console.log("⚠️  Using fallback development credentials");
      const devAccount = DEV_CREDENTIALS[identifier as keyof typeof DEV_CREDENTIALS];
      if (devAccount && (devAccount.password === password || password === "BookHiveAdmin!2026" || password === "BookHiveSuperAdmin!2026" || password === "BookHiveLibrarian!2026")) {
        account = devAccount;
      }
    }

    if (!account) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const defaultPermissions = {
      home: true,
      records: true,
      transactions: true,
      reminders: true,
      reports: true,
      history: true,
      settings: true,
    };

    const session: SessionUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role as any,
      avatar: account.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() ?? "")
        .join(""),
      permissions: account.permissions || defaultPermissions,
    };

    try {
      await adminRepository.registerAuthEvent(session.name, "Signed in to BookHive", "success");
    } catch (logError) {
      // If logging fails, continue anyway
      console.warn("Failed to log auth event:", logError);
    }

    const response = NextResponse.json({
      user: session,
      redirectPath: getDashboardPathForRole(session.role as any),
    });
    response.cookies.set(SESSION_COOKIE, await createSessionToken(session), getSessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Auth login failed:", error);
    return NextResponse.json(
      { message: "Please enter a valid BookHive credential set." },
      { status: 400 },
    );
  }
}
