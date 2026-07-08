import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function proxyToBackend(path: string, request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const { searchParams } = new URL(request.url);
  const url = `${BACKEND_URL}${path}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const method = request.method;
  let body: string | undefined = undefined;

  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    try {
      const clonedReq = request.clone();
      body = await clonedReq.text();
    } catch {
      // Body might be empty or invalid
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Proxy failure on ${method} ${path}:`, error);
    return NextResponse.json(
      { message: "Failed to communicate with Express backend." },
      { status: 500 },
    );
  }
}
