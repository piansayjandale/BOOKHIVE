import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyToBackend("/api/admin/dashboard", request);
}
