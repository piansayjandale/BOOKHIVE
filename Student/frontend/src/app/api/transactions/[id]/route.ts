import { NextResponse } from "next/server";

import { getSession, hasRequiredRole } from "@/lib/auth";
import { store } from "@/lib/data/store";
import { transactionStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!hasRequiredRole(session, ["Admin", "Librarian"])) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = transactionStatusSchema.parse(await request.json());
    const { id } = await context.params;
    const result = store.updateTransactionStatus(id, payload.status, session);

    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: "Invalid transaction update." }, { status: 400 });
  }
}
