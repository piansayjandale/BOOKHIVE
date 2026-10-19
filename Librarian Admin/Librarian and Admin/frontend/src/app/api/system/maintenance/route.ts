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
      "SELECT is_maintenance_active, maintenance_message, allow_admin_login FROM system_settings WHERE id = 1 LIMIT 1"
    );

    const isMaintenance = Boolean(rows[0]?.is_maintenance_active);
    const message = rows[0]?.maintenance_message || "System maintenance in progress. Please check back soon.";
    const allowAdmin = Boolean(rows[0]?.allow_admin_login ?? true);

    return NextResponse.json(
      {
        maintenance: isMaintenance,
        isMaintenanceActive: isMaintenance,
        message,
        allowAdmin,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      {
        maintenance: false,
        isMaintenanceActive: false,
        message: "",
        allowAdmin: true,
      },
      { status: 200, headers: corsHeaders }
    );
  }
}
