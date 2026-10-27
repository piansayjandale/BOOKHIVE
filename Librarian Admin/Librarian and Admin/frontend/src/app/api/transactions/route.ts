import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { getSession } from "@/lib/auth";
import { hasExplicitDatabaseUrl, pool } from "@/lib/db";
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
      b.author AS "author",
      b.cover_img AS "coverUrl",
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
      t.comment,
      t.available_at AS "availableAt",
      t.expires_at AS "expiresAt",
      t.picked_up_at AS "pickedUpAt",
      CASE WHEN t.picked_up_at IS NOT NULL THEN true ELSE false END AS "isPickedUp",
      CASE
        WHEN t.type = 'Reservation' AND t.status IN ('Pending', 'Approved') THEN (
          SELECT COUNT(*)::int + 1
          FROM transactions t_q
          WHERE t_q.type = 'Reservation'
            AND t_q.status IN ('Pending', 'Approved')
            AND (
              (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t_q.isbn = t.isbn)
              OR (t.resource_title IS NOT NULL AND LOWER(t_q.resource_title) = LOWER(t.resource_title))
            )
            AND t_q.requested_at < t.requested_at
        )
        ELSE NULL
      END as "queuePosition"
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT author, cover_img, department
      FROM books b
      WHERE (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
         OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))
      ORDER BY (CASE WHEN t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn THEN 0 ELSE 1 END)
      LIMIT 1
    ) b ON true
    ${whereClause}
    ORDER BY t.requested_at DESC
  `;

  const { rows } = await pool.query(query, filters);
  return rows;
}

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/transactions", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/transactions failed:", err);
  }

  if (!hasExplicitDatabaseUrl) {
    try {
      const proxyRes = await proxyToBackend("/api/admin/transactions", request);
      if (proxyRes.ok) {
        return proxyRes;
      }
    } catch (err) {
      console.warn("Proxy to /api/admin/transactions failed:", err);
    }
  }

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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const status = searchParams.get("status") ?? "All";
    const type = searchParams.get("type") ?? "All";
    const studentId = searchParams.get("studentId");

    const allTx = store.listTransactions();
    let transactions = store.listTransactions(search, status, type);
    if (studentId) {
      transactions = transactions.filter((t: any) => String(t.studentId).toLowerCase() === studentId.toLowerCase());
    }

    const borrowRequests = allTx.filter((t: any) => String(t.type || "").toLowerCase() === "borrow");
    const returnRecords = allTx.filter((t: any) => String(t.type || "").toLowerCase() === "return" || t.status === "Returned");
    const reservations = allTx.filter((t: any) => String(t.type || "").toLowerCase() === "reservation");
    const summary = {
      pending: allTx.filter((t: any) => t.status === "Pending").length,
      approved: allTx.filter((t: any) => t.status === "Approved").length,
      declined: allTx.filter((t: any) => t.status === "Declined").length,
      returned: allTx.filter((t: any) => t.status === "Returned").length,
    };
    return NextResponse.json({
      transactions,
      borrowRequests,
      returnRecords,
      reservations,
      transactionHistory: transactions,
      summary,
      allowAdminControl: true,
    });
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const proxyRes = await proxyToBackend("/api/transactions", request, rawBody);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch {}
  try {
    const adminProxyRes = await proxyToBackend("/api/admin/transactions", request, rawBody);
    if (adminProxyRes.ok) {
      return adminProxyRes;
    }
  } catch {}

  try {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const status = body.status || "Pending";
    const durationDays = Number(body.durationDays || 7);
    const dueDate =
      status === "Approved"
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const { rows } = await pool.query(
      `INSERT INTO transactions (
         user_id, student_name, student_id, resource_title, isbn, department, type, status, duration_days, due_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING
         id,
         user_id AS "userId",
         student_name AS "studentName",
         student_id AS "studentId",
         resource_title AS "resourceTitle",
         isbn,
         department,
         type,
         status,
         requested_at AS "requestedAt",
         due_date AS "dueDate",
         duration_days AS "durationDays"`,
      [
        body.userId || null,
        body.studentName || "Student",
        body.studentId || "N/A",
        body.resourceTitle || body.title || "Book",
        body.isbn || "N/A",
        body.department || "Circulation",
        body.type || "Borrow",
        status,
        durationDays,
        dueDate,
      ]
    );

    const transaction = rows[0];
    const session = await getSession().catch(() => null);
    const actorLabel = session ? `${session.role} ${session.name}` : "BookHive Librarian";

    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Created transaction', $2, 'Transactions', $3)`,
        [
          actorLabel,
          transaction.studentName,
          `${transaction.type} request opened for ${transaction.resourceTitle}.`,
        ]
      );
      await pool.query(
        `INSERT INTO activity_logs (message, level) VALUES ($1, 'info')`,
        [`${transaction.type} request created for ${transaction.studentName}`]
      );
    } catch {}

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (err: any) {
    console.error("Direct DB createTransaction error:", err);
    return NextResponse.json({ message: err?.message || "Failed to create transaction." }, { status: 500 });
  }
}
