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
      "SELECT borrow_limit, borrow_duration_days FROM system_settings WHERE id = 1 LIMIT 1"
    );

    const borrowLimit = Number(rows[0]?.borrow_limit || 5);
    const borrowDurationDays = Number(rows[0]?.borrow_duration_days || 7);

    return NextResponse.json(
      {
        borrowLimit,
        borrowDurationDays,
        settings: {
          borrowLimit,
          borrowDurationDays,
        },
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        borrowLimit: 5,
        borrowDurationDays: 7,
        settings: { borrowLimit: 5, borrowDurationDays: 7 },
      },
      { status: 200, headers: corsHeaders }
    );
  }
}
