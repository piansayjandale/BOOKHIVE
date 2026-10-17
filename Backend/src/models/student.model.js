function warnIfNotOffline(label, error) {
  const errObj = typeof error === "string" ? { message: error } : (error || {});
  const msg = (errObj.message || String(error || "")).toLowerCase();
  const code = errObj.code || "";

  if (
    code !== "DB_OFFLINE" &&
    !msg.includes("offline") &&
    !msg.includes("password authentication failed") &&
    !msg.includes("connect econnrefused") &&
    !msg.includes("does not support ssl")
  ) {
    console.warn(label, errObj.message || error);
  }
}

import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";

// In-memory fallback user store for development and offline database resiliency
const inMemoryUsers = new Map();

function initInMemoryUsers() {
  const defaultAccounts = [
    {
      id: "usr-jandale-001",
      name: "Jandale Piansay",
      email: "jandale.653705@wnu.sti.edu.ph",
      idNumber: "653705",
      department: "College of Information and Communications Technology",
      course: "BS in Information Technology",
      password: "jandalepiansay2005",
      role: "Student",
      status: "Active",
      qrCode: "e1a10001-6537-4050-8000-000000000001",
    },
    {
      id: "usr-piansay-002",
      name: "Jandale Piansay",
      email: "piansay.653705@wnu.sti.edu.ph",
      idNumber: "653705",
      department: "College of Information and Communications Technology",
      course: "BS in Information Technology",
      password: "jandalepiansay2005",
      role: "Student",
      status: "Active",
      qrCode: "e1a10002-6537-4050-8000-000000000002",
    },
    {
      id: "usr-student-003",
      name: "STI Student",
      email: "student@sti.edu.ph",
      idNumber: "STI-2026-001",
      department: "WNU STI",
      course: "General Program",
      password: "student123",
      role: "Student",
      status: "Active",
      qrCode: "e1a10003-2026-4050-8000-000000000003",
    },
    {
      id: "usr-student-004",
      name: "STI Student",
      email: "student@wnu.sti.edu.ph",
      idNumber: "STI-2026-002",
      department: "WNU STI",
      course: "General Program",
      password: "student123",
      role: "Student",
      status: "Active",
      qrCode: "e1a10004-2026-4050-8000-000000000004",
    },
  ];

  for (const acc of defaultAccounts) {
    const passwordHash = bcrypt.hashSync(acc.password, 10);
    inMemoryUsers.set(acc.email.toLowerCase(), {
      ...acc,
      passwordHash,
    });
    if (acc.qrCode) {
      inMemoryUsers.set(acc.qrCode.toLowerCase(), {
        ...acc,
        passwordHash,
      });
    }
  }
}

initInMemoryUsers();

