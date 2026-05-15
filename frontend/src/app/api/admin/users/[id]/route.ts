import { NextResponse } from "next/server";

import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { adminUserFormSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  const session = await getSession();
  const { id } = await context.params;

  try {
    const payload = adminUserFormSchema.partial().parse(await request.json());
    const user = await adminRepository.updateUser(id, payload, session);
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ message: "Invalid user payload." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  const session = await getSession();
  const { id } = await context.params;
  const deleted = await adminRepository.deleteUser(id, session);

  if (!deleted) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
