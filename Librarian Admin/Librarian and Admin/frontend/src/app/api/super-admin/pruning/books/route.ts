import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyToBackend("/api/super-admin/pruning/books", request);
}
