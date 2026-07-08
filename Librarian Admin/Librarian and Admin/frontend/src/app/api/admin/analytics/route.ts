import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${BACKEND_URL}/api/admin/reports`, { headers, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ message: "Failed to fetch reports from backend." }, { status: res.status });
    }

    const data = await res.json();
    
    // Map the backend reports to AnalyticsPayload
    const payload = {
      mostBorrowedBooks: (data.topBorrowed || []).map((b: any) => ({
        title: b.title,
        borrows: b.borrows || 0,
      })),
      mostActiveDepartments: (data.departmentUsage || []).map((d: any) => ({
        department: d.department,
        total: d.usage || 0,
      })),
      monthlyTrends: (data.monthlyBorrowing || []).map((m: any) => ({
        month: m.month,
        borrows: m.borrows || 0,
        returns: m.returns || 0,
        reservations: m.reservations || 0,
      })),
      yearlyTrends: [
        {
          year: "2026",
          transactions: (data.monthlyBorrowing || []).reduce(
            (acc: number, cur: any) => acc + (cur.borrows || 0) + (cur.reservations || 0),
            0
          ),
        }
      ],
      transactionStatus: (data.statusBreakdown || []).map((s: any) => ({
        status: s.status,
        total: s.count || 0,
      })),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Analytics proxy/mapping failed:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
