import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/proxy";
import { adminRepository } from "@/lib/admin/repository";
import { getSession } from "@/lib/auth";
import { hasExplicitDatabaseUrl, pool } from "@/lib/db";

export const runtime = "nodejs";

function mapDbBookRow(row: any) {
  const pubDate =
    row.publication_date ??
    (row.published_date ? new Date(row.published_date).toISOString().split("T")[0] : "");
  return {
    id: String(row.id),
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    department: row.department,
    category: row.category || "General",
    shelfLocation: row.shelf_location,
    publishedDate: pubDate,
    publicationDate: pubDate,
    archived: row.archived_at !== null && row.archived_at !== undefined,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    availability: row.availability ?? "Available",
    borrowCount: Number(row.borrow_count ?? 0),
    borrowedCount: Number(row.borrowedCount ?? 0),
    reservedCount: Number(row.reservedCount ?? 0),
    copies: Number(row.copies ?? 1),
    apaCitation: row.apa_citation ?? `${row.author}. (${(pubDate || "").substring(0, 4)}). ${row.title}.`,
    summary: row.summary ?? "",
    genres: row.genres ?? "",
    language: row.language ?? "English",
    publisher: row.publisher ?? "",
    pages: Number(row.pages ?? 0),
    rating: Number(row.rating ?? 4.0),
    aiScore: Number(row.ai_score ?? 70),
    volume: row.volume ?? "Vol. 1",
    edition: row.edition ?? "1st Edition",
    accessionNumber: row.accession_number ?? undefined,
    price: row.price !== undefined && row.price !== null ? Number(row.price) : 0,
    coverImg: row.cover_img ?? "",
    coverImage: row.cover_img ?? "",
    coverUrl: row.cover_img ?? "",
  };
}

