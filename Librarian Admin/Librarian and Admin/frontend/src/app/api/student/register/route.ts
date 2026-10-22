import { NextResponse } from "next/server";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST() {
  return NextResponse.json(
    {
      message:
        "Direct account creation is restricted to the Super Administrator. Please log in directly with your official STI School Email (@wnu.sti.edu.ph or @sti.edu.ph) on the Log In page to complete your student profile and upload your IDs.",
    },
    { status: 403, headers: corsHeaders }
  );
}
