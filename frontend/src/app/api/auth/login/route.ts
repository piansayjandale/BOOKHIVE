import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { createSessionToken, getSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { getDashboardPathForRole } from "@/lib/routing";
import { loginSchema } from "@/lib/validation";
import type { SessionUser } from "@/lib/types";

export const runtime = "nodejs";

// Fallback dev credentials when database is not available
const DEV_CREDENTIALS = {
  "yana.palmares@stiwnu.edu.ph": {
    id: "user-001",
    name: "Yana Palmares",
    email: "yana.palmares@stiwnu.edu.ph",
    role: "Admin",
    password: "BookHiveAdmin!2026",
  },
  "joseph.tan@stiwnu.edu.ph": {
    id: "user-002",
    name: "Joseph Tan",
    email: "joseph.tan@stiwnu.edu.ph",
    role: "Librarian",
    password: "BookHiveLibrarian!2026",
  },
};

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const identifier = payload.identifier.trim().toLowerCase();
    const password = payload.password.trim();

    // First, try to authenticate against the database
    let account = null;
    try {
      account = await adminRepository.authenticate(identifier, password);
    } catch (dbError) {
      console.warn("Database authentication failed:", dbError);
    }

    // Fall back to dev credentials if database is unavailable or returns null
    if (!account && process.env.NODE_ENV === "development") {
      console.log("⚠️  Using fallback development credentials");
      const devAccount = DEV_CREDENTIALS[identifier as keyof typeof DEV_CREDENTIALS];
      if (devAccount && devAccount.password === password) {
        account = devAccount;
      }
    }

    if (!account) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const session: SessionUser = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role as any,
      avatar: account.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
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
