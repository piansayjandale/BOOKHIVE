import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";
import { store } from "@/lib/data/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function queryDbTransactions(
  search = "",
  status = "All",
  type = "All",
  studentId: string | null = null,
) {
  const filters: any[] = [];
  const whereClauses: string[] = [];

  if (status && status !== "All") {
    filters.push(status);
    whereClauses.push(`t.status = $${filters.length}`);
  }

  if (type && type !== "All") {
    filters.push(type);
    whereClauses.push(`t.type = $${filters.length}`);
  }

  if (studentId) {
    filters.push(studentId);
    whereClauses.push(`t.student_id = $${filters.length}`);
  }

  if (search.trim()) {
    filters.push(`%${search.trim().toLowerCase()}%`);
    const idx = filters.length;
    whereClauses.push(`(
      LOWER(t.student_name) LIKE $${idx} OR
      LOWER(t.student_id) LIKE $${idx} OR
      LOWER(t.resource_title) LIKE $${idx} OR
      LOWER(COALESCE(t.isbn, '')) LIKE $${idx}
    )`);
  }

  const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  const query = `
    SELECT
      t.id,
      t.user_id AS "userId",
      t.student_name AS "studentName",
      t.student_id AS "studentId",
      t.resource_title AS "resourceTitle",
      t.isbn,
      t.department,
      COALESCE(u.department, t.department) AS "userDepartment",
      u.course AS "userCourse",
      COALESCE(
        b.department,
        CASE 
          WHEN t.department IN ('Circulation', 'General Reference', 'Filipiniana', 'Reserve', 'Periodical', 'Special Collections') THEN t.department
          ELSE 'Circulation'
        END
      ) AS "bookDepartment",
      t.type,
      t.status,
      t.requested_at AS "requestedAt",
      t.due_date AS "dueDate",
      t.decided_by AS "decidedBy",
      t.decided_at AS "decidedAt",
      t.student_id_image AS "studentIdImage",
      t.comment
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT department
      FROM books
      WHERE (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = books.isbn)
         OR (LOWER(t.resource_title) = LOWER(books.title))
      LIMIT 1
    ) b ON true
    ${whereClause}
    ORDER BY t.requested_at DESC
  `;

  const { rows } = await pool.query(query, filters);
  return rows;
}

export async function GET(request: Request) {
  // 1. Try Express /api/admin/transactions first
  try {
    const proxyRes = await proxyToBackend("/api/admin/transactions", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/transactions failed, trying /api/transactions:", err);
  }

  // 2. Try Express /api/transactions
  try {
    const proxyRes = await proxyToBackend("/api/transactions", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/transactions failed, using direct DB fallback:", err);
  }

  // 3. Resilient Database Fallback
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "All";
    const type = searchParams.get("type") ?? "All";
    const studentId = searchParams.get("studentId");

    const rows = await queryDbTransactions(search, status, type, studentId);

    const borrowRequests = rows.filter(
      (item) => String(item.type || "").toLowerCase() === "borrow"
    );
    const returnRecords = rows.filter(
      (item) => String(item.type || "").toLowerCase() === "return" || item.status === "Returned"
    );
    const reservations = rows.filter(
      (item) => String(item.type || "").toLowerCase() === "reservation"
    );

    const summary = {
      pending: rows.filter((item) => item.status === "Pending").length,
      approved: rows.filter((item) => item.status === "Approved").length,
      declined: rows.filter((item) => item.status === "Declined").length,
      returned: rows.filter((item) => item.status === "Returned").length,
    };

    return NextResponse.json({
      transactions: rows,
      borrowRequests,
      returnRecords,
      reservations,
      transactionHistory: rows,
      summary,
      allowAdminControl: true,
    });
  } catch (dbError) {
    console.error("Admin transactions direct DB query error:", dbError);
    const transactions = store.listTransactions();
    return NextResponse.json({
      transactions,
      borrowRequests: [],
      returnRecords: [],
      reservations: [],
      transactionHistory: transactions,
      summary: { pending: 0, approved: 0, declined: 0, returned: 0 },
      allowAdminControl: true,
    });
  }
}

export async function POST(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/transactions", request);
    if (proxyRes.ok) return proxyRes;
  } catch {}
  return proxyToBackend("/api/transactions", request);
}
