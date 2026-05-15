import { pool } from "../db/pool.js";

export const studentModel = {
  async createUser(input) {
    try {
      const query = `
        INSERT INTO users (name, id_number, email, password_hash, role, department, course, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'Active')
        RETURNING
          id,
          name,
          email,
          role,
          id_number AS "idNumber",
          department,
          course,
          status
      `;

      const { rows } = await pool.query(query, [
        input.name,
        input.idNumber,
        input.email,
        input.passwordHash,
        input.role,
        input.department,
        input.course,
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
          u.last_active AS "lastActive",
          u.created_at AS "createdAt"
        FROM users u
        WHERE lower(u.email) = lower($1) AND u.role IN ('Student', 'Librarian')
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
          b.cover_url AS "coverUrl",
          b.description,
          b.rating,
          b.status,
          COALESCE(COUNT(CASE WHEN t.status = 'Approved' THEN 1 END), 0)::int AS "borrowedCount",
          COALESCE(COUNT(CASE WHEN t.status = 'Reserved' THEN 1 END), 0)::int AS "reservedCount"
        FROM books b
        LEFT JOIN transactions t ON b.id = t.book_id
        WHERE b.archived_at IS NULL AND b.status != 'Unavailable'
        GROUP BY b.id
        ORDER BY b.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      const countQuery = `SELECT COUNT(*) FROM books WHERE archived_at IS NULL AND status != 'Unavailable'`;
      
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
          cover_url AS "coverUrl",
          description,
          rating,
          status,
          publisher,
          publication_year AS "publicationYear",
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
      const searchQuery = `%${query}%`;
      const sql = `
        SELECT
          b.id,
          b.title,
          b.author,
          b.isbn,
          b.cover_url AS "coverUrl",
          b.description,
          b.rating,
          b.status
        FROM books b
        WHERE b.archived_at IS NULL 
          AND (
            LOWER(b.title) LIKE LOWER($1) 
            OR LOWER(b.author) LIKE LOWER($1)
            OR LOWER(b.isbn) LIKE LOWER($1)
          )
        ORDER BY b.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      const countSql = `
        SELECT COUNT(*) FROM books 
        WHERE archived_at IS NULL 
          AND (
            LOWER(title) LIKE LOWER($1) 
            OR LOWER(author) LIKE LOWER($1)
            OR LOWER(isbn) LIKE LOWER($1)
          )
      `;

      const [booksResult, countResult] = await Promise.all([
        pool.query(sql, [searchQuery, limit, offset]),
        pool.query(countSql, [searchQuery]),
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
          t.book_id AS "bookId",
          b.title,
          b.author,
          b.cover_url AS "coverUrl",
          t.type,
          t.status,
          t.requested_at AS "requestedAt",
          t.approved_at AS "approvedAt",
          t.due_date AS "dueDate",
          t.returned_at AS "returnedAt"
        FROM transactions t
        JOIN books b ON t.book_id = b.id
        WHERE t.user_id = $1
        ORDER BY t.requested_at DESC
      `;
      const { rows } = await pool.query(query, [userId]);
      return rows;
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
      } = payload;

      const query = `
        INSERT INTO transactions (
          user_id,
          book_id,
          student_name,
          student_id,
          resource_title,
          isbn,
          department,
          type,
          status,
          due_date,
          requested_at
        )
        VALUES (
          $1, $2,
          $3, $4, $5, $6, $7,
          'Borrow', 'Pending',
          $8, NOW()
        )
        RETURNING
          id,
          book_id AS "bookId",
          student_name AS "studentName",
          student_id AS "studentId",
          resource_title AS "resourceTitle",
          isbn,
          department,
          type,
          status,
          requested_at AS "requestedAt",
          due_date AS "dueDate"
      `;

      const { rows } = await pool.query(query, [
        userId,
        bookId,
        studentName,
        studentId,
        resourceTitle,
        isbn,
        department,
        dueDate,
      ]);

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
      } = payload;

      const query = `
        INSERT INTO transactions (
          user_id,
          book_id,
          student_name,
          student_id,
          resource_title,
          isbn,
          department,
          type,
          status,
          due_date,
          requested_at
        )
        VALUES (
          $1, $2,
          $3, $4, $5, $6, $7,
          'Reservation', 'Pending',
          $8, NOW()
        )
        RETURNING
          id,
          book_id AS "bookId",
          student_name AS "studentName",
          student_id AS "studentId",
          resource_title AS "resourceTitle",
          isbn,
          department,
          type,
          status,
          requested_at AS "requestedAt",
          due_date AS "dueDate"
      `;

      const { rows } = await pool.query(query, [
        userId,
        bookId,
        studentName,
        studentId,
        resourceTitle,
        isbn,
        department,
        dueDate,
      ]);

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
        SET status = 'Returned', returned_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          status,
          returned_at AS "returnedAt"
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
      const { name, email } = updates;
      const query = `
        UPDATE users
        SET name = COALESCE($2, name), email = COALESCE($3, email), updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          email,
          role,
          id_number AS "idNumber",
          department,
          course,
          status
      `;
      const { rows } = await pool.query(query, [userId, name, email]);
      return rows[0];
    } catch (error) {
      console.error("DB student:updateUserProfile failed:", error.message);
      throw new Error("Database unavailable for profile update.");
    }
  },
};
