import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id::text AS "id",
        title,
        content,
        audience,
        priority,
        author,
        created_at,
        updated_at,
        department
       FROM announcements
       ORDER BY created_at DESC
       LIMIT 30`
    );

    const announcements = (rows || []).map((row: any) => ({
      id: String(row.id),
      title: row.title || "Announcement",
      content: row.content || "",
      audience: row.audience || "All Users",
      priority: row.priority || "Normal",
      author: row.author || row.author_name || "Library Administration",
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()),
      department: row.department || null,
    }));

    return NextResponse.json(
      {
        announcements,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      { announcements: [] },
      { status: 200, headers: corsHeaders }
    );
  }
}
