import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

async function handleUpdateSuperAdminUser(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawBody = await request.text();
  const proxyRes = await proxyToBackend(`/api/super-admin/users/${id}`, request, rawBody);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const {
      name,
      idNumber,
      email,
      role,
      department,
      course,
      status,
      yearLevel,
      section,
      password,
    } = body;

    const sets: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      values.push(name);
      sets.push(`name = $${values.length}`);
    }
    if (idNumber !== undefined) {
      values.push(idNumber);
      sets.push(`id_number = $${values.length}`);
    }
    if (email !== undefined) {
      values.push(email);
      sets.push(`email = $${values.length}`);
    }
    if (role !== undefined) {
      values.push(role);
      sets.push(`role = $${values.length}`);
    }
    if (department !== undefined) {
      values.push(department);
      sets.push(`department = $${values.length}`);
    }
    if (course !== undefined) {
      values.push(course);
      sets.push(`course = $${values.length}`);
    }
    if (status !== undefined) {
      values.push(status);
      sets.push(`status = $${values.length}`);
    }
    if (yearLevel !== undefined) {
      values.push(yearLevel);
      sets.push(`year_level = $${values.length}`);
    }
    if (section !== undefined) {
      values.push(section);
      sets.push(`section = $${values.length}`);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(String(password), 10);
      values.push(passwordHash);
      sets.push(`password_hash = $${values.length}`);
    }

    if (sets.length === 0) {
      return NextResponse.json({ message: "No fields provided to update." }, { status: 400 });
    }

    values.push(id);
    const { rows } = await pool.query(
      `UPDATE users
       SET ${sets.join(", ")}, updated_at = NOW()
       WHERE id::text = $${values.length}::text
       RETURNING
         id, name, id_number AS "idNumber", email, role, department, course, status,
         permissions, year_level AS "yearLevel", section,
         avatar, qr_code AS "qrCode", last_active AS "lastActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
      values
    );

    if (!rows[0]) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const updated = rows[0];
    const session = await getSession().catch(() => null);
    const actor = session?.name || "Super Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Updated Account', $2, 'User Management', $3)`,
        [`Super Admin ${actor}`, updated.name, `Updated role/status/profile for ${updated.email}.`]
      );
    } catch {}

    return NextResponse.json({ user: updated });
  } catch (err: any) {
    console.error("Direct DB superAdmin updateUser error:", err);
    return NextResponse.json({ message: err?.message || "Failed to update user." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateSuperAdminUser(request, context);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdateSuperAdminUser(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const proxyRes = await proxyToBackend(`/api/super-admin/users/${id}`, request);
  if (proxyRes.ok) {
    return proxyRes;
  }

  try {
    await pool.query("DELETE FROM admin_profiles WHERE user_id::text = $1::text", [id]).catch(() => {});
    const { rows } = await pool.query(
      "DELETE FROM users WHERE id::text = $1::text RETURNING id, name, email",
      [id]
    );
    if (!rows[0]) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const session = await getSession().catch(() => null);
    const actor = session?.name || "Super Admin";
    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Deleted Account', $2, 'User Management', $3)`,
        [`Super Admin ${actor}`, rows[0].name, `Permanently deleted account ${rows[0].email}.`]
      );
    } catch {}

    return NextResponse.json({ success: true, deletedUser: rows[0] });
  } catch (err: any) {
    console.error("Direct DB superAdmin deleteUser error:", err);
    return NextResponse.json({ message: err?.message || "Failed to delete user." }, { status: 500 });
  }
}
