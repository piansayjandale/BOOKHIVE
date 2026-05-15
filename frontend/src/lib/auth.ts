import { cookies } from "next/headers";

import type { Role, SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "bookhive_access_token";

const JWT_SECRET = process.env.BOOKHIVE_JWT_SECRET ?? "bookhive-dev-secret-change-me";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

interface TokenPayload extends SessionUser {
  iat: number;
  exp: number;
}

function encodeBase64Url(value: string | Uint8Array) {
  let str = "";
  if (typeof value === "string") {
    str = btoa(encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))));
  } else {
    str = btoa(String.fromCharCode(...new Uint8Array(value)));
  }
  return str.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const remainder = padded.length % 4;
  const normalized = remainder === 0 ? padded : `${padded}${"=".repeat(4 - remainder)}`;
  const str = atob(normalized);
  return decodeURIComponent(
    str.split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
  );
}

async function signSegment(value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return encodeBase64Url(new Uint8Array(signatureBuffer));
}

export async function createSessionToken(user: SessionUser) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    ...user,
    iat: issuedAt,
    exp: issuedAt + SESSION_DURATION_SECONDS,
  };

  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = await signSegment(`${header}.${body}`);

  return `${header}.${body}.${signature}`;
}

export async function parseSessionToken(cookieValue?: string | null): Promise<SessionUser | null> {
  if (!cookieValue) {
    return null;
  }

  try {
    const [header, body, signature] = cookieValue.split(".");
    if (!header || !body || !signature) {
      return null;
    }

    const expectedSignature = await signSegment(`${header}.${body}`);
    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(decodeBase64Url(body)) as TokenPayload;
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      avatar: payload.avatar,
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export function hasRequiredRole(user: SessionUser | null, roles: Role[]) {
  return !!user && roles.includes(user.role);
}
