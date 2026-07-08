import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { adminSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await adminRepository.getSettings());
}

export async function PATCH(request: Request) {
  const session = await getSession();

  try {
    const payload = adminSettingsSchema.parse(await request.json());
    return NextResponse.json(await adminRepository.updateSettings(payload, session));
  } catch {
    return NextResponse.json({ message: "Invalid settings payload." }, { status: 400 });
  }
}
