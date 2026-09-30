import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const proxyRes = await proxyToBackend("/api/admin/books", request);
    if (proxyRes.ok) {
      return proxyRes;
    }
  } catch (err) {
    console.warn("Proxy to /api/admin/books failed, using repository fallback:", err);
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const department = searchParams.get("department") ?? "All";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? "10", 10)));
    const offset = (page - 1) * pageSize;
    const archivedOnly = searchParams.get("archivedOnly") === "true";
    const sortBy = searchParams.get("sortBy") ?? "";

    // 1. First try direct PostgreSQL database query
    try {
      const filters: any[] = [];
      const whereClauses: string[] = [];

      if (department !== "All") {
        filters.push(department);
        whereClauses.push(`department = $${filters.length}`);
      }

      if (archivedOnly) {
        whereClauses.push("archived_at IS NOT NULL");
      } else {
        whereClauses.push("archived_at IS NULL");
      }

      if (search) {
        filters.push(`%${search.toLowerCase()}%`);
        const idx = filters.length;
        whereClauses.push(`(
          lower(title) LIKE $${idx}
          OR lower(author) LIKE $${idx}
          OR lower(isbn) LIKE $${idx}
          OR lower(summary) LIKE $${idx}
          OR lower(genres) LIKE $${idx}
        )`);
      }

      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
      const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM books ${whereClause}`, filters);
      const total = countRes.rows[0]?.total ?? 0;

      filters.push(pageSize, offset);
      const limitIdx = filters.length - 1;
      const offsetIdx = filters.length;

      let orderClause = "ORDER BY borrow_count DESC, title ASC";
      if (sortBy === "recent" || sortBy === "newest") {
        orderClause = "ORDER BY created_at DESC, id DESC";
      }

      const booksRes = await pool.query(
        `SELECT * FROM books ${whereClause} ${orderClause} LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        filters
      );

      const books = booksRes.rows.map((row: any) => ({
        id: String(row.id),
        title: row.title,
        author: row.author,
        isbn: row.isbn,
        department: row.department,
        category: row.category,
        shelfLocation: row.shelf_location,
        publishedDate: row.publication_date ?? (row.published_date ? new Date(row.published_date).toISOString().split("T")[0] : ""),
        archived: row.archived_at !== null && row.archived_at !== undefined,
        archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
        availability: row.availability ?? "Available",
        borrowCount: row.borrow_count ?? 0,
        copies: row.copies ?? 1,
        apaCitation: row.apa_citation ?? `${row.author}. (${(row.publication_date || "").substring(0, 4)}). ${row.title}.`,
        summary: row.summary ?? "",
        coverImg: row.cover_img ?? "",
      }));

      return NextResponse.json({ books, total, page, pageSize });
    } catch (dbErr) {
      console.warn("Direct DB book query failed, falling back to adminRepository:", dbErr);
    }

    // 2. Repository fallback with proper status
    const status = archivedOnly ? "Archived" : "Available";
    const data = await adminRepository.listBooks({ search, department, status, page, pageSize, sortBy });
    return NextResponse.json(data);
  } catch (fallbackError) {
    console.error("Admin books list fallback error:", fallbackError);
    return NextResponse.json({ books: [], total: 0 });
  }
}

export async function POST(request: Request) {
  return proxyToBackend("/api/admin/books", request);
}
