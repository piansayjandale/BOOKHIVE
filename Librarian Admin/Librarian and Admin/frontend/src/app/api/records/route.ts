import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return proxyToBackend("/api/admin/books", request);
}

export async function POST(request: Request) {
  return proxyToBackend("/api/admin/books", request);
}

