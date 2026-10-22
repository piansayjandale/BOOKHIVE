"use client";

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  const rawText = await response.text();
  let payload: any = null;
  if (rawText && rawText.trim().length > 0) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorMsg =
      (payload && typeof payload === "object" && payload.message) ||
      rawText.trim() ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return (payload ?? {}) as T;
}
