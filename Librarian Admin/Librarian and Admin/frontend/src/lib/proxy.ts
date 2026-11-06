import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSession, createSessionToken } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/config";

const LIVE_RENDER_BACKEND = "https://bookhive-backend-13kk.onrender.com";

export async function proxyToBackend(path: string, request: Request, customBody?: string) {
  const isProduction = process.env.NODE_ENV === "production" || process.env.NETLIFY;
  const isOcr = path.includes("/ocr/");
  const targetBase = isOcr && isProduction ? LIVE_RENDER_BACKEND : BACKEND_URL;

  if (!targetBase || (!isOcr && targetBase.includes("onrender.com"))) {
    return NextResponse.json(
      { message: "Backend proxy unavailable; using direct database handler." },
      { status: 503 },
    );
  }

  const session = await getSession().catch(() => null);
  const sessionToken = session ? await createSessionToken(session).catch(() => "") : "";

  const cookieStore = await cookies();
  const token =
    sessionToken ||
    cookieStore.get("bookhive_backend_token")?.value ||
    cookieStore.get(SESSION_COOKIE)?.value;

  const { searchParams } = new URL(request.url);
  const url = `${targetBase}${path}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const incomingAuth = request.headers.get("authorization");
  if (incomingAuth) {
    headers["Authorization"] = incomingAuth;
  } else if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const method = request.method;
  let body: string | undefined = typeof customBody === "string" ? customBody : undefined;

  if (body === undefined && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
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
      signal: AbortSignal.timeout(45000),
    });

    const rawText = await response.text();
    let data: any = {};
    if (rawText && rawText.trim().length > 0) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText };
      }
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`Proxy failure on ${method} ${path}:`, error);
    return NextResponse.json(
      { message: "Failed to communicate with Express backend." },
      { status: 500 },
    );
  }
}
