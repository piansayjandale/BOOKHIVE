import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { adminRepository } from "@/lib/admin/repository";
import { BACKEND_URL } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedDashboardData: any = null;
let cachedDashboardExpiry = 0;

export async function GET() {
  const now = Date.now();
  if (cachedDashboardData && now < cachedDashboardExpiry) {
    return NextResponse.json(cachedDashboardData);
  }

  try {
    // Get auth token from cookies
    const cookieStore = await cookies();
    const token =
      cookieStore.get("bookhive_backend_token")?.value ||
      cookieStore.get(SESSION_COOKIE)?.value ||
      "";
    
    const response = await fetch(`${BACKEND_URL}/api/dashboard`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });

    if (response.ok) {
      const data = await response.json();
      cachedDashboardData = data;
      cachedDashboardExpiry = now + 15000; // 15s in-memory cache for ultra-fast navigation
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
