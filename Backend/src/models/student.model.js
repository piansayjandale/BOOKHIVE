import { pool } from "../db/pool.js";

export const studentModel = {
  async createUser(input) {
    try {
      const query = `
        INSERT INTO users (name, id_number, email, password_hash, role, department, course, status, avatar)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'Active',$8)
        RETURNING
          id,
          name,
          email,
          role,
          id_number AS "idNumber",
          department,
          course,
          status,
          avatar
      `;

      const { rows } = await pool.query(query, [
        input.name,
        input.idNumber,
        input.email,
        input.passwordHash,
        input.role,
        input.department,
        input.course,
        input.avatar || null,
      ]);

      return rows[0] ?? null;
    } catch (error) {
      console.error("DB student:createUser failed:", error.message);
      throw new Error("Database unavailable for registration.");
    }
  },

  async findUserByEmail(email) {
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
          u.status,
          u.avatar,
          u.last_active AS "lastActive",
          u.created_at AS "createdAt"
        FROM users u
        WHERE lower(u.email) = lower($1)
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [email]);
      return rows[0] ?? null;
    } catch (error) {
      console.warn("DB student:findUserByEmail unavailable:", error.message);
      return null;
    }
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
          u.status,
          u.avatar,
          u.created_at AS "createdAt",
          u.last_active AS "lastActive"
        FROM users u
        WHERE u.id = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [userId]);
      return rows[0] ?? null;
    } catch (error) {
      console.warn("DB student:getUserProfile unavailable:", error.message);
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
          b.summary AS "description",
          b.rating,
          b.availability AS "status",
          COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status = 'Approved' THEN 1 END), 0)::int AS "borrowedCount",
          COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status = 'Pending' THEN 1 END), 0)::int AS "reservedCount"
        FROM books b
        LEFT JOIN transactions t ON b.isbn = t.isbn
        WHERE b.archived_at IS NULL AND b.availability != 'Unavailable'
        GROUP BY b.id
        ORDER BY b.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const countQuery = `SELECT COUNT(*) FROM books WHERE archived_at IS NULL AND availability != 'Unavailable'`;
      
      const [booksResult, countResult] = await Promise.all([
        pool.query(query, [limit, offset]),
        pool.query(countQuery),
      ]);
      
      return {
        books: booksResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
      };
    } catch (error) {
      console.warn("DB student:getAvailableBooks unavailable:", error.message);
      return { books: [], total: 0 };
    }
  },

  async getBookById(bookId) {
    try {
      const query = `
        SELECT
          id,
          title,
          author,
          isbn,
          cover_img AS "coverUrl",
          summary AS "description",
          rating,
          availability AS "status",
          publisher,
          TO_CHAR(published_date, 'YYYY') AS "publicationYear",
          created_at AS "createdAt"
        FROM books
        WHERE id = $1 AND archived_at IS NULL
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [bookId]);
      return rows[0] ?? null;
    } catch (error) {
      console.warn("DB student:getBookById unavailable:", error.message);
      return null;
    }
  },

  async searchBooks(query, page = 1, limit = 20) {
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
            b.summary AS "description",
            b.rating,
            b.availability AS "status",
            b.department,
            b.category,
            b.shelf_location AS "shelfLocation"
          FROM books b
          WHERE b.archived_at IS NULL 
            AND LOWER(b.department) = LOWER($1)
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

        return {
          books: booksResult.rows,
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

      // Clean and split query into keywords, filtering out stop words
      const rawKeywords = cleanQuery.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
      let keywords = rawKeywords.filter(k => k.length > 1 && !STOP_WORDS.has(k));
      
      if (keywords.length === 0) {
        keywords = rawKeywords.filter(k => k.length > 1);
      }
      if (keywords.length === 0) {
        keywords = rawKeywords.filter(k => k.length > 0);
      }

      const params = [];
      params.push(`%${cleanQuery}%`); // $1 is the full phrase query
      
      const wordConditions = [];
      keywords.forEach((word) => {
        params.push(`%${word}%`);
        const pIndex = `$${params.length}`;
        wordConditions.push(`(
          LOWER(b.title) LIKE LOWER(${pIndex})
          OR LOWER(b.author) LIKE LOWER(${pIndex})
          OR LOWER(b.isbn) LIKE LOWER(${pIndex})
          OR LOWER(b.department) LIKE LOWER(${pIndex})
          OR LOWER(b.category) LIKE LOWER(${pIndex})
          OR LOWER(b.summary) LIKE LOWER(${pIndex})
        )`);
      });

      const sql = `
        SELECT
          b.id,
          b.title,
          b.author,
          b.isbn,
          b.cover_img AS "coverUrl",
          b.summary AS "description",
          b.rating,
          b.availability AS "status",
          b.department,
          b.category,
          b.shelf_location AS "shelfLocation",
          (
            CASE WHEN LOWER(b.title) LIKE LOWER($1) THEN 100 ELSE 0 END +
            CASE WHEN LOWER(b.department) LIKE LOWER($1) THEN 80 ELSE 0 END +
            CASE WHEN LOWER(b.category) LIKE LOWER($1) THEN 60 ELSE 0 END +
            CASE WHEN LOWER(b.author) LIKE LOWER($1) THEN 40 ELSE 0 END +
            CASE WHEN LOWER(b.summary) LIKE LOWER($1) THEN 20 ELSE 0 END
          ) AS relevance
        FROM books b
        WHERE b.archived_at IS NULL 
          AND (
            LOWER(b.title) LIKE LOWER($1)
            OR LOWER(b.author) LIKE LOWER($1)
            OR LOWER(b.isbn) LIKE LOWER($1)
            OR LOWER(b.department) LIKE LOWER($1)
            OR LOWER(b.category) LIKE LOWER($1)
            OR LOWER(b.summary) LIKE LOWER($1)
            OR (${wordConditions.join(" AND ")})
          )
        ORDER BY relevance DESC, b.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;

      const countSql = `
        SELECT COUNT(*)
        FROM books b
        WHERE b.archived_at IS NULL 
          AND (
            LOWER(b.title) LIKE LOWER($1)
            OR LOWER(b.author) LIKE LOWER($1)
            OR LOWER(b.isbn) LIKE LOWER($1)
            OR LOWER(b.department) LIKE LOWER($1)
            OR LOWER(b.category) LIKE LOWER($1)
            OR LOWER(b.summary) LIKE LOWER($1)
            OR (${wordConditions.join(" AND ")})
          )
      `;

      const queryParams = [...params, limit, offset];
      const countQueryParams = params;

      const [booksResult, countResult] = await Promise.all([
        pool.query(sql, queryParams),
        pool.query(countSql, countQueryParams),
      ]);

      return {
        books: booksResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
      };
    } catch (error) {
      console.warn("DB student:searchBooks unavailable:", error.message);
      return { books: [], total: 0 };
    }
  },

  async getUserBorrowHistory(userId) {
    try {
      const query = `
        SELECT
          t.id,
          b.id AS "bookId",
          b.title,
          b.author,
          b.cover_img AS "coverUrl",
          b.summary AS "description",
          b.category,
          b.shelf_location AS "shelf",
          TO_CHAR(b.published_date, 'YYYY') AS "year",
          b.pages,
          b.language,
          b.availability AS "available",
          t.type,
          t.status,
          t.requested_at AS "requestedAt",
          t.due_date AS "dueDate",
          t.decided_at AS "decidedAt",
          t.comment AS "comment",
          CASE WHEN t.status = 'Approved' THEN t.decided_at ELSE NULL END AS "approvedAt",
          CASE WHEN t.status = 'Returned' THEN t.decided_at ELSE NULL END AS "returnedAt",
          CASE 
            WHEN t.type = 'Reservation' AND t.status = 'Pending' THEN (
              SELECT COUNT(*)::int + 1
              FROM transactions sub
              WHERE sub.isbn = t.isbn
                AND sub.type = 'Reservation'
                AND sub.status = 'Pending'
                AND sub.requested_at < t.requested_at
            )
            ELSE NULL
          END AS "queuePosition"
        FROM transactions t
        JOIN books b ON t.isbn = b.isbn
        WHERE t.user_id = $1
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
      console.warn("DB student:getUserBorrowHistory unavailable:", error.message);
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
          $1,
          $2, $3, $4, $5, $6,
          'Borrow', 'Pending',
          $7, NOW(), $8
        )
        RETURNING
          id,
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
        resourceTitle,
        isbn,
        department,
        dueDate,
        studentIdImage,
      ]);

      if (rows[0]) {
        rows[0].bookId = bookId;
      }
      return rows[0];
    } catch (error) {
      console.error("DB student:borrowBook failed:", error.message);
      throw new Error("Database unavailable for borrowing.");
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
          $1,
          $2, $3, $4, $5, $6,
          'Reservation', 'Pending',
          $7, NOW(), $8
        )
        RETURNING
          id,
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
        resourceTitle,
        isbn,
        department,
        dueDate,
        studentIdImage,
      ]);

      if (rows[0]) {
        rows[0].bookId = bookId;

        // Log reservation to notify librarian in real-time
        try {
          const logMsg = `Student ${studentName} reserved book: "${resourceTitle}" (ISBN: ${isbn})`;
          const actorLabel = `Student ${studentName}`;
          
          await pool.query(
            `INSERT INTO activity_logs (actor, category, message, severity) VALUES ($1, $2, $3, $4)`,
            [actorLabel, "Transaction", logMsg, "info"]
          );
          
          await pool.query(
            `INSERT INTO history_logs (actor, action, target, module, detail) VALUES ($1, $2, $3, $4, $5)`,
            [actorLabel, "Reserved book", resourceTitle, "Transactions", `Reservation request opened for "${resourceTitle}".`]
          );
        } catch (logErr) {
          console.error("Failed to write reservation log:", logErr.message);
        }
      }
      return rows[0];
    } catch (error) {
      console.error("DB student:reserveBook failed:", error.message);
      throw new Error("Database unavailable for reservation.");
    }
  },

  async returnBook(transactionId) {
    try {
      const query = `
        UPDATE transactions
        SET status = 'Returned', decided_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          status,
          decided_at AS "returnedAt"
      `;
      const { rows } = await pool.query(query, [transactionId]);
      return rows[0];
    } catch (error) {
      console.error("DB student:returnBook failed:", error.message);
      throw new Error("Database unavailable for returning.");
    }
  },

  async updateUserProfile(userId, updates) {
    try {
      const { name, email, idNumber, course, department, avatar } = updates;
      const query = `
        UPDATE users
        SET 
          name = COALESCE($2, name), 
          email = COALESCE($3, email),
          id_number = COALESCE($4, id_number),
          course = COALESCE($5, course),
          department = COALESCE($6, department),
          avatar = COALESCE($7, avatar),
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
          status,
          avatar
      `;
      const { rows } = await pool.query(query, [
        userId,
        name ?? null,
        email ?? null,
        idNumber ?? null,
        course ?? null,
        department ?? null,
        avatar !== undefined ? avatar : null
      ]);
      return rows[0];
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
      throw new Error("Database unavailable for profile update.");
    }
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
          updated_at AS "updatedAt"
        FROM announcements
        WHERE published = true
          AND audience IN ('All', 'All Users', 'Students')
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
};

