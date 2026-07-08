import { proxyToBackend } from "@/lib/proxy";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyToBackend(`/api/admin/transactions/${id}`, request);
}
