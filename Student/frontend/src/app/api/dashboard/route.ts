import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { adminRepository } from "@/lib/admin/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

export async function GET() {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value || "";
    
    const response = await fetch(`${BACKEND_URL}/api/admin/dashboard`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
    console.warn(`Backend /api/admin/dashboard returned ${response.status}. Using local repository fallback.`);
  } catch (error) {
    console.warn("/api/dashboard proxy connection error. Using local repository fallback:", error);
  }

  try {
    const data = await adminRepository.getDashboard();
    return NextResponse.json(data);
  } catch (fallbackError) {
    console.error("/api/dashboard fallback error:", fallbackError);
    return NextResponse.json(
      { message: "Failed to load dashboard data." },
      { status: 500 }
    );
  }
}