export const studentModel = {
  async createUser(input) {
    const normalizedEmail = (input.email || "").trim().toLowerCase();
    let createdUser = null;

    try {
      const query = `
        INSERT INTO users (name, id_number, email, password_hash, role, department, course, year_level, section, status, avatar, qr_code)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active',$10, gen_random_uuid())
        RETURNING
          id,
          name,
          email,
          role,
          id_number AS "idNumber",
          department,
          course,
          year_level AS "yearLevel",
          section,
          status,
          avatar,
          qr_code AS "qrCode"
      `;

      const { rows } = await pool.query(query, [
        input.name,
        input.idNumber,
        normalizedEmail,
        input.passwordHash,
        input.role || "Student",
        input.department,
        input.course,
        input.yearLevel || input.year_level || null,
        input.section || null,
        input.avatar || null,
      ]);

      if (rows[0]) {
        createdUser = { ...rows[0], passwordHash: input.passwordHash };
      }
    } catch (error) {
      if (error.code === '23505' && (error.message?.includes('id_number') || error.constraint === 'users_id_number_key')) {
        const retryId = `TEMP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        try {
          const query = `
            INSERT INTO users (name, id_number, email, password_hash, role, department, course, year_level, section, status, avatar, qr_code)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active',$10, gen_random_uuid())
            RETURNING
              id,
              name,
              email,
              role,
              id_number AS "idNumber",
              department,
              course,
              year_level AS "yearLevel",
              section,
              status,
              avatar,
              qr_code AS "qrCode"
          `;
          const retryRes = await pool.query(query, [
            input.name,
            retryId,
            normalizedEmail,
            input.passwordHash,
            input.role || "Student",
            input.department,
            input.course,
            input.yearLevel || input.year_level || null,
            input.section || null,
            input.avatar || null,
          ]);
          if (retryRes.rows[0]) {
            createdUser = { ...retryRes.rows[0], passwordHash: input.passwordHash };
          }
        } catch (retryErr) {
          warnIfNotOffline("DB student:createUser retry failed:", retryErr.message);
        }
      } else {
        warnIfNotOffline("DB student:createUser unavailable, using in-memory store:", error.message);
      }
    }

    if (!createdUser) {
      const fallbackQr = `00000000-0000-4000-8000-${Date.now().toString().slice(-12).padStart(12, '0')}`;
      createdUser = {
        id: `usr-live-${Date.now()}`,
        name: input.name,
        email: normalizedEmail,
        idNumber: input.idNumber,
        department: input.department || "CICT",
        course: input.course || "BSIT",
        yearLevel: input.yearLevel || input.year_level || "4TH",
        section: input.section || "H",
        passwordHash: input.passwordHash,
        role: input.role || "Student",
        status: "Active",
        avatar: input.avatar || null,
        qrCode: fallbackQr,
      };
    }

    inMemoryUsers.set(normalizedEmail, createdUser);
    if (createdUser.qrCode) {
      inMemoryUsers.set(createdUser.qrCode.toLowerCase(), createdUser);
    }
    return createdUser;
  },

  async findUserByEmail(email) {
    const normalizedIdentifier = (email || "").trim().toLowerCase();

    try {
      const query = `
        SELECT
          u.id,
          u.name,
          u.email,
          u.password_hash AS "passwordHash",
          u.role,
          u.id_number AS "idNumber",
          u.department,
          u.course,
          u.year_level AS "yearLevel",
          u.section,
          u.status,
          u.avatar,
          u.qr_code AS "qrCode",
          u.last_active AS "lastActive",
          u.created_at AS "createdAt"
        FROM users u
        WHERE lower(u.email) = lower($1) OR lower(u.id_number) = lower($1) OR u.qr_code::text = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [normalizedIdentifier]);
      if (rows[0]) {
        // Keep in-memory cache updated with DB user
        inMemoryUsers.set(normalizedIdentifier, rows[0]);
        if (rows[0].email) inMemoryUsers.set(rows[0].email.toLowerCase(), rows[0]);
        if (rows[0].idNumber) inMemoryUsers.set(rows[0].idNumber.toLowerCase(), rows[0]);
        if (rows[0].qrCode) inMemoryUsers.set(String(rows[0].qrCode).toLowerCase(), rows[0]);
        return rows[0];
      }
    } catch (error) {
      warnIfNotOffline("DB student:findUserByEmail unavailable, checking in-memory fallback:", error.message);
    }

    return inMemoryUsers.get(normalizedIdentifier) ?? null;
  },

  async updateUserPassword(identifier, newPasswordHash) {
    const normalized = (identifier || "").trim().toLowerCase();
    try {
      const query = `
        UPDATE users
        SET password_hash = $1
        WHERE lower(email) = lower($2) OR lower(id_number) = lower($2)
        RETURNING id, name, email, id_number AS "idNumber", role, qr_code AS "qrCode"
      `;
      const { rows } = await pool.query(query, [newPasswordHash, normalized]);
      if (rows[0]) {
        const user = rows[0];
        const cached = inMemoryUsers.get(normalized);
        if (cached) {
          cached.passwordHash = newPasswordHash;
        }
        return user;
      }
    } catch (error) {
      warnIfNotOffline("DB updateUserPassword failed:", error.message);
    }
    const cached = inMemoryUsers.get(normalized);
    if (cached) {
      cached.passwordHash = newPasswordHash;
      return cached;
    }
    return null;
  },

  async getUserProfile(userId) {
    try {
      const query = `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.id_number AS "idNumber",
          u.department,
          u.course,
          u.year_level AS "yearLevel",
          u.section,
          u.status,
          u.avatar,
          u.qr_code AS "qrCode",
          u.created_at AS "createdAt",
          u.last_active AS "lastActive"
        FROM users u
        WHERE u.id::text = $1 OR u.id_number = $1 OR u.qr_code::text = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [userId]);
      return rows[0] ?? null;
    } catch (error) {
      warnIfNotOffline("DB student:getUserProfile unavailable:", error.message);
      return null;
    }
  },

  async getAvailableBooks(page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const query = `
        SELECT
          b.id,
          b.title,
          b.author,
          b.isbn,
          b.cover_img AS "coverUrl",
          b.cover_img AS "coverImage",
          b.summary AS "description",
          b.summary,
          b.rating,
          b.availability AS "status",
          b.availability,
          b.department,
          b.category,
          b.genres,
          b.shelf_location AS "shelfLocation",
          b.shelf_location AS "shelf",
          b.published_date AS "publicationDate",
          TO_CHAR(b.published_date, 'YYYY') AS "year",
          b.pages,
          b.language,
          b.publisher,
          b.volume,
          b.edition,
          b.copies,
          b.accession_number AS "accessionNumber",
          COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending') THEN 1 END), 0)::int AS "borrowedCount",
          COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "heldCount",
          COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "reservedCount"
        FROM books b
        LEFT JOIN transactions t ON (
          (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
          OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
        )
        WHERE b.archived_at IS NULL
        GROUP BY b.id
        ORDER BY b.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const countQuery = `SELECT COUNT(*) FROM books WHERE archived_at IS NULL`;
      
      const [booksResult, countResult] = await Promise.all([
        pool.query(query, [limit, offset]),
        pool.query(countQuery),
      ]);
      
      const books = booksResult.rows.map(b => {
        const totalCopies = Math.max(1, Number(b.copies || 1));
        const borrowedCount = Number(b.borrowedCount || 0);
        const heldCount = Number(b.heldCount || 0);
        const reservedCount = Number(b.reservedCount || 0);
        const unavailableCopies = Math.min(totalCopies, borrowedCount);
        const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
        const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
        const isAvailable = availableCopies > 0;
        const status = isAvailable ? "Available" : (reservedCount > 0 ? "Reserved" : "Unavailable");
        return {
          ...b,
          totalCopies,
          copies: totalCopies,
          borrowedCount,
          unavailableCopies,
          heldCount,
          reservedCount,
          reservedCopies,
          availableCopies,
          isAvailable,
          status,
          availability: status,
        };
      });

      return {
        books,
        total: parseInt(countResult.rows[0].count, 10),
      };
    } catch (error) {
      warnIfNotOffline("DB student:getAvailableBooks unavailable:", error.message);
      return { books: [], total: 0 };
    }
  },

  async getBookById(bookId, extra = {}) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId);
      const titleFilter = extra.title || "";
      const isbnFilter = extra.isbn || "";

      let query = `
        SELECT
          id,
          title,
          author,
          isbn,
          cover_img AS "coverUrl",
          cover_img AS "coverImage",
          summary AS "description",
          summary,
          rating,
          availability AS "status",
          availability,
          department,
          category,
          genres,
          shelf_location AS "shelfLocation",
          shelf_location AS "shelf",
          published_date AS "publicationDate",
          TO_CHAR(published_date, 'YYYY') AS "publicationYear",
          TO_CHAR(published_date, 'YYYY') AS "year",
          pages,
          language,
          publisher,
          volume,
          edition,
          copies,
          accession_number AS "accessionNumber",
          created_at AS "createdAt"
        FROM books
        WHERE archived_at IS NULL
      `;
      let params = [];
      if (isUuid) {
        query += ` AND id = $1 LIMIT 1`;
        params = [bookId];
      } else if (isbnFilter || titleFilter) {
        query += ` AND (isbn = $1 OR LOWER(title) = LOWER($2) OR isbn = $3) LIMIT 1`;
        params = [bookId, titleFilter || bookId, isbnFilter || bookId];
      } else {
        query += ` AND (isbn = $1 OR LOWER(title) = LOWER($1)) LIMIT 1`;
        params = [bookId];
      }

      const { rows } = await pool.query(query, params);
      const book = rows[0] ?? null;

      const targetTitle = book ? book.title : (titleFilter || bookId);
      const targetIsbn = book ? book.isbn : (isbnFilter || "");

      // Query live ledger and counts for this book
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
        LEFT JOIN users u ON (t.user_id = u.id OR (t.student_id IS NOT NULL AND lower(t.student_id) = lower(u.id_number)))
        WHERE (
          (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = $1)
          OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER($2))
        )
        AND t.status::text IN ('Approved', 'Picked Up', 'On Loan', 'Returned', 'Completed')
        ORDER BY COALESCE(t.decided_at, t.requested_at) DESC
        LIMIT 10
      `;
      const countQuery = `
        SELECT
          COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending') THEN 1 END)::int AS "borrowedCount",
          COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END)::int AS "heldCount",
          COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.available_at IS NULL OR t.expires_at <= NOW()) THEN 1 END)::int AS "waitlistCount",
          COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END)::int AS "reservedCount"
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
      const activeLoan = ledger.find(t => t.type === 'Borrow' && t.status === 'Approved') || null;
      const borrowedCount = Number(counts.borrowedCount || 0);
      const heldCount = Number(counts.heldCount || 0);
      const waitlistCount = Number(counts.waitlistCount || 0);
      const reservedCount = Number(counts.reservedCount || 0);
      const nextQueuePosition = waitlistCount + 1;

      if (!book) {
        const totalCopies = 1;
        const unavailableCopies = Math.min(totalCopies, borrowedCount);
        const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
        const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
        const isAvailable = availableCopies > 0;
        const status = isAvailable ? 'Available' : (reservedCount > 0 ? 'Reserved' : 'Unavailable');
        return {
          id: bookId,
          title: targetTitle,
          author: extra.author || "Unknown Author",
          isbn: targetIsbn || "N/A",
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
      }

      const totalCopies = Math.max(1, Number(book.copies || 1));
      const unavailableCopies = Math.min(totalCopies, borrowedCount);
      const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
      const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
      const isAvailable = availableCopies > 0;
      const status = isAvailable ? 'Available' : (reservedCount > 0 ? 'Reserved' : 'Unavailable');

      return {
        ...book,
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
    } catch (error) {
      warnIfNotOffline("DB student:getBookById unavailable:", error.message);
      return null;
    }
  },

  async searchBooks(query, page = 1, limit = 200, mode = "prefix") {
    try {
      const offset = (page - 1) * limit;
      const cleanQuery = query.trim();

      if (!cleanQuery) {
        return { books: [], total: 0 };
      }

      const DEPARTMENTS = [
        "Circulation Section",
        "Filipiniana & Negrosiana Section",
        "General Reference Section",
        "Periodical Section",
        "Engineering & Maritime Section",
        "Technical Section",
        "Archive Section",
        "E-Library / Internet Service Center",
        "Law & Graduate Studies Library",
        "Reserve Section"
      ];

      // Check if the query is exactly a department name (case-insensitive)
      const matchingDept = DEPARTMENTS.find(d => d.toLowerCase() === cleanQuery.toLowerCase());

      if (matchingDept) {
        const sql = `
          SELECT
            b.id,
            b.title,
            b.author,
            b.isbn,
            b.cover_img AS "coverUrl",
            b.cover_img AS "coverImage",
            b.summary AS "description",
            b.summary,
            b.rating,
            b.availability AS "status",
            b.availability,
            b.department,
            b.category,
            b.genres,
            b.shelf_location AS "shelfLocation",
            b.shelf_location AS "shelf",
            b.published_date AS "publicationDate",
            TO_CHAR(b.published_date, 'YYYY') AS "year",
            b.pages,
            b.language,
            b.volume,
            b.edition,
            b.copies,
            b.accession_number AS "accessionNumber",
            COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending') THEN 1 END), 0)::int AS "borrowedCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "heldCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "reservedCount"
          FROM books b
          LEFT JOIN transactions t ON (
            (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
            OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
          )
          WHERE b.archived_at IS NULL 
            AND LOWER(b.department) = LOWER($1)
          GROUP BY b.id
          ORDER BY b.created_at DESC
          LIMIT $2 OFFSET $3
        `;
        const countSql = `
          SELECT COUNT(*) FROM books b
          WHERE b.archived_at IS NULL 
            AND LOWER(b.department) = LOWER($1)
        `;
        
        const [booksResult, countResult] = await Promise.all([
          pool.query(sql, [matchingDept, limit, offset]),
          pool.query(countSql, [matchingDept]),
        ]);

        const books = booksResult.rows.map(b => {
          const totalCopies = Math.max(1, Number(b.copies || 1));
          const borrowedCount = Number(b.borrowedCount || 0);
          const heldCount = Number(b.heldCount || 0);
          const reservedCount = Number(b.reservedCount || 0);
          const unavailableCopies = Math.min(totalCopies, borrowedCount);
          const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
          const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
          const isAvailable = availableCopies > 0;
          const status = isAvailable ? "Available" : (reservedCount > 0 ? "Reserved" : "Unavailable");
          return {
            ...b,
            totalCopies,
            copies: totalCopies,
            borrowedCount,
            unavailableCopies,
            heldCount,
            reservedCount,
            reservedCopies,
            availableCopies,
            isAvailable,
            status,
            availability: status,
          };
        });

        return {
          books,
          total: parseInt(countResult.rows[0].count, 10),
        };
      }

      // Define stop words and conversational filler words
      const STOP_WORDS = new Set([
        "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", 
        "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do", 
        "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", 
        "having", "he", "her", "here", "hers", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", 
        "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", 
        "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", 
        "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", 
        "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "were", "what", "when", 
        "where", "which", "while", "who", "whom", "why", "with", "you", "your", "yours", "yourself", "yourselves",
        "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend",
        "recommended", "looking", "for", "about", "describe", "detail", "details", "analyse", "analyze"
      ]);

      let sql = "";
      let countSql = "";
      let queryParams = [];
      let countQueryParams = [];

      if (mode === "ai") {
        // AI PROMPT & KEYWORD SEARCH MODE
        const allWords = cleanQuery.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
        const meaningfulWords = allWords.filter(w => w.length > 1 && !STOP_WORDS.has(w));
        const keywords = meaningfulWords.length > 0 ? meaningfulWords : allWords;

        if (keywords.length === 0) {
          return { books: [], total: 0 };
        }

        const params = [];
        let pIdx = 1;

        params.push(`%${cleanQuery}%`);
        const phraseParamIdx = pIdx++;

        const kwParams = [];
        for (const kw of keywords.slice(0, 5)) {
          params.push(`%${kw}%`);
          kwParams.push(pIdx++);
        }

        const orClauses = [
          `LOWER(b.title) LIKE LOWER($${phraseParamIdx})`,
          `LOWER(b.author) LIKE LOWER($${phraseParamIdx})`,
        ];

        for (const kIdx of kwParams) {
          orClauses.push(`LOWER(b.title) LIKE LOWER($${kIdx})`);
          orClauses.push(`LOWER(b.author) LIKE LOWER($${kIdx})`);
          orClauses.push(`LOWER(COALESCE(b.summary, '')) LIKE LOWER($${kIdx})`);
          orClauses.push(`LOWER(COALESCE(b.category, '')) LIKE LOWER($${kIdx})`);
          orClauses.push(`LOWER(COALESCE(b.genres, '')) LIKE LOWER($${kIdx})`);
          orClauses.push(`LOWER(COALESCE(b.department, '')) LIKE LOWER($${kIdx})`);
        }

        const whereClause = orClauses.join(" OR ");

        const relevanceCases = [
          `CASE WHEN LOWER(b.title) = LOWER($${phraseParamIdx}) THEN 100 ELSE 0 END`,
          `CASE WHEN LOWER(b.title) LIKE LOWER($${phraseParamIdx}) THEN 60 ELSE 0 END`,
          `CASE WHEN LOWER(b.author) LIKE LOWER($${phraseParamIdx}) THEN 40 ELSE 0 END`,
        ];

        for (const kIdx of kwParams) {
          relevanceCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${kIdx}) THEN 30 ELSE 0 END`);
          relevanceCases.push(`CASE WHEN LOWER(b.author) LIKE LOWER($${kIdx}) THEN 25 ELSE 0 END`);
          relevanceCases.push(`CASE WHEN LOWER(COALESCE(b.category, '')) LIKE LOWER($${kIdx}) THEN 20 ELSE 0 END`);
          relevanceCases.push(`CASE WHEN LOWER(COALESCE(b.genres, '')) LIKE LOWER($${kIdx}) THEN 15 ELSE 0 END`);
          relevanceCases.push(`CASE WHEN LOWER(COALESCE(b.summary, '')) LIKE LOWER($${kIdx}) THEN 10 ELSE 0 END`);
        }

        const relevanceSql = `(${relevanceCases.join(" + ")}) AS relevance`;
        const limitParamIdx = pIdx++;
        const offsetParamIdx = pIdx++;

        sql = `
          SELECT
            b.id,
            b.title,
            b.author,
            b.isbn,
            b.cover_img AS "coverUrl",
            b.cover_img AS "coverImage",
            b.summary AS "description",
            b.summary,
            b.rating,
            b.availability AS "status",
            b.availability,
            b.department,
            b.category,
            b.genres,
            b.shelf_location AS "shelfLocation",
            b.shelf_location AS "shelf",
            b.published_date AS "publicationDate",
            TO_CHAR(b.published_date, 'YYYY') AS "year",
            b.pages,
            b.language,
            b.volume,
            b.edition,
            b.copies,
            b.accession_number AS "accessionNumber",
            COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending') THEN 1 END), 0)::int AS "borrowedCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "heldCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "reservedCount",
            ${relevanceSql}
          FROM books b
          LEFT JOIN transactions t ON (
            (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
            OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
          )
          WHERE b.archived_at IS NULL AND (${whereClause})
          GROUP BY b.id
          ORDER BY relevance DESC, b.title ASC
          LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
        `;

        countSql = `
          SELECT COUNT(*)
          FROM books b
          WHERE b.archived_at IS NULL AND (${whereClause})
        `;

        queryParams = [...params, limit, offset];
        countQueryParams = params;
      } else {
        // STRICT TITLE PREFIX SEARCH MODE (Filter: ON)
        const rawKeywords = cleanQuery.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
        if (!rawKeywords) {
          return { books: [], total: 0 };
        }

        const params = [];
        params.push(`${rawKeywords}%`);       // $1 is prefix: e.g. 'b%' or 'br%'
        params.push(`the ${rawKeywords}%`);   // $2 is 'the b%'
        params.push(`a ${rawKeywords}%`);     // $3 is 'a b%'
        params.push(`an ${rawKeywords}%`);    // $4 is 'an b%'
        params.push(rawKeywords);             // $5 is exact match

        sql = `
          SELECT
            b.id,
            b.title,
            b.author,
            b.isbn,
            b.cover_img AS "coverUrl",
            b.cover_img AS "coverImage",
            b.summary AS "description",
            b.summary,
            b.rating,
            b.availability AS "status",
            b.availability,
            b.department,
            b.category,
            b.genres,
            b.shelf_location AS "shelfLocation",
            b.shelf_location AS "shelf",
            b.published_date AS "publicationDate",
            TO_CHAR(b.published_date, 'YYYY') AS "year",
            b.pages,
            b.language,
            b.volume,
            b.edition,
            b.copies,
            b.accession_number AS "accessionNumber",
            COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status IN ('Approved', 'Pending') THEN 1 END), 0)::int AS "borrowedCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "heldCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "reservedCount",
            (
              CASE WHEN LOWER(b.title) = LOWER($5) THEN 100
                   WHEN LOWER(b.title) LIKE LOWER($1) THEN 90
                   WHEN LOWER(b.title) LIKE LOWER($2) THEN 85
                   ELSE 80 END
            ) AS relevance
          FROM books b
          LEFT JOIN transactions t ON (
            (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
            OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
          )
          WHERE b.archived_at IS NULL 
            AND (
              LOWER(b.title) LIKE LOWER($1)
              OR LOWER(b.title) LIKE LOWER($2)
              OR LOWER(b.title) LIKE LOWER($3)
              OR LOWER(b.title) LIKE LOWER($4)
            )
          GROUP BY b.id
          ORDER BY relevance DESC, b.title ASC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;

        countSql = `
          SELECT COUNT(*)
          FROM books b
          WHERE b.archived_at IS NULL 
            AND (
              LOWER(b.title) LIKE LOWER($1)
              OR LOWER(b.title) LIKE LOWER($2)
              OR LOWER(b.title) LIKE LOWER($3)
              OR LOWER(b.title) LIKE LOWER($4)
            )
        `;

        queryParams = [...params, limit, offset];
        countQueryParams = params.slice(0, 4);
      }

      const [booksResult, countResult] = await Promise.all([
        pool.query(sql, queryParams),
        pool.query(countSql, countQueryParams),
      ]);

      const books = booksResult.rows.map(b => {
        const totalCopies = Math.max(1, Number(b.copies || 1));
        const borrowedCount = Number(b.borrowedCount || 0);
        const heldCount = Number(b.heldCount || 0);
        const reservedCount = Number(b.reservedCount || 0);
        const unavailableCopies = Math.min(totalCopies, borrowedCount);
        const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
        const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
        const isAvailable = availableCopies > 0;
        const status = isAvailable ? "Available" : (reservedCount > 0 ? "Reserved" : "Unavailable");
        return {
          ...b,
          totalCopies,
          copies: totalCopies,
          borrowedCount,
          unavailableCopies,
          heldCount,
          reservedCount,
          reservedCopies,
          availableCopies,
          isAvailable,
          status,
          availability: status,
        };
      });

      return {
        books,
        total: parseInt(countResult.rows[0].count, 10),
      };
    } catch (error) {
      warnIfNotOffline("DB student:searchBooks unavailable:", error);
      return { books: [], total: 0 };
    }
  },

  async getUserBorrowHistory(userId) {
    try {
      const query = `
        SELECT
          t.id,
          COALESCE(b.id::text, t.isbn, t.resource_title) AS "bookId",
          COALESCE(b.title, t.resource_title) AS title,
          COALESCE(b.author, 'STI Library') AS author,
          b.cover_img AS "coverUrl",
          COALESCE(b.summary, '') AS "description",
          COALESCE(b.category, t.department, 'General') AS category,
          COALESCE(b.shelf_location, 'Circulation Shelf') AS "shelf",
          TO_CHAR(COALESCE(b.published_date, t.requested_at), 'YYYY') AS "year",
          COALESCE(b.pages, 320) AS pages,
          COALESCE(b.language, 'EN') AS language,
          COALESCE(b.isbn, t.isbn) AS isbn,
          COALESCE(b.copies, 1)::int AS copies,
          CASE 
            WHEN t.type = 'Reservation' AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 'true'
            WHEN t.type = 'Reservation' AND (
              SELECT GREATEST(0, COALESCE(MAX(b_sub.copies), 1) - COUNT(CASE WHEN sub_t.type = 'Borrow' AND sub_t.status IN ('Approved', 'Pending') THEN 1 END))
              FROM transactions sub_t
              LEFT JOIN books b_sub ON (
                (sub_t.isbn IS NOT NULL AND sub_t.isbn != '' AND sub_t.isbn != 'N/A' AND b_sub.isbn = sub_t.isbn)
                OR (sub_t.resource_title IS NOT NULL AND LOWER(b_sub.title) = LOWER(sub_t.resource_title))
              )
              WHERE (sub_t.isbn = t.isbn OR LOWER(sub_t.resource_title) = LOWER(t.resource_title))
            ) > 0 THEN 'true'
            WHEN t.type = 'Reservation' THEN 'false'
            ELSE COALESCE(b.availability, 'Available')
          END AS "available",
          t.type,
          t.status,
          t.requested_at AS "requestedAt",
          t.due_date AS "dueDate",
          t.decided_at AS "decidedAt",
          t.comment AS "comment",
          t.available_at AS "availableAt",
          t.expires_at AS "expiresAt",
          t.picked_up_at AS "pickedUpAt",
          CASE WHEN t.picked_up_at IS NOT NULL THEN true ELSE false END AS "isPickedUp",
          CASE 
            WHEN (t.type = 'Reservation' OR (t.type = 'Borrow' AND t.status = 'Approved' AND t.picked_up_at IS NULL)) AND t.expires_at IS NOT NULL 
            THEN GREATEST(0, EXTRACT(EPOCH FROM (t.expires_at - NOW())))::int 
            ELSE NULL 
          END AS "claimDeadlineRemainingSeconds",
          CASE WHEN t.status = 'Approved' THEN t.decided_at ELSE NULL END AS "approvedAt",
          CASE WHEN t.status = 'Returned' THEN t.decided_at ELSE NULL END AS "returnedAt",
          CASE 
            WHEN t.type = 'Reservation' AND t.status IN ('Pending', 'Approved') THEN (
              SELECT COUNT(*)::int + 1
              FROM transactions sub
              WHERE (sub.isbn = t.isbn OR LOWER(sub.resource_title) = LOWER(t.resource_title))
                AND sub.type = 'Reservation'
                AND sub.status IN ('Pending', 'Approved')
                AND sub.requested_at < t.requested_at
            )
            ELSE NULL
          END AS "queuePosition"
        FROM transactions t
        LEFT JOIN LATERAL (
          SELECT *
          FROM books b
          WHERE (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
             OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))
          ORDER BY (CASE WHEN t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn THEN 0 ELSE 1 END)
          LIMIT 1
        ) b ON true
        WHERE (
          t.user_id::text = $1
          OR LOWER(t.student_id) = LOWER($1)
          OR LOWER(t.student_id) = (SELECT LOWER(id_number) FROM users WHERE id::text = $1 OR LOWER(id_number) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1)
        )
        ORDER BY t.requested_at DESC
      `;
      const { rows } = await pool.query(query, [userId]);
      
      return rows.map(r => {
        if (r.queuePosition !== null && r.queuePosition !== undefined) {
          r.estimatedWait = `${r.queuePosition * 7} days`;
        } else {
          r.estimatedWait = null;
        }
        return r;
      });
    } catch (error) {
      warnIfNotOffline("DB student:getUserBorrowHistory unavailable:", error.message);
      return [];
    }
  },

  async borrowBook(userId, bookId, payload = {}) {
    try {
      const {
        studentName = '',
        studentId = '',
        department = '',
        isbn = '',
        resourceTitle = '',
        dueDate = null,
        studentIdImage = null,
      } = payload;

      const finalIsbn = isbn && String(isbn).trim() ? String(isbn).trim() : 'N/A';
      const finalDept = department && String(department).trim() ? String(department).trim() : 'Circulation';
      const finalTitle = resourceTitle && String(resourceTitle).trim() ? String(resourceTitle).trim() : 'Library Book';
      let validDueDate = null;
      if (dueDate && String(dueDate) !== 'Not set' && !isNaN(new Date(dueDate).getTime())) {
        validDueDate = new Date(dueDate).toISOString();
      } else {
        validDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // 0. Policy guard: check Super Admin borrow limit against current active student loans
      try {
        const sRes = await pool.query("SELECT borrow_limit, borrow_duration_days FROM system_settings WHERE id = 1 LIMIT 1");
        const bLimit = Number(sRes.rows[0]?.borrow_limit || 5);

        const countQuery = `
          SELECT COUNT(*)::int AS "activeCount"
          FROM transactions
          WHERE (
            user_id::text = $1
            OR (student_id IS NOT NULL AND student_id != '' AND lower(student_id) = lower($2))
          )
          AND type = 'Borrow'
          AND status::text NOT IN ('Returned', 'Declined', 'Cancelled', 'Rejected')
        `;
        const countRes = await pool.query(countQuery, [userId, studentId]);
        const activeCount = Number(countRes.rows[0]?.activeCount || 0);

        if (activeCount >= bLimit) {
          const limitErr = new Error(`Borrow limit reached. You currently have ${activeCount} active book loans/requests (maximum allowed: ${bLimit}). Please return a book to the library before borrowing another.`);
          limitErr.code = "BORROW_LIMIT_REACHED";
          limitErr.statusCode = 400;
          throw limitErr;
        }

        const overdueQuery = `
          SELECT COUNT(*)::int AS "overdueCount"
          FROM transactions
          WHERE (
            user_id::text = $1
            OR (student_id IS NOT NULL AND student_id != '' AND lower(student_id) = lower($2))
          )
          AND type = 'Borrow'
          AND status::text NOT IN ('Returned', 'Declined', 'Cancelled', 'Rejected')
          AND due_date IS NOT NULL
          AND due_date < NOW()
        `;
        const overdueRes = await pool.query(overdueQuery, [userId, studentId]);
        const overdueCount = Number(overdueRes.rows[0]?.overdueCount || 0);

        if (overdueCount > 0) {
          const overdueErr = new Error(`Overdue return required. You have ${overdueCount} book loan(s) that are past their due date. Please return them to the library before borrowing additional books.`);
          overdueErr.code = "OVERDUE_RETURN_REQUIRED";
          overdueErr.statusCode = 400;
          throw overdueErr;
        }
      } catch (limitCheckErr) {
        if (limitCheckErr.code === "BORROW_LIMIT_REACHED" || limitCheckErr.code === "OVERDUE_RETURN_REQUIRED") {
          throw limitCheckErr;
        }
        warnIfNotOffline("DB student:borrowBook limit check fallback:", limitCheckErr.message);
      }

      // 1. Concurrency guard & idempotency check: verify no pending request exists for this student & book
      let existingReservationId = null;
      try {
        const checkSql = `
          SELECT id, status, type, requested_at, resource_title, isbn
          FROM transactions
          WHERE (user_id::text = $1 OR (student_id IS NOT NULL AND student_id != '' AND lower(student_id) = lower($2)))
            AND (
              (isbn IS NOT NULL AND isbn != '' AND isbn = $3)
              OR (resource_title IS NOT NULL AND resource_title != '' AND lower(resource_title) = lower($4))
            )
            AND status = 'Pending'
          ORDER BY requested_at DESC
          LIMIT 1
        `;
        const existingRes = await pool.query(checkSql, [
          userId,
          studentId,
          isbn,
          resourceTitle,
        ]);
        if (existingRes.rows.length > 0) {
          const existingTx = existingRes.rows[0];
          if (existingTx.type === 'Reservation') {
            // Student had reserved this book and is now fulfilling it by submitting the borrow form!
            existingReservationId = existingTx.id;
          } else {
            const conflictErr = new Error(`A pending borrow request for "${existingTx.resource_title || resourceTitle}" already exists for your account.`);
            conflictErr.code = "DUPLICATE_PENDING";
            conflictErr.transaction = existingTx;
            throw conflictErr;
          }
        }
      } catch (checkErr) {
        if (checkErr.code === "DUPLICATE_PENDING") {
          throw checkErr;
        }
        warnIfNotOffline("DB student:borrowBook idempotency check fallback:", checkErr.message);
      }

      let row = null;
      try {
        if (existingReservationId) {
          // Convert the existing waitlisted reservation directly into a pending borrow transaction
          const updateQuery = `
            UPDATE transactions
            SET type = 'Borrow',
                status = 'Pending',
                due_date = $1,
                requested_at = NOW(),
                student_id_image = COALESCE($2, student_id_image),
                student_name = COALESCE(NULLIF($3, ''), student_name),
                student_id = COALESCE(NULLIF($4, ''), student_id),
                department = COALESCE(NULLIF($5, ''), department)
            WHERE id = $6
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
              student_id_image AS "studentIdImage"
          `;
          const { rows } = await pool.query(updateQuery, [
            validDueDate,
            studentIdImage,
            studentName,
            studentId,
            finalDept,
            existingReservationId,
          ]);
          row = rows[0];
        } else {
          // Guard: verify book has available copies before allowing immediate borrow
          try {
            const availCheck = `
              SELECT 
                b.copies,
                (SELECT COUNT(*)::int FROM transactions t WHERE ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn) OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))) AND t.type = 'Borrow' AND t.status IN ('Approved', 'Pending')) AS "borrowedCount",
                (SELECT COUNT(*)::int FROM transactions t WHERE ((t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn) OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))) AND t.type = 'Reservation' AND t.status = 'Pending' AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW())) AS "heldCount"
              FROM books b
              WHERE (b.isbn IS NOT NULL AND b.isbn != '' AND b.isbn != 'N/A' AND b.isbn = $1)
                 OR (b.title IS NOT NULL AND LOWER(b.title) = LOWER($2))
                 OR (b.id::text = $3)
              LIMIT 1
            `;
            const availRes = await pool.query(availCheck, [isbn || '', resourceTitle || '', bookId || '']);
            if (availRes.rows.length > 0) {
              const bData = availRes.rows[0];
              const totalCopies = Math.max(1, Number(bData.copies || 1));
              const inUseCopies = Number(bData.borrowedCount || 0) + Number(bData.heldCount || 0);
              const netAvailable = Math.max(0, totalCopies - inUseCopies);
              if (netAvailable <= 0) {
                const noCopiesErr = new Error(`All copies of "${resourceTitle || 'this book'}" are currently checked out. Please place a reservation instead to join the queue.`);
                noCopiesErr.code = "NO_COPIES_AVAILABLE";
                noCopiesErr.statusCode = 400;
                throw noCopiesErr;
              }
            }
          } catch (availErr) {
            if (availErr.code === "NO_COPIES_AVAILABLE") {
              throw availErr;
            }
            warnIfNotOffline("DB student:borrowBook avail check fallback:", availErr.message);
          }

          const query = `
            INSERT INTO transactions (
              user_id,
              student_name,
              student_id,
              resource_title,
              isbn,
              department,
              type,
              status,
              due_date,
              requested_at,
              student_id_image
            )
            VALUES (
              (SELECT id FROM users WHERE id::text = $1 OR lower(id_number) = lower($3) OR lower(email) = lower($1) LIMIT 1),
              COALESCE(NULLIF($2, ''), (SELECT name FROM users WHERE id::text = $1 OR lower(id_number) = lower($3) OR lower(email) = lower($1) LIMIT 1), 'Student Borrower'),
              $3, $4, $5, $6,
              'Borrow', 'Pending',
              $7, NOW(), $8
            )
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
              student_id_image AS "studentIdImage"
          `;

          const { rows } = await pool.query(query, [
            userId,
            studentName,
            studentId,
            finalTitle,
            finalIsbn,
            finalDept,
            validDueDate,
            studentIdImage,
          ]);
          row = rows[0];

          // If this student had an active reservation hold for this book, mark it fulfilled
          try {
            await pool.query(
              `UPDATE transactions
               SET status = 'Approved',
                   comment = 'Fulfilled by checkout borrow request.',
                   decided_at = NOW(),
                   expires_at = NULL
               WHERE (user_id::text = $1 OR lower(student_id) = lower($2))
                 AND (
                   (isbn IS NOT NULL AND isbn != '' AND isbn != 'N/A' AND isbn = $3)
                   OR (resource_title IS NOT NULL AND lower(resource_title) = lower($4))
                 )
                 AND type = 'Reservation'
                 AND status = 'Pending'`,
              [userId, studentId, isbn, resourceTitle]
            );
          } catch (fulfillErr) {
            // ignore
          }
        }
      } catch (dbErr) {
        warnIfNotOffline("DB student:borrowBook DB query fallback:", dbErr.message);
      }

      if (!row) {
        row = {
          id: `tx-borrow-${Date.now()}`,
          userId,
          studentName,
          studentId,
          resourceTitle,
          isbn,
          department,
          type: 'Borrow',
          status: 'Pending',
          requestedAt: new Date().toISOString(),
          dueDate,
          studentIdImage,
        };
      }

      row.bookId = bookId;
      return row;
    } catch (error) {
      console.error("DB student:borrowBook failed:", error.message);
      throw error;
    }
  },

  async reserveBook(userId, bookId, payload = {}) {
    try {
      const {
        studentName = '',
        studentId = '',
        department = '',
        isbn = '',
        resourceTitle = '',
        dueDate = null,
        studentIdImage = null,
      } = payload;

      const finalIsbn = isbn && String(isbn).trim() ? String(isbn).trim() : 'N/A';
      const finalDept = department && String(department).trim() ? String(department).trim() : 'Circulation';
      const finalTitle = resourceTitle && String(resourceTitle).trim() ? String(resourceTitle).trim() : 'Library Book';
      let validDueDate = null;
      if (dueDate && String(dueDate) !== 'Not set' && !isNaN(new Date(dueDate).getTime())) {
        validDueDate = new Date(dueDate).toISOString();
      } else {
        validDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }

      // 1. Concurrency guard & idempotency check: verify no pending request exists for this student & book
      try {
        const checkSql = `
          SELECT id, status, type, requested_at, resource_title, isbn
          FROM transactions
          WHERE (user_id::text = $1 OR (student_id IS NOT NULL AND student_id != '' AND lower(student_id) = lower($2)))
            AND (
              (isbn IS NOT NULL AND isbn != '' AND isbn = $3)
              OR (resource_title IS NOT NULL AND resource_title != '' AND lower(resource_title) = lower($4))
            )
            AND status = 'Pending'
          LIMIT 1
        `;
        const existingRes = await pool.query(checkSql, [
          userId,
          studentId,
          isbn,
          resourceTitle,
        ]);
        if (existingRes.rows.length > 0) {
          const existingTx = existingRes.rows[0];
          const conflictErr = new Error(`A pending ${existingTx.type?.toLowerCase() || 'reservation'} request for "${existingTx.resource_title || resourceTitle}" already exists for your account.`);
          conflictErr.code = "DUPLICATE_PENDING";
          conflictErr.transaction = existingTx;
          throw conflictErr;
        }
      } catch (checkErr) {
        if (checkErr.code === "DUPLICATE_PENDING") {
          throw checkErr;
        }
        warnIfNotOffline("DB student:reserveBook idempotency check fallback:", checkErr.message);
      }

      let row = null;
      try {
        // 1. Determine 1st-come 1st-served queue position among active reservations
        let queuePosition = 1;
        try {
          const queueCountRes = await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM transactions
             WHERE ((isbn IS NOT NULL AND isbn != '' AND isbn != 'N/A' AND isbn = $1)
                    OR (resource_title IS NOT NULL AND LOWER(resource_title) = LOWER($2)))
                AND type = 'Reservation'
                AND status IN ('Pending', 'Approved')`,
            [isbn || '', resourceTitle || '']
          );
          queuePosition = Number(queueCountRes.rows[0]?.count || 0) + 1;
        } catch (qErr) {
          // fallback queue position 1
        }

        const query = `
          INSERT INTO transactions (
            user_id,
            student_name,
            student_id,
            resource_title,
            isbn,
            department,
            type,
            status,
            due_date,
            requested_at,
            student_id_image,
            available_at,
            expires_at
          )
          VALUES (
            (SELECT id FROM users WHERE id::text = $1 OR lower(id_number) = lower($3) OR lower(email) = lower($1) LIMIT 1),
            $2, $3, $4, $5, $6,
            'Reservation', 'Pending',
            $7, NOW(), $8,
            NULL,
            NULL
          )
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
            student_id_image AS "studentIdImage",
            available_at AS "availableAt",
            expires_at AS "expiresAt"
        `;

        const { rows } = await pool.query(query, [
          userId,
          studentName,
          studentId,
          finalTitle,
          finalIsbn,
          finalDept,
          validDueDate,
          studentIdImage,
        ]);
        row = rows[0];
        if (row) {
          row.queuePosition = queuePosition;
        }
      } catch (dbErr) {
        warnIfNotOffline("DB student:reserveBook DB query fallback:", dbErr.message);
      }

      if (!row) {
        row = {
          id: `tx-reserve-${Date.now()}`,
          userId,
          studentName,
          studentId,
          resourceTitle,
          isbn,
          department,
          type: 'Reservation',
          status: 'Pending',
          requestedAt: new Date().toISOString(),
          dueDate,
          studentIdImage,
          queuePosition: 1,
        };
      }

      row.bookId = bookId;
      return row;
    } catch (error) {
      console.error("DB student:reserveBook failed:", error.message);
      throw error;
    }
  },


  async cancelReservation(reservationId, userId = null) {
    try {
      // 1. Fetch the target transaction and validate existence
      let tx = null;
      try {
        const fetchSql = `
          SELECT id, user_id AS "userId", student_name AS "studentName", student_id AS "studentId",
                 resource_title AS "resourceTitle", isbn, department, type, status,
                 requested_at AS "requestedAt", due_date AS "dueDate"
          FROM transactions
          WHERE id::text = $1 OR (student_id = $1 AND status = 'Pending')
          LIMIT 1
        `;
        const res = await pool.query(fetchSql, [reservationId]);
        if (res.rows.length > 0) {
          tx = res.rows[0];
        }
      } catch (fetchErr) {
        warnIfNotOffline("DB student:cancelReservation fetch fallback:", fetchErr.message);
      }

      if (!tx) {
        // Synthesize response for client if not found in db
        return {
          transaction: {
            id: reservationId,
            status: "Cancelled",
            decidedAt: new Date().toISOString(),
          },
        };
      }

      // 2. Validate that the target reservation is currently in 'Pending' or unpicked-up 'Approved' hold status before permitting cancellation
      const isCancellable = tx.status === "Pending" || (tx.status === "Approved" && !tx.pickedUpAt);
      if (!isCancellable) {
        return {
          notPending: true,
          currentStatus: tx.status,
          transaction: tx,
        };
      }

      // 3. Update reservation record status to 'Cancelled', log decided_at / cancelled timestamp, and release hold
      try {
        const updateSql = `
          UPDATE transactions
          SET status = 'Cancelled', decided_at = NOW(), expires_at = NULL
          WHERE id = $1
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
            decided_at AS "decidedAt",
            due_date AS "dueDate"
        `;
        const updateRes = await pool.query(updateSql, [tx.id]);
        if (updateRes.rows.length > 0) {
          tx = updateRes.rows[0];
        }
      } catch (updateErr) {
        warnIfNotOffline("DB student:cancelReservation update fallback:", updateErr.message);
        tx.status = "Cancelled";
        tx.decidedAt = new Date().toISOString();
      }

      // 4. Log activity into PostgreSQL activity_logs
      try {
        await pool.query(
          `INSERT INTO activity_logs (actor, category, message, severity, created_at)
           VALUES ($1, 'Reservation', $2, 'warning', NOW())`,
          [
            tx.studentName || "Student",
            `Student ${tx.studentName || "Student"} cancelled reservation for '${tx.resourceTitle || "Book"}'`,
          ]
        );
      } catch (logErr) {
        // Non-fatal log error
      }

      return { transaction: tx };
    } catch (error) {
      console.error("DB student:cancelReservation failed:", error.message);
      throw error;
    }
  },

  async returnBook(transactionId) {
    try {
      const query = `
        UPDATE transactions
        SET status = 'Returned', decided_at = NOW()
        WHERE id::text = $1::text
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
          decided_at AS "returnedAt"
      `;
      const { rows } = await pool.query(query, [transactionId]);
      return rows[0] || null;
    } catch (error) {
      console.error("DB student:returnBook failed:", error.message);
      throw new Error("Database unavailable for returning.");
    }
  },


  async updateUserProfile(userId, updates) {
    const { name, email, idNumber, course, department, yearLevel, section, avatar } = updates;
    const isUuid = Boolean(userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId));

    try {
      let rows = [];

      if (isUuid) {
        const query = `
          UPDATE users
          SET 
            name = COALESCE($2, name), 
            email = COALESCE($3, email),
            id_number = COALESCE($4, id_number),
            course = COALESCE($5, course),
            department = COALESCE($6, department),
            year_level = COALESCE($7, year_level),
            section = COALESCE($8, section),
            avatar = COALESCE($9, avatar),
            updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            name,
            email,
            role,
            id_number AS "idNumber",
            department,
            course,
            year_level AS "yearLevel",
            section,
            status,
            avatar
        `;
        const res = await pool.query(query, [
          userId,
          name ?? null,
          email ?? null,
          idNumber ?? null,
          course ?? null,
          department ?? null,
          yearLevel ?? null,
          section ?? null,
          avatar !== undefined ? avatar : null
        ]);
        rows = res.rows;
      } else if (email || userId) {
        const targetEmail = (email || "").toLowerCase().trim();
        const query = `
          UPDATE users
          SET 
            name = COALESCE($2, name), 
            email = COALESCE($3, email),
            id_number = COALESCE($4, id_number),
            course = COALESCE($5, course),
            department = COALESCE($6, department),
            year_level = COALESCE($7, year_level),
            section = COALESCE($8, section),
            avatar = COALESCE($9, avatar),
            updated_at = NOW()
          WHERE lower(email) = lower($1) OR id_number = $1
          RETURNING
            id,
            name,
            email,
            role,
            id_number AS "idNumber",
            department,
            course,
            year_level AS "yearLevel",
            section,
            status,
            avatar
        `;
        const res = await pool.query(query, [
          targetEmail || userId,
          name ?? null,
          email ?? null,
          idNumber ?? null,
          course ?? null,
          department ?? null,
          yearLevel ?? null,
          section ?? null,
          avatar !== undefined ? avatar : null
        ]);
        rows = res.rows;
      }

      if (rows && rows[0]) {
        const updated = rows[0];
        if (updated.email) inMemoryUsers.set(updated.email.toLowerCase(), updated);
        if (updated.idNumber) inMemoryUsers.set(updated.idNumber.toLowerCase(), updated);
        return updated;
      }
    } catch (error) {
      console.error("DB student:updateUserProfile failed:", error.message);
      if (error.code === '23505') {
        if (error.message.includes('id_number') || error.constraint === 'users_id_number_key') {
          throw new Error("Student ID number is already in use by another account.");
        }
        if (error.message.includes('email') || error.constraint === 'users_email_key') {
          throw new Error("Email is already in use by another account.");
        }
      }
    }

    // In-memory fallback if DB fails or user was registered in memory
    const targetEmail = (email || "").toLowerCase().trim();
    let memoryUser = inMemoryUsers.get(userId) || (targetEmail ? inMemoryUsers.get(targetEmail) : null);
    if (!memoryUser && idNumber) {
      memoryUser = inMemoryUsers.get(idNumber.toLowerCase().trim());
    }

    if (memoryUser) {
      if (name) memoryUser.name = name;
      if (email) memoryUser.email = email;
      if (idNumber) memoryUser.idNumber = idNumber;
      if (course) memoryUser.course = course;
      if (department) memoryUser.department = department;
      if (yearLevel) memoryUser.yearLevel = yearLevel;
      if (section) memoryUser.section = section;
      if (avatar !== undefined) memoryUser.avatar = avatar;

      if (memoryUser.email) inMemoryUsers.set(memoryUser.email.toLowerCase(), memoryUser);
      if (memoryUser.idNumber) inMemoryUsers.set(memoryUser.idNumber.toLowerCase(), memoryUser);
      return memoryUser;
    }

    return {
      id: userId || `usr-live-${Date.now()}`,
      name: name || "Student",
      email: email || "",
      idNumber: idNumber || "",
      course: course || "",
      department: department || "",
      yearLevel: yearLevel || "",
      section: section || "",
      role: "Student",
      status: "Active",
    };
  },

  async getAnnouncements() {
    try {
      const query = `
        SELECT
          id,
          title,
          content,
          priority,
          author,
          duration_days AS "durationDays",
          expires_at AS "expiresAt",
          updated_at AS "updatedAt"
        FROM announcements
        WHERE published = true
          AND audience IN ('All', 'All Users', 'Students')
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY updated_at DESC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error("DB student:getAnnouncements failed:", error.message);
      return [];
    }
  },

  async getRecommendations(userId) {
    try {
      // 1. Fetch student details
      const user = await this.getUserProfile(userId);
      if (!user) return [];

      // 2. Fetch student borrow history
      const history = await this.getUserBorrowHistory(userId);
      const historySummary = history.map(h => `${h.title} by ${h.author}`).slice(0, 5).join(", ");

      // 3. Fetch candidate books from the same or matching departments
      let department = user.department || "Circulation";
      let deptQuery = "SELECT id, title, author, isbn, cover_img AS \"coverUrl\", summary AS \"description\", rating, category FROM books WHERE archived_at IS NULL";
      const params = [];
      
      const libraryDepts = ["Circulation", "General Reference", "Filipiniana", "Reserve", "Periodical", "Special Collections"];
      const matchedDept = libraryDepts.find(d => department.toLowerCase().includes(d.toLowerCase()));
      if (matchedDept) {
        deptQuery += " AND department = $1";
        params.push(matchedDept);
      }
      deptQuery += " ORDER BY borrow_count DESC, rating DESC LIMIT 60";
      
      const { rows: candidates } = await pool.query(deptQuery, params);

      // Fallback if no books in department
      let bookList = candidates;
      if (bookList.length === 0) {
        const fallbackRes = await pool.query("SELECT id, title, author, isbn, cover_img AS \"coverUrl\", summary AS \"description\", rating, category FROM books WHERE archived_at IS NULL ORDER BY borrow_count DESC, rating DESC LIMIT 60");
        bookList = fallbackRes.rows;
      }

      // Format books for Gemini to minimize token size
      const booksForPrompt = bookList.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        description: b.description ? b.description.substring(0, 160) : "",
        category: b.category,
      }));

      // 4. Call Gemini to recommend the top 4 books
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "your_gemini_api_key") {
        // Fallback to top-rated books from the catalog if Gemini is not configured
        return bookList.slice(0, 4).map((b, i) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          rating: b.rating || 4.5,
          reviews: 120 + i * 25,
          image: b.coverUrl || "https://via.placeholder.com/100",
          category: b.category || "General",
          summary: b.description || "A highly recommended academic resource.",
          matchPercent: 90 - i * 5,
        }));
      }

      const prompt = `
You are the AI Recommendation engine for "BookHive" university library.
Given the student's profile and their borrowing history, recommend the top 4 most suitable books from the candidate catalog.

Student Profile:
- Course: "${user.course || 'Unknown'}"
- Department: "${user.department || 'Unknown'}"
- Borrowed History: [${historySummary || 'No borrowing history yet'}]

Candidate Books Catalog:
${JSON.stringify(booksForPrompt)}

Select exactly 4 books from the catalog that are most beneficial or interesting to this student.
For each recommended book:
1. Determine the match percentage (integer 70-98%) based on their course/history alignment.
2. Formulate a short personalized recommendation description (1 sentence) explaining why it fits them.

Return ONLY a JSON object of this format with no markdown formatting or backticks:
{
  "recommendations": [
    {
      "id": "book_id",
      "matchPercent": 95,
      "reason": "Since you are studying Computer Science, this book on AI will help with your syllabus."
    }
  ]
}
`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const geminiData = await response.json();
      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini API");

      const parsed = JSON.parse(text);
      const matches = parsed.recommendations || [];

      const candidateMap = new Map(bookList.map(b => [b.id, b]));
      return matches.map((m, i) => {
        const book = candidateMap.get(m.id);
        if (!book) return null;
        return {
          id: book.id,
          title: book.title,
          author: book.author,
          rating: book.rating || 4.5,
          reviews: 80 + i * 40,
          image: book.coverUrl || "https://via.placeholder.com/100",
          category: book.category || "General",
          summary: m.reason || book.description || "Highly recommended for your study program.",
          matchPercent: m.matchPercent || 85,
        };
      }).filter(Boolean);

    } catch (err) {
      console.error("studentModel:getRecommendations error, falling back:", err);
      // Fallback
      return bookList.slice(0, 4).map((b, i) => ({
        id: b.id,
        title: b.title,
        author: b.author,
        rating: b.rating || 4.5,
        reviews: 120 + i * 25,
        image: b.coverUrl || "https://via.placeholder.com/100",
        category: b.category || "General",
        summary: b.description || "A highly recommended academic resource.",
        matchPercent: 90 - i * 5,
      }));
    }
  },

  async getStudentCardAndViolations(identifier) {
    if (!identifier) return null;
    const cleanId = String(identifier).trim();

    try {
      // 1. Locate student
      let student = null;
      try {
        const studentSql = `
          SELECT
            u.id,
            u.name,
            u.email,
            u.role,
            u.id_number AS "idNumber",
            u.department,
            u.course,
            u.status,
            u.avatar,
            u.qr_code AS "qrCode",
            u.created_at AS "createdAt",
            u.last_active AS "lastActive"
          FROM users u
          WHERE u.qr_code::text = $1
             OR lower(u.id_number) = lower($1)
             OR lower(u.email) = lower($1)
             OR lower(u.name) = lower($1)
             OR u.id::text = $1
          LIMIT 1
        `;
        const { rows } = await pool.query(studentSql, [cleanId]);
        if (rows.length > 0) {
          student = rows[0];
        }
      } catch (dbErr) {
        warnIfNotOffline("DB getStudentCardAndViolations student query error:", dbErr.message);
      }

      if (!student) {
        // Check in-memory users
        const lowerKey = cleanId.toLowerCase();
        student = inMemoryUsers.get(lowerKey) || null;
        if (!student) {
          // Search values
          for (const user of inMemoryUsers.values()) {
            if (
              (user.qrCode && user.qrCode.toLowerCase() === lowerKey) ||
              (user.idNumber && user.idNumber.toLowerCase() === lowerKey) ||
              (user.name && user.name.toLowerCase() === lowerKey) ||
              (user.id && user.id.toLowerCase() === lowerKey)
            ) {
              student = user;
              break;
            }
          }
        }
      }

      if (!student) {
        return null;
      }

      // 2. Fetch Borrow History / Library Card transactions & Approved Reservations
      let libraryCard = [];
      try {
        const txSql = `
          SELECT
            t.id,
            COALESCE(b.title, t.resource_title) AS "bookTitle",
            t.isbn,
            t.type,
            t.status,
            t.requested_at AS "requestedAt",
            t.due_date AS "dueDate",
            t.decided_at AS "decidedAt",
            t.available_at AS "availableAt",
            t.expires_at AS "expiresAt",
            t.picked_up_at AS "pickedUpAt",
            CASE 
              WHEN t.type = 'Reservation' AND t.available_at IS NOT NULL AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 'true'
              WHEN t.type = 'Reservation' AND (
                SELECT GREATEST(0, COALESCE(MAX(b_sub.copies), 1) - COUNT(CASE WHEN sub_t.type = 'Borrow' AND sub_t.status IN ('Approved', 'Pending') THEN 1 END))
                FROM transactions sub_t
                LEFT JOIN books b_sub ON (
                  (sub_t.isbn IS NOT NULL AND sub_t.isbn != '' AND sub_t.isbn != 'N/A' AND b_sub.isbn = sub_t.isbn)
                  OR (sub_t.resource_title IS NOT NULL AND LOWER(b_sub.title) = LOWER(sub_t.resource_title))
                )
                WHERE (sub_t.isbn = t.isbn OR LOWER(sub_t.resource_title) = LOWER(t.resource_title))
              ) > 0 THEN 'true'
              WHEN t.type = 'Reservation' THEN 'false'
              ELSE COALESCE(b.availability, 'Available')
            END AS "available",
            CASE 
              WHEN t.type = 'Reservation' AND t.status IN ('Pending', 'Approved') THEN (
                SELECT COUNT(*)::int + 1
                FROM transactions sub
                WHERE (sub.isbn = t.isbn OR LOWER(sub.resource_title) = LOWER(t.resource_title))
                  AND sub.type = 'Reservation'
                  AND sub.status IN ('Pending', 'Approved')
                  AND sub.requested_at < t.requested_at
              )
              ELSE NULL
            END AS "queuePosition"
          FROM transactions t
          LEFT JOIN LATERAL (
            SELECT *
            FROM books b
            WHERE (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn)
               OR (t.resource_title IS NOT NULL AND LOWER(t.resource_title) = LOWER(b.title))
            ORDER BY (CASE WHEN t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND t.isbn = b.isbn THEN 0 ELSE 1 END)
            LIMIT 1
          ) b ON true
          WHERE (t.user_id::text = $1 OR lower(t.student_id) = lower($2))
            AND (
              (t.type::text IN ('Borrow', 'Borrowing') AND t.status::text IN ('Approved', 'On Loan', 'Picked Up', 'Returned', 'Completed'))
              OR (t.type::text = 'Reservation' AND t.status::text IN ('Approved', 'Reserved'))
            )
          ORDER BY t.requested_at DESC
        `;
        const { rows: txRows } = await pool.query(txSql, [String(student.id), String(student.idNumber)]);
        libraryCard = txRows.map(tx => {
          const isReservation = tx.type === 'Reservation';
          const isReturned = tx.status === 'Returned' || tx.status === 'Completed';
          const isNowAvailable = isReservation && (
            tx.available === 'true' ||
            tx.available === true ||
            (tx.availableAt && (!tx.expiresAt || new Date(tx.expiresAt) > new Date()))
          );

          let dueReturnDate = tx.dueDate ? new Date(tx.dueDate).toISOString().split('T')[0] : "—";
          let highlightType = 'none';

          if (!isReturned) {
            if (isReservation) {
              dueReturnDate = 'Reservation';
              highlightType = 'violet';
            } else {
              const isDue = tx.dueDate && (() => {
                const d = new Date(tx.dueDate);
                if (isNaN(d.getTime())) return false;
                const now = new Date();
                const dueDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
                return dueDayStart <= todayStart;
              })();
              highlightType = isDue ? 'red' : 'green';
            }
          } else {
            dueReturnDate = 'Returned';
            highlightType = 'none';
          }

          let resolvedStatus = tx.status || "Approved";
          if (isReturned) {
            resolvedStatus = tx.status || "Returned";
          } else if (isReservation) {
            resolvedStatus = isNowAvailable ? 'Borrow' : 'Reservation';
          } else if (tx.pickedUpAt) {
            resolvedStatus = 'Picked Up';
          }

          return {
            id: tx.id,
            bookTitle: tx.bookTitle || "Unknown Book",
            borrowDate: tx.requestedAt ? new Date(tx.requestedAt).toISOString().split('T')[0] : "—",
            dueReturnDate,
            status: resolvedStatus,
            type: tx.type,
            action: isReservation ? 'Reserve' : 'Borrow',
            available: tx.available,
            queuePosition: tx.queuePosition,
            availableAt: tx.availableAt,
            expiresAt: tx.expiresAt,
            pickedUpAt: tx.pickedUpAt,
            isPickedUp: !isReturned && Boolean(tx.pickedUpAt),
            highlightType,
          };
        });
      } catch (txErr) {
        warnIfNotOffline("DB getStudentCardAndViolations tx query error:", txErr.message);
      }

      if (libraryCard.length === 0 && typeof inMemoryTransactions !== 'undefined') {
        libraryCard = inMemoryTransactions
          .filter(tx => (tx.userId === student.id || tx.studentId === student.idNumber) && 
            ((tx.type === 'Borrow' && (tx.status === 'Approved' || tx.status === 'Returned' || tx.status === 'Completed' || tx.status === 'Picked Up' || tx.status === 'On Loan')) || 
             (tx.type === 'Reservation' && tx.status === 'Approved')))
          .map(tx => {
            const isReservation = tx.type === 'Reservation';
            const isReturned = tx.status === 'Returned' || tx.status === 'Completed';
            const isNowAvailable = isReservation && (tx.available === 'true' || tx.available === true || !!tx.availableAt);
            let dueReturnDate = tx.dueDate ? new Date(tx.dueDate).toISOString().split('T')[0] : "—";
            let highlightType = 'none';

            if (!isReturned) {
              if (isReservation) {
                dueReturnDate = 'Reservation';
                highlightType = 'violet';
              } else {
                highlightType = 'green';
              }
            }

            let resolvedStatus = tx.status || "Approved";
            if (isReturned) {
              resolvedStatus = tx.status || "Returned";
            } else if (isReservation) {
              resolvedStatus = isNowAvailable ? 'Borrow' : 'Reservation';
            } else if (tx.pickedUpAt) {
              resolvedStatus = 'Picked Up';
            }

            return {
              id: tx.id,
              bookTitle: tx.resourceTitle || tx.bookTitle || "Library Book",
              borrowDate: tx.requestedAt ? new Date(tx.requestedAt).toISOString().split('T')[0] : "—",
              dueReturnDate,
              status: resolvedStatus,
              type: tx.type,
              action: isReservation ? 'Reserve' : 'Borrow',
              available: tx.available,
              queuePosition: tx.queuePosition,
              availableAt: tx.availableAt,
              expiresAt: tx.expiresAt,
              pickedUpAt: tx.pickedUpAt,
              isPickedUp: !isReturned && Boolean(tx.pickedUpAt),
              highlightType,
            };
          });
      }

      // Fetch all student reservations and pending requests for Tab 3
      let reservedBooks = [];
      try {
        const resSql = `
          SELECT
            t.id,
            t.resource_title AS "bookTitle",
            t.requested_at AS "reserveDate",
            t.status,
            t.available_at AS "availableAt",
            t.expires_at AS "expiresAt"
          FROM transactions t
          WHERE (t.user_id::text = $1 OR lower(t.student_id) = lower($2))
            AND (
              (t.type = 'Reservation' AND t.status = 'Approved')
              OR (t.type = 'Borrow' AND t.status = 'Approved')
            )
          ORDER BY t.requested_at DESC
        `;
        const { rows: resRows } = await pool.query(resSql, [String(student.id), String(student.idNumber)]);
        reservedBooks = resRows.map(r => ({
          id: r.id,
          bookTitle: r.bookTitle || "Reserved Book",
          reserveDate: r.reserveDate ? new Date(r.reserveDate).toISOString().split('T')[0] : "—",
          status: r.status,
          available: !!r.availableAt,
        }));
      } catch (resErr) {
        warnIfNotOffline("DB getStudentCardAndViolations reservedBooks query error:", resErr.message);
      }

      // 3. Fetch / Compute Violations
      let violations = [];
      try {
        // Query explicit violations table
        const violSql = `
          SELECT
            v.id,
            v.book_title AS "bookTitle",
            v.isbn,
            v.violation_type AS "violationType",
            v.penalty_amount AS "penaltyAmount",
            v.status,
            v.remarks,
            v.created_at AS "createdAt"
          FROM violations v
          WHERE v.user_id::text = $1 OR lower(v.student_id) = lower($2)
          ORDER BY v.created_at DESC
        `;
        const { rows: violRows } = await pool.query(violSql, [String(student.id), String(student.idNumber)]);
        violations = violRows.map(v => ({
          id: v.id,
          bookTitle: v.bookTitle,
          violationType: v.violationType || "Overdue Book Return",
          penaltyAmount: Number(v.penaltyAmount || 0),
          status: v.status || "Active",
          remarks: v.remarks || "Library policy violation recorded.",
          date: v.createdAt ? new Date(v.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        }));

        // Dynamically compute overdue active loans
        const overdueSql = `
          SELECT
            t.id,
            t.resource_title AS "bookTitle",
            t.isbn,
            t.due_date AS "dueDate",
            t.requested_at AS "requestedAt",
            CURRENT_DATE - t.due_date::date AS "daysOverdue"
          FROM transactions t
          WHERE (t.user_id::text = $1 OR lower(t.student_id) = lower($2))
            AND t.type = 'Borrow'
            AND t.status = 'Approved'
            AND t.due_date < NOW()
        `;
        const { rows: overdueRows } = await pool.query(overdueSql, [String(student.id), String(student.idNumber)]);
        overdueRows.forEach(ov => {
          const days = Math.max(1, parseInt(ov.daysOverdue, 10) || 1);
          const penalty = days * 50; // ₱50 per day overdue
          violations.push({
            id: `overdue-${ov.id}`,
            bookTitle: ov.bookTitle || "Overdue Book",
            violationType: "Overdue Book Return",
            penaltyAmount: penalty,
            status: "Active Penalty",
            remarks: `Overdue by ${days} day(s). Standard fine ₱50/day applied.`,
            date: ov.dueDate ? new Date(ov.dueDate).toISOString().split('T')[0] : "Overdue",
          });
        });
      } catch (violErr) {
        warnIfNotOffline("DB getStudentCardAndViolations violations query error:", violErr.message);
      }

      return {
        student: {
          id: student.id,
          name: student.name,
          fullName: student.name,
          email: student.email,
          studentId: student.idNumber,
          idNumber: student.idNumber,
          department: student.department || "WNU STI",
          course: student.course || "General Program",
          role: student.role || "Student",
          avatar: student.avatar || "",
          qrCode: student.qrCode || `e1a1-${student.idNumber || "default"}`,
        },
        libraryCard,
        reservedBooks,
        violations,
      };
    } catch (err) {
      console.error("studentModel:getStudentCardAndViolations fatal error:", err);
      return null;
    }
  },
};

