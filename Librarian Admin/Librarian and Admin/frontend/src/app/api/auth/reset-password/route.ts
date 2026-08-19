import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { identifier, email, newPassword } = await request.json();
    const target = identifier || email;

    if (!target || !newPassword) {
      return NextResponse.json(
        { message: "Identifier (email or ID number) and new password are required." },
        { status: 400 }
      );
    }

    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";
    const res = await fetch(`${backendUrl}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: target, newPassword }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    } else {
      const err = await res.json();
      return NextResponse.json(
        { message: err.message || "Password reset failed." },
        { status: res.status }
      );
    }
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { message: "Unable to connect to password reset server." },
      { status: 500 }
    );
  }
}
