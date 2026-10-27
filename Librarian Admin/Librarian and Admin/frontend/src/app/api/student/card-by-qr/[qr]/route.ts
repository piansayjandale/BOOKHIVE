import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { FALLBACK_USERS_ROSTER } from "@/lib/data/users-roster";

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
  { params }: { params: Promise<{ qr: string }> }
) {
  try {
    const { qr } = await params;
    let cleanId = decodeURIComponent(qr).trim();

    if (cleanId.startsWith("http://") || cleanId.startsWith("https://")) {
      try {
        const parsed = new URL(cleanId);
        const queryQr =
          parsed.searchParams.get("qr") ||
          parsed.searchParams.get("studentId") ||
          parsed.searchParams.get("idNumber");
        if (queryQr) {
          cleanId = queryQr.trim();
        } else {
          const segments = parsed.pathname.split("/").filter(Boolean);
          const verifyIdx = segments.findIndex(
            (s) => s === "verify" || s === "card-by-qr" || s === "qr" || s === "student"
          );
          if (verifyIdx !== -1 && segments[verifyIdx + 1]) {
            cleanId = decodeURIComponent(segments[verifyIdx + 1]).trim();
          } else if (segments.length > 0) {
            cleanId = decodeURIComponent(segments[segments.length - 1]).trim();
          }
        }
      } catch {
        const match = cleanId.match(/\/(?:verify|card-by-qr|qr|student)\/([^/?#]+)/i);
        if (match && match[1]) cleanId = decodeURIComponent(match[1]).trim();
      }
    }
    if (cleanId.startsWith("bookhive://student/")) {
      cleanId = cleanId.replace("bookhive://student/", "").trim();
    }
    if (cleanId.startsWith("{")) {
      try {
        const p = JSON.parse(cleanId);
        const idVal = p.qrCode || p.qr || p.idNumber || p.studentId || p.id;
        if (idVal) cleanId = String(idVal).trim();
      } catch {}
    }

    let student: any = null;

    try {
      const { rows } = await pool.query(
        `SELECT 
          id::text AS "id",
          name,
          name AS "fullName",
          email,
          role,
          id_number AS "idNumber",
          id_number AS "studentId",
          department,
          course,
          year_level AS "yearLevel",
          section,
          avatar,
          qr_code AS "qrCode",
          status,
          school_id_front AS "schoolIdFront",
          school_id_back AS "schoolIdBack",
          library_id_front AS "libraryIdFront",
          library_id_back AS "libraryIdBack"
        FROM users
        WHERE LOWER(id_number) = LOWER($1)
           OR LOWER(email) = LOWER($1)
           OR LOWER(name) = LOWER($1)
           OR id::text = $1
           OR qr_code::text = $1
           OR regexp_replace(lower(COALESCE(id_number, '')), '[^a-z0-9]', '', 'g') = regexp_replace(lower($1), '[^a-z0-9]', '', 'g')
        LIMIT 1`,
        [cleanId]
      );
      if (rows && rows.length > 0) {
        student = rows[0];
      }
    } catch (dbErr: any) {
      console.warn("[Card By QR API] Database notice, checking local roster:", dbErr.message);
    }

    if (!student) {
      const low = cleanId.toLowerCase();
      const unhyphenated = low.replace(/[^a-z0-9]/g, "");
      const match = FALLBACK_USERS_ROSTER.find(
        (u) =>
          u.id === cleanId ||
          (u.qrCode && u.qrCode === cleanId) ||
          (u.idNumber && u.idNumber.toLowerCase() === low) ||
          (unhyphenated && u.idNumber && u.idNumber.toLowerCase().replace(/[^a-z0-9]/g, "") === unhyphenated) ||
          u.email.toLowerCase() === low ||
          u.name.toLowerCase() === low
      );
      if (match) {
        student = {
          ...match,
          fullName: match.name,
          studentId: match.idNumber,
        };
      }
    }

    if (!student) {
      return NextResponse.json(
        { message: "Student card not found." },
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch student's active loans & history
    let txRows: any[] = [];
    try {
      const txRes = await pool.query(
        `SELECT
          t.id::text AS "id",
          t.user_id::text AS "userId",
          t.student_name AS "studentName",
          t.student_id AS "studentId",
          t.department,
          t.isbn,
          t.resource_title AS "resourceTitle",
          t.resource_title AS "title",
          t.type::text AS "type",
          t.status::text AS "status",
          t.requested_at::text AS "requestedAt",
          t.due_date::text AS "dueDate",
          t.available_at::text AS "availableAt",
          t.expires_at::text AS "expiresAt",
          t.picked_up_at::text AS "pickedUpAt",
          t.created_at::text AS "createdAt"
         FROM transactions t
         WHERE (t.user_id::text = $1 OR LOWER(t.student_id) = LOWER($2) OR LOWER(t.student_name) = LOWER($3))
           AND (
             (t.type::text IN ('Borrow', 'Borrowing') AND t.status::text IN ('Approved', 'On Loan', 'Picked Up', 'Returned', 'Completed'))
             OR (t.type::text = 'Reservation' AND t.status::text IN ('Approved', 'Reserved'))
           )
         ORDER BY t.requested_at DESC
         LIMIT 50`,
        [student.id, student.idNumber, student.name]
      );
      txRows = txRes.rows;
    } catch (dbErr: any) {
      console.warn("[Card By QR API] Cloud DB notice, using seedTransactions fallback:", dbErr.message);
      const { seedTransactions } = await import("@/lib/data/seed");
      txRows = (seedTransactions || []).filter(
        (t: any) =>
          (t.studentId && t.studentId.toLowerCase() === (student.idNumber || "").toLowerCase()) ||
          (t.studentName && t.studentName.toLowerCase() === (student.name || "").toLowerCase())
      );
    }

    const libraryCard = txRows.map((tx: any) => {
      const isReservation = tx.type === "Reservation";
      const isReturned = tx.status === "Returned" || tx.status === "Completed";
      const isNowAvailable =
        isReservation && Boolean(tx.availableAt && (!tx.expiresAt || new Date(tx.expiresAt) > new Date()));

      let dueReturnDate = tx.dueDate ? new Date(tx.dueDate).toISOString().split("T")[0] : "—";
      let highlightType: "none" | "green" | "violet" | "red" = "none";

      if (!isReturned) {
        if (isReservation) {
          dueReturnDate = "Reservation";
          highlightType = "violet";
        } else {
          const isDue =
            tx.dueDate &&
            (() => {
              const d = new Date(tx.dueDate);
              if (isNaN(d.getTime())) return false;
              const now = new Date();
              const dueDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
              return dueDayStart <= todayStart;
            })();
          highlightType = isDue ? "red" : "green";
        }
      } else {
        dueReturnDate = "Returned";
        highlightType = "none";
      }

      let resolvedStatus = tx.status || "Approved";
      if (isReturned) {
        resolvedStatus = tx.status || "Returned";
      } else if (isReservation) {
        resolvedStatus = isNowAvailable ? "Borrow" : "Reservation";
      } else if (tx.pickedUpAt) {
        resolvedStatus = "Picked Up";
      }

      return {
        id: tx.id,
        bookTitle: tx.resourceTitle || tx.title || "Unknown Book",
        borrowDate: tx.requestedAt ? new Date(tx.requestedAt).toISOString().split("T")[0] : "—",
        dueReturnDate,
        status: resolvedStatus,
        type: tx.type,
        action: isReservation ? "Reserve" : "Borrow",
        available: isNowAvailable,
        availableAt: tx.availableAt,
        expiresAt: tx.expiresAt,
        pickedUpAt: tx.pickedUpAt,
        isPickedUp: !isReturned && Boolean(tx.pickedUpAt),
        highlightType,
      };
    });

    // Fetch strictly active Reservations (Approved/Reserved)
    let reservedBooks: any[] = [];
    try {
      const resQuery = await pool.query(
        `SELECT
          t.id::text AS "id",
          t.resource_title AS "bookTitle",
          t.requested_at AS "reserveDate",
          t.status::text AS "status",
          t.type::text AS "type",
          t.available_at AS "availableAt"
         FROM transactions t
         WHERE (t.user_id::text = $1 OR LOWER(t.student_id) = LOWER($2))
           AND t.type::text = 'Reservation'
           AND t.status::text IN ('Approved', 'Reserved')
           AND t.picked_up_at IS NULL
         ORDER BY t.requested_at DESC`,
        [student.id, student.idNumber]
      );
      reservedBooks = resQuery.rows.map((r: any) => ({
        id: r.id,
        bookTitle: r.bookTitle || "Reserved Book",
        reserveDate: r.reserveDate ? new Date(r.reserveDate).toISOString().split("T")[0] : "—",
        status: r.status,
        type: "Reservation",
        available: Boolean(r.availableAt),
      }));
    } catch {
      reservedBooks = libraryCard
        .filter((c: any) => c.type === "Reservation" && c.status !== "Returned")
        .map((r: any) => ({
          id: r.id,
          bookTitle: r.bookTitle || "Reserved Book",
          reserveDate: r.borrowDate || "—",
          status: r.status,
          type: "Reservation",
          available: Boolean(r.available),
        }));
    }

    // Fetch pending requests (Pending / Waitlisted)
    let pendingBooks: any[] = [];
    try {
      const pendingRes = await pool.query(
        `SELECT
          t.id::text AS "id",
          t.resource_title AS "bookTitle",
          t.requested_at AS "requestDate",
          t.status::text AS "status",
          t.type::text AS "type"
         FROM transactions t
         WHERE (t.user_id::text = $1 OR LOWER(t.student_id) = LOWER($2))
           AND t.status::text IN ('Pending', 'Waitlisted')
         ORDER BY t.requested_at DESC`,
        [student.id, student.idNumber]
      );
      pendingBooks = pendingRes.rows.map((p: any) => ({
        id: p.id,
        bookTitle: p.bookTitle || "Pending Book",
        requestDate: p.requestDate ? new Date(p.requestDate).toISOString().split("T")[0] : "—",
        status: p.status,
        type: p.type,
      }));
    } catch {}

    // Fetch violations + compute overdue items
    const violations: any[] = [];
    try {
      const violRes = await pool.query(
        `SELECT id::text AS id, reason, fine_amount AS "fineAmount", status, created_at AS "createdAt"
         FROM violations
         WHERE user_id::text = $1
         ORDER BY created_at DESC`,
        [student.id]
      );
      for (const v of violRes.rows) {
        violations.push(v);
      }
    } catch {}

    for (const tx of txRows) {
      if (tx.type === "Borrow" && tx.status === "Approved" && tx.dueDate) {
        const due = new Date(tx.dueDate);
        if (!isNaN(due.getTime()) && due.getTime() < Date.now()) {
          const daysOverdue = Math.max(1, Math.ceil((Date.now() - due.getTime()) / (24 * 60 * 60 * 1000)));
          violations.push({
            id: `overdue-${tx.id}`,
            bookTitle: tx.resourceTitle || tx.title || "Overdue Book",
            reason: `Overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}`,
            daysOverdue,
            fineAmount: daysOverdue * 50,
            status: "Unresolved",
          });
        }
      }
    }

    return NextResponse.json(
      {
        student,
        libraryCard,
        reservedBooks,
        pendingBooks,
        violations,
        transactions: txRows,
        borrowHistory: txRows,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Card By QR API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Failed to resolve student card." },
      { status: 500, headers: corsHeaders }
    );
  }
}
