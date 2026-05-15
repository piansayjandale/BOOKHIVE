import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { transactionStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/transactions/[id]">,
) {
  const session = await getSession();
  const { id } = await context.params;

  try {
    const payload = transactionStatusSchema.parse(await request.json());
    const result = adminRepository.updateTransactionStatus(id, payload.status, session);
    if ("error" in result) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: "Invalid transaction payload." }, { status: 400 });
  }
}
