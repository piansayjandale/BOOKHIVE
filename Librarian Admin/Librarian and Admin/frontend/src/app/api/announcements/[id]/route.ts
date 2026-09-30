import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyToBackend(`/api/admin/announcements/${id}`, request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyToBackend(`/api/admin/announcements/${id}`, request);
}

