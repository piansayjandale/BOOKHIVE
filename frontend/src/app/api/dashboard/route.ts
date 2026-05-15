import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

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

    if (!response.ok) {
      const error = await response.text();
      console.error("/api/admin/dashboard failed:", response.status, error);
      return NextResponse.json(
        { message: "Failed to load dashboard from backend." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/dashboard proxy error:", error);
    return NextResponse.json(
      { message: "Failed to load dashboard. Backend may be unavailable." },
      { status: 503 }
    );
  }
}
