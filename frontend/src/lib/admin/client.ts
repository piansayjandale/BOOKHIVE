"use client";

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  
  const isJson = response.headers.get("content-type")?.includes("application/json");

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (isJson) {
      const payload = (await response.json()) as { message?: string };
      throw new Error(payload.message ?? "Request failed.");
    } else {
      const text = (await response.text()).trim();
      throw new Error(text || `Request failed with status ${response.status}`);
    }
  }

  if (!isJson) {
    throw new Error(`Expected JSON response, but got ${response.headers.get("content-type")}`);
  }

  return (await response.json()) as T;
}
