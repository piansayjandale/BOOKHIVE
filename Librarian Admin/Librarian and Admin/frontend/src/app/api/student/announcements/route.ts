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
        created_at::text AS "createdAt",
        department
       FROM announcements
       ORDER BY created_at DESC
       LIMIT 30`
    );

    return NextResponse.json(
      {
        announcements: rows,
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