export async function GET(request: Request) {
  if (!hasExplicitDatabaseUrl) {
    try {
      const proxyRes = await proxyToBackend("/api/admin/books", request);
      if (proxyRes.ok) {
        return proxyRes;
      }
    } catch (err) {
      console.warn("Proxy to /api/admin/books failed, using repository fallback:", err);
    }
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const searchField = (searchParams.get("searchField") || searchParams.get("filterType") || "title").toLowerCase();
    const department = searchParams.get("department") ?? "All";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get("pageSize") ?? searchParams.get("limit") ?? "10", 10)));
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : (page - 1) * pageSize;
    const archivedOnly = searchParams.get("archivedOnly") === "true";
    const includeArchived = searchParams.get("includeArchived") === "true";
    const sortBy = searchParams.get("sortBy") ?? "";

    try {
      const filters: any[] = [];
      const whereClauses: string[] = [];

      if (department !== "All") {
        filters.push(department);
        whereClauses.push(`b.department = $${filters.length}`);
      }

      if (archivedOnly) {
        whereClauses.push("b.archived_at IS NOT NULL");
      } else if (!includeArchived) {
        whereClauses.push("b.archived_at IS NULL");
      }

      let searchFilterParamIndex: number | null = null;
      let exactSearchParamIndex: number | null = null;
      let prefixSearchParamIndex: number | null = null;

      if (search) {
        filters.push(`%${search.toLowerCase()}%`);
        searchFilterParamIndex = filters.length;

        if (searchField === "title") {
          whereClauses.push(`lower(b.title) LIKE $${searchFilterParamIndex}`);
        } else if (searchField === "author") {
          whereClauses.push(`lower(b.author) LIKE $${searchFilterParamIndex}`);
        } else if (searchField === "isbn") {
          whereClauses.push(`lower(b.isbn) LIKE $${searchFilterParamIndex}`);
        } else {
          whereClauses.push(`(
            lower(b.title) LIKE $${searchFilterParamIndex}
            OR lower(b.author) LIKE $${searchFilterParamIndex}
            OR lower(b.isbn) LIKE $${searchFilterParamIndex}
            OR lower(b.summary) LIKE $${searchFilterParamIndex}
            OR lower(b.genres) LIKE $${searchFilterParamIndex}
          )`);
        }
      }

      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
      const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM books b ${whereClause}`, filters);
      const total = countRes.rows[0]?.total ?? 0;

      let addedToday = 0;
      try {
        const todayRes = await pool.query(`SELECT COUNT(*)::int as count FROM books WHERE created_at >= CURRENT_DATE`);
        addedToday = todayRes.rows[0]?.count ?? 0;
      } catch {}

      if (search) {
        filters.push(search.toLowerCase());
        exactSearchParamIndex = filters.length;
        filters.push(`${search.toLowerCase()}%`);
        prefixSearchParamIndex = filters.length;
      }

      filters.push(pageSize, offset);
      const limitIdx = filters.length - 1;
      const offsetIdx = filters.length;

      let orderClause = "ORDER BY b.borrow_count DESC, b.title ASC";
      if (search && exactSearchParamIndex && prefixSearchParamIndex && searchFilterParamIndex) {
        orderClause = `ORDER BY 
          CASE 
            WHEN lower(b.title) = $${exactSearchParamIndex} THEN 1 
            WHEN lower(b.title) LIKE $${prefixSearchParamIndex} THEN 2 
            WHEN lower(b.title) LIKE $${searchFilterParamIndex} THEN 3 
            ELSE 4 
          END, 
          b.borrow_count DESC, 
          b.title ASC`;
      } else if (sortBy === "recent" || sortBy === "newest") {
        orderClause = "ORDER BY b.created_at DESC, b.id DESC";
      }

      const booksQuery = `
        WITH paged_books AS (
          SELECT b.*
          FROM books b
          ${whereClause}
          ${orderClause}
          LIMIT $${limitIdx} OFFSET $${offsetIdx}
        )
        SELECT
          b.*,
          COALESCE((
            SELECT COUNT(*)::int
            FROM transactions t
            WHERE t.type = 'Borrow' AND t.status IN ('Approved', 'Pending')
              AND ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
                OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title)))
          ), 0) AS "borrowedCount",
          COALESCE((
            SELECT COUNT(*)::int
            FROM transactions t
            WHERE t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW())
              AND ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
                OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title)))
          ), 0) AS "reservedCount"
        FROM paged_books b
        ${orderClause}
      `;

      const booksRes = await pool.query(booksQuery, filters);
      const books = booksRes.rows.map(mapDbBookRow);

      return NextResponse.json({ books, total, page, pageSize, addedToday });
    } catch (dbErr) {
      console.warn("Direct DB book query failed, falling back to adminRepository:", dbErr);
    }

    const status = archivedOnly ? "Archived" : "Available";
    const data = await adminRepository.listBooks({ search, searchField, department, status, page, pageSize, sortBy });
    return NextResponse.json(data);
  } catch (fallbackError) {
    console.error("Admin books list fallback error:", fallbackError);
    return NextResponse.json({ books: [], total: 0, addedToday: 0 });
  }
}

export async function POST(request: Request) {
  const rawBodyText = await request.text();
  let body: any = {};
  try {
    if (rawBodyText) body = JSON.parse(rawBodyText);
  } catch {}

  const res = await proxyToBackend("/api/admin/books", request, rawBodyText);
  const coverUri = body.coverImg || body.coverImage || body.coverUrl || "";
  if (res.ok) {
    if (coverUri) {
      try {
        await pool.query(
          "UPDATE books SET cover_img = $1 WHERE (isbn = $2 AND $2 <> '') OR LOWER(title) = LOWER($3)",
          [coverUri, body.isbn || "", body.title || ""]
        );
      } catch {}
    }
    return res;
  }

  try {
    if (!body.title || !body.author) {
      return NextResponse.json(
        { message: "Book title and author are required." },
        { status: 400 }
      );
    }

    const session = await getSession().catch(() => null);
    const actorName = session ? `${session.role} ${session.name}` : "BookHive Librarian";

    const timestampSeed = `${Date.now()}-${body.title}-${body.author}`;
    const cleanSeed = timestampSeed.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const category = body.category ?? (body.genres?.split(",")[0]?.trim() || "General");
    const publishedDate = body.publishedDate || body.publicationDate || new Date().toISOString().split("T")[0];
    const shelfLocation = body.shelfLocation || `Circulation-SH-${cleanSeed.substring(0, 4).toUpperCase()}`;
    const apaCitation = body.apaCitation || `${body.author}. (${publishedDate.substring(0, 4)}). ${body.title}.`;
    const availability = body.availability ?? "Available";
    const borrowCount = Number(body.borrowCount ?? 0);

    const insertRes = await pool.query(
      `INSERT INTO books (
        title, author, isbn, department, category, shelf_location,
        published_date, summary, apa_citation, availability, borrow_count,
        source, source_book_id, publication_date, series, genres, language,
        publisher, pages, rating, num_ratings, liked_percent, cover_img,
        bbe_score, bbe_votes, ai_score, copies, volume, edition, accession_number,
        price
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        COALESCE($7::date, NOW()::date), $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, $30,
        $31
      ) RETURNING *`,
      [
        body.title,
        body.author,
        body.isbn || "N/A",
        body.department || "Circulation",
        category,
        shelfLocation,
        publishedDate,
        body.summary || "",
        apaCitation,
        availability,
        borrowCount,
        body.source ?? "bookhive-manual",
        body.sourceBookId ?? "",
        body.publicationDate ?? publishedDate,
        body.series ?? "",
        body.genres ?? "",
        body.language ?? "English",
        body.publisher ?? "",
        Number(body.pages ?? 0),
        Number(body.rating ?? 4.0),
        Number(body.numRatings ?? 10),
        Number(body.likedPercent ?? 90),
        coverUri,
        Number(body.bbeScore ?? 0),
        Number(body.bbeVotes ?? 0),
        Number(body.aiScore ?? 70),
        Number(body.copies ?? 1),
        body.volume ?? "Vol. 1",
        body.edition ?? "1st Edition",
        body.accessionNumber ?? null,
        body.price ? Number(String(body.price).replace(/,/g, "")) : 0.0,
      ]
    );

    const createdBook = mapDbBookRow(insertRes.rows[0]);

    try {
      await pool.query(
        `INSERT INTO history_logs (actor, action, target, module, detail)
         VALUES ($1, 'Added new book', $2, 'Records', $3)`,
        [actorName, createdBook.title, `Catalog record created at shelf ${createdBook.shelfLocation}.`]
      );
      await pool.query(
        `INSERT INTO activity_logs (message, level) VALUES ($1, 'success')`,
        [`Book added: ${createdBook.title}`]
      );
    } catch {}

    return NextResponse.json({ book: createdBook, record: createdBook }, { status: 201 });
  } catch (err: any) {
    console.error("Direct DB addBook error:", err);
    return NextResponse.json(
      { message: err?.message || "Failed to add book." },
      { status: 500 }
    );
  }
}
