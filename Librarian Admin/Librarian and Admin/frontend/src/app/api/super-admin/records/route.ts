import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { pool } from "@/lib/db";
import { adminRepository } from "@/lib/admin/repository";
import { catalogRepository } from "@/lib/catalog/repository";
import { store } from "@/lib/data/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // 1. First attempt: proxy to Express backend if online and authorized
  try {
    const proxyRes = await proxyToBackend("/api/super-admin/records", request);
    if (proxyRes.ok) {
      const payload = await proxyRes.json();
      if (
        (Array.isArray(payload.users) && payload.users.length > 0) ||
        (Array.isArray(payload.books) && payload.books.length > 0) ||
        (Array.isArray(payload.transactions) && payload.transactions.length > 0) ||
        payload.total > 0
      ) {
        return NextResponse.json(payload);
      }
    }
  } catch (err) {
    console.warn("Proxy to /api/super-admin/records failed, proceeding to direct PostgreSQL query:", err);
  }

  // 2. Second attempt: Query PostgreSQL database directly
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "accounts";
    const roleFilter = searchParams.get("role") || "All";
    const bookStatus = searchParams.get("bookStatus") || "All";
    const txType = searchParams.get("txType") || "All";
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10));
    const offset = (page - 1) * pageSize;

    if (tab === "accounts") {
      const filters: any[] = [];
      const where: string[] = [];

      if (roleFilter && roleFilter !== "All") {
        filters.push(roleFilter);
        where.push(`u.role::text ILIKE $${filters.length}`);
      }

      if (search) {
        filters.push(`%${search}%`);
        const idx = filters.length;
        where.push(`(LOWER(u.name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR LOWER(COALESCE(u.id_number, '')) LIKE $${idx} OR LOWER(COALESCE(u.department, '')) LIKE $${idx})`);
      }

      const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
      const countRes = await pool.query(`SELECT COUNT(*) FROM users u ${whereClause}`, filters);
      const total = Number(countRes.rows[0]?.count || 0);

      const dataFilters = [...filters, pageSize, offset];
      const dataQuery = `
        SELECT
          u.id,
          u.name,
          u.id_number AS "idNumber",
          u.email,
          u.role,
          u.department,
          u.course,
          u.status,
          u.avatar,
          u.qr_code AS "qrCode",
          u.permissions,
          u.last_active AS "lastActive",
          u.created_at AS "createdAt",
          u.updated_at AS "updatedAt"
        FROM users u
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${dataFilters.length - 1} OFFSET $${dataFilters.length}
      `;
      const { rows } = await pool.query(dataQuery, dataFilters);
      return NextResponse.json({ users: rows, total, page, pageSize });
    }

    if (tab === "books") {
      const filters: any[] = [];
      const where: string[] = [];

      if (bookStatus === "Archived") {
        where.push("b.archived_at IS NOT NULL");
      } else if (bookStatus === "Active") {
        where.push("b.archived_at IS NULL AND b.availability = 'Available'");
      } else if (bookStatus === "Reserved") {
        where.push("b.availability = 'Reserved'");
      }

      if (search) {
        filters.push(`%${search}%`);
        const idx = filters.length;
        where.push(`(LOWER(b.title) LIKE $${idx} OR LOWER(b.author) LIKE $${idx} OR LOWER(COALESCE(b.isbn, '')) LIKE $${idx} OR LOWER(COALESCE(b.department, '')) LIKE $${idx})`);
      }

      const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
      const countRes = await pool.query(`SELECT COUNT(*) FROM books b ${whereClause}`, filters);
      const total = Number(countRes.rows[0]?.count || 0);

      const dataFilters = [...filters, pageSize, offset];
      const dataQuery = `
        SELECT
          b.id,
          b.title,
          b.author,
          b.isbn,
          b.department,
          b.category,
          b.shelf_location AS "shelfLocation",
          b.availability,
          b.borrow_count AS "borrowCount",
          b.copies,
          b.archived_at AS "archivedAt",
          b.created_at AS "createdAt"
        FROM books b
        ${whereClause}
        ORDER BY b.created_at DESC
        LIMIT $${dataFilters.length - 1} OFFSET $${dataFilters.length}
      `;
      const { rows } = await pool.query(dataQuery, dataFilters);
      return NextResponse.json({ books: rows, total, page, pageSize });
    }

    if (tab === "transactions") {
      const filters: any[] = [];
      const where: string[] = [];

      if (txType && txType !== "All") {
        filters.push(txType);
        where.push(`t.type = $${filters.length}`);
      }

      if (search) {
        filters.push(`%${search}%`);
        const idx = filters.length;
        where.push(`(LOWER(COALESCE(t.student_name, '')) LIKE $${idx} OR LOWER(COALESCE(t.student_id, '')) LIKE $${idx} OR LOWER(COALESCE(t.resource_title, '')) LIKE $${idx} OR LOWER(COALESCE(t.isbn, '')) LIKE $${idx})`);
      }

      const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
      const countRes = await pool.query(`SELECT COUNT(*) FROM transactions t ${whereClause}`, filters);
      const total = Number(countRes.rows[0]?.count || 0);

      const dataFilters = [...filters, pageSize, offset];
      const dataQuery = `
        SELECT
          t.id,
          t.student_name AS "studentName",
          t.student_id AS "studentId",
          t.resource_title AS "resourceTitle",
          t.isbn,
          t.department,
          t.type,
          t.status,
          t.requested_at AS "requestedAt",
          t.due_date AS "dueDate",
          t.decided_at AS "decidedAt"
        FROM transactions t
        ${whereClause}
        ORDER BY t.requested_at DESC
        LIMIT $${dataFilters.length - 1} OFFSET $${dataFilters.length}
      `;
      const { rows } = await pool.query(dataQuery, dataFilters);
      return NextResponse.json({ transactions: rows, total, page, pageSize });
    }

    return NextResponse.json({ message: "Invalid tab specified." }, { status: 400 });
  } catch (dbError) {
    console.warn("Direct DB records query encountered an issue, trying local repository:", dbError);
  }

  // 3. Third attempt: In-memory/repository fallback
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "accounts";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10));

    if (tab === "books") {
      const data = await catalogRepository.listBooks({ offset: (page - 1) * pageSize, limit: pageSize });
      return NextResponse.json({ books: data.books, total: data.total, page, pageSize });
    }
    if (tab === "accounts") {
      const data = await adminRepository.listUsers({ page, pageSize });
      return NextResponse.json(data);
    }
    const allTx = store.listTransactions();
    const paginated = allTx.slice((page - 1) * pageSize, page * pageSize);
    return NextResponse.json({ transactions: paginated, total: allTx.length, page, pageSize });
  } catch (repoError) {
    console.error("Repository fallback failed:", repoError);
    return NextResponse.json({ users: [], books: [], transactions: [], total: 0, page: 1, pageSize: 12 });
  }
}
