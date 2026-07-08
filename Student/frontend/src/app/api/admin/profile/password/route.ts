import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { adminPasswordSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = adminPasswordSchema.parse(await request.json());
    const result = await adminRepository.changePassword(
      session.id,
      payload.currentPassword,
      payload.nextPassword,
    );
    if ("error" in result) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Invalid password payload." }, { status: 400 });
  }
}
