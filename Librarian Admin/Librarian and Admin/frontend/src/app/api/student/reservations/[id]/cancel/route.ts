import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleCancel(id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleCancel(id);
}

async function handleCancel(id: string) {
  try {
    const { rows } = await pool.query(
      `UPDATE transactions
       SET status = 'Cancelled'
       WHERE id::text = $1
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { message: "Transaction not found." },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        message: "Reservation cancelled successfully.",
        transaction: rows[0],
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Cancel Reservation API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to cancel reservation." },
      { status: 500, headers: corsHeaders }
    );
  }
}
