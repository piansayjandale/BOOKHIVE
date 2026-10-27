import { NextResponse } from "next/server";
import { pool, hasExplicitDatabaseUrl } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (hasExplicitDatabaseUrl) {
      const [bookRes, histRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int as count FROM books WHERE created_at >= CURRENT_DATE`),
        pool.query(`SELECT COUNT(*)::int as count FROM history_logs WHERE (module = 'Records' OR action ILIKE '%add%book%') AND created_at >= CURRENT_DATE`),
      ]);
      const booksCount = bookRes.rows[0]?.count ?? 0;
      const historyCount = histRes.rows[0]?.count ?? 0;
      const count = Math.max(booksCount, historyCount);

      return NextResponse.json({
        count,
        booksCount,
        historyCount,
        date: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      count: 0,
      booksCount: 0,
      historyCount: 0,
      date: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Daily count error:", err);
    return NextResponse.json({ count: 0, error: err.message }, { status: 500 });
  }
}
