import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/config";
import { adminRepository } from "@/lib/admin/repository";
import { buildRichReports } from "@/lib/admin/reports-helper";

export const runtime = "nodejs";

function mapReportsToAnalytics(data: any) {
  return {
    mostBorrowedBooks: (data.topBorrowed || []).map((b: any) => ({
      title: b.title,
      borrows: b.borrows || 0,
    })),
    mostActiveDepartments: (data.departmentUsage || []).map((d: any) => ({
      department: d.department,
      total: d.usage || d.count || 0,
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
      },
    ],
    transactionStatus: (data.statusBreakdown || []).map((s: any) => ({
      status: s.status,
      total: s.count || 0,
    })),
    monthlyBookAdditions: data.monthlyBookAdditions || [],
    catalogQuota: data.catalogQuota || {
      limit: 1000,
      totalAdded: 0,
      remaining: 1000,
      percentage: 0,
      safeMonthlyRate: 83,
    },
    mostCourseBorrowed: data.mostCourseBorrowed || null,
    topStudentBorrowers: data.topStudentBorrowers || [],
    mostSearchedBooks: data.mostSearchedBooks || null,
    circulationHealth: data.circulationHealth || null,
    collectionDepth: data.collectionDepth || null,
  };
}

export async function GET() {
  if (BACKEND_URL && !BACKEND_URL.includes("onrender.com")) {
    try {
      const cookieStore = await cookies();
      const token =
        cookieStore.get("bookhive_backend_token")?.value ||
        cookieStore.get(SESSION_COOKIE)?.value;

      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${BACKEND_URL}/api/admin/reports`, { headers, cache: "no-store" });
      if (res.ok) {
        const rawText = await res.text();
        let data: any = null;
        if (rawText && rawText.trim().length > 0) {
          try {
            data = JSON.parse(rawText);
          } catch {
            data = null;
          }
        }

        if (data) {
          return NextResponse.json(mapReportsToAnalytics(data));
        }
      }
    } catch (error) {
      console.warn("Analytics proxy failed, falling back to direct PostgreSQL reports:", error);
    }
  }

  try {
    const richReports = await buildRichReports();
    if (richReports) {
      return NextResponse.json(mapReportsToAnalytics(richReports));
    }
    const fallbackData = await adminRepository.getAnalytics();
    return NextResponse.json(fallbackData);
  } catch (fallbackError) {
    console.error("Analytics fallback failed:", fallbackError);
    return NextResponse.json({ message: "Failed to load analytics data." }, { status: 500 });
  }
}
