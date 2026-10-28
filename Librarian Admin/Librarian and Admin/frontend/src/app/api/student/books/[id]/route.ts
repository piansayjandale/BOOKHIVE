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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = decodeURIComponent(id).trim();

    const { searchParams } = new URL(request.url);
    const titleFilter = (searchParams.get("title") || "").trim();
    const isbnFilter = (searchParams.get("isbn") || "").trim();

    // 1. Fetch book record by id, isbn, or title
    const bookRes = await pool.query(
      `SELECT 
        id::text AS "id",
        title,
        author,
        isbn,
        department,
        category,
        shelf_location AS "shelfLocation",
        shelf_location AS "shelf",
        summary,
        summary AS "description",
        rating,
        cover_img AS "coverImg",
        cover_img AS "cover_img",
        cover_img AS "coverUrl",
        cover_img AS "coverImage",
        genres,
        language,
        publisher,
        publication_date AS "publicationDate",
        published_date AS "publishedDate",
        pages,
        volume,
        edition,
        accession_number AS "accessionNumber",
        borrow_count AS "borrowCount",
        copies,
        availability
      FROM books
      WHERE id::text = $1 
         OR (isbn IS NOT NULL AND isbn != '' AND isbn != 'N/A' AND (isbn = $1 OR (LOWER($2) != '' AND isbn = $2)))
         OR LOWER(title) = LOWER($1)
         OR (LOWER($3) != '' AND LOWER(title) = LOWER($3))
      LIMIT 1`,
      [cleanId, isbnFilter, titleFilter]
    );

    const book = bookRes.rows[0] || null;
    const targetTitle = book ? book.title : (titleFilter || cleanId);
    const targetIsbn = book ? book.isbn : (isbnFilter || "");

    // 2. Query ledger and live active transaction counts for this book
    const txQuery = `
      SELECT
        t.id,
        COALESCE(NULLIF(t.student_name, ''), u.name, 'Student Borrower') AS "borrowerName",
        COALESCE(NULLIF(t.student_name, ''), u.name, 'Student Borrower') AS "studentName",
        t.student_id AS "studentId",
        t.user_id AS "userId",
        COALESCE(t.requested_at, t.decided_at) AS "borrowDate",
        t.requested_at AS "requestedAt",
        t.decided_at AS "decidedAt",
        t.due_date AS "dueDate",
        t.picked_up_at AS "pickedUpAt",
        CASE WHEN t.picked_up_at IS NOT NULL THEN true ELSE false END AS "isPickedUp",
        t.status,
        t.type
      FROM transactions t
      LEFT JOIN users u ON (t.user_id = u.id OR (t.student_id IS NOT NULL AND LOWER(t.student_id) = LOWER(u.id_number)))
      WHERE (
        (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = $1)
        OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER($2))
      )
      AND t.status IN ('Approved', 'Returned', 'Borrowed', 'Overdue', 'Pending')
      ORDER BY COALESCE(t.decided_at, t.requested_at) DESC
      LIMIT 10
    `;

    const countQuery = `
      SELECT
        COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending', 'Borrowed', 'Overdue') THEN 1 END)::int AS "borrowedCount",
        COUNT(CASE WHEN (t.type = 'Reservation' OR t.type = 'Reserve') AND t.status IN ('Approved', 'Pending') AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END)::int AS "heldCount",
        COUNT(CASE WHEN (t.type = 'Reservation' OR t.type = 'Reserve') AND t.status IN ('Approved', 'Pending') AND (t.available_at IS NULL OR t.expires_at <= NOW()) THEN 1 END)::int AS "waitlistCount",
        COUNT(CASE WHEN (t.type = 'Reservation' OR t.type = 'Reserve') AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END)::int AS "reservedCount"
      FROM transactions t
      WHERE (
        (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = $1)
        OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER($2))
      )
    `;

    const [txRes, countRes] = await Promise.all([
      pool.query(txQuery, [targetIsbn, targetTitle]).catch(() => ({ rows: [] })),
      pool.query(countQuery, [targetIsbn, targetTitle]).catch(() => ({ rows: [] })),
    ]);

    const ledger = txRes.rows || [];
    const counts = countRes.rows[0] || {};
    const activeLoan = ledger.find((t: any) => t.type === "Borrow" && ["Approved", "Borrowed", "Overdue", "Pending"].includes(t.status)) || null;
    const borrowedCount = Math.max(Number(counts.borrowedCount || 0), Number(book?.borrowed_count || 0), Number(book?.borrowedCount || 0));
    const heldCount = Number(counts.heldCount || 0);
    const waitlistCount = Number(counts.waitlistCount || 0);
    const reservedCount = Math.max(Number(counts.reservedCount || 0), Number(book?.reserved_count || 0), Number(book?.reservedCount || 0));
    const nextQueuePosition = waitlistCount + 1;

    const totalCopies = Math.max(1, Number(book?.copies || 1));
    const unavailableCopies = Math.min(totalCopies, borrowedCount);
    const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
    const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
    const isAvailable = availableCopies > 0;
    const status = isAvailable ? "Available" : reservedCount > 0 ? "Reserved" : "Unavailable";

    const pubDate =
      book?.publicationDate ||
      (book?.publishedDate ? new Date(book.publishedDate).toISOString().split("T")[0] : "");

    const resultBook = {
      ...(book || {
        id: cleanId,
        title: targetTitle,
        author: "Unknown Author",
        isbn: targetIsbn || "N/A",
        department: "Circulation",
        category: "General",
        summary: "",
        description: "",
        rating: 4.8,
        borrowCount: 0,
      }),
      publicationDate: pubDate,
      publishedDate: pubDate,
      year: pubDate ? String(pubDate).substring(0, 4) : "",
      totalCopies,
      copies: totalCopies,
      borrowedCount,
      unavailableCopies,
      heldCount,
      waitlistCount,
      reservedCount,
      reservedCopies,
      nextQueuePosition,
      availableCopies,
      isAvailable,
      status,
      availability: status,
      ledger,
      activeLoan,
    };

    return NextResponse.json(
      { book: resultBook },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Get Book API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to load book." },
      { status: 500, headers: corsHeaders }
    );
  }
}
