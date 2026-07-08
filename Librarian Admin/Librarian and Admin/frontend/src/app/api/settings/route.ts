import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyToBackend("/api/admin/settings", request);
}

export async function PATCH(request: Request) {
  return proxyToBackend("/api/admin/settings", request);
}
