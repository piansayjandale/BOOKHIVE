import { pool } from "../db/pool.js";

export const adminModel = {
  async findUserByIdentifier(identifier) {
    try {
      const query = `
        SELECT
          u.id,
          u.name,
          u.id_number AS "idNumber",
          u.email,
          u.password_hash AS "passwordHash",
          u.role,
          u.department,
          u.course,
          u.status,
          u.last_active AS "lastActive",
          p.phone,
          p.bio
        FROM users u
        LEFT JOIN admin_profiles p ON p.user_id = u.id
        WHERE lower(u.email) = lower($1) OR lower(u.id_number) = lower($1)
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [identifier]);
      return rows[0] ?? null;
    } catch (error) {
      console.warn("DB findUserByIdentifier unavailable, using fallback:", error.message);
      return null;
    }
  },

  async getDashboardSummary() {
    try {
      const query = `
        SELECT
          (SELECT COUNT(*) FROM users) AS "totalUsers",
          (SELECT COUNT(*) FROM books WHERE archived_at IS NULL) AS "totalBooks",
          (SELECT COUNT(*) FROM transactions WHERE type = 'Borrow' AND status = 'Approved') AS "activeBorrowedBooks",
          (SELECT COUNT(*) FROM transactions WHERE status = 'Pending') AS "pendingRequests"
      `;
      const { rows } = await pool.query(query);
      return rows[0];
    } catch (error) {
      console.warn("DB getDashboardSummary unavailable:", error.message);
      return {
        totalUsers: 0,
        totalBooks: 0,
        activeBorrowedBooks: 0,
        pendingRequests: 0,
      };
    }
  },

  async getMonthlyBorrowTrends() {
    try {
      const query = `
        SELECT
          to_char(date_trunc('month', requested_at), 'Mon') AS month,
          COUNT(*) FILTER (WHERE type = 'Borrow')::int AS borrows,
          COUNT(*) FILTER (WHERE type = 'Return')::int AS returns,
          COUNT(*) FILTER (WHERE type = 'Reservation')::int AS reservations
        FROM transactions
        GROUP BY date_trunc('month', requested_at)
        ORDER BY date_trunc('month', requested_at)
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.warn("DB getMonthlyBorrowTrends unavailable:", error.message);
      return [];
    }
  },

  async getDepartmentUsage() {
    try {
      const query = `
        SELECT department, COUNT(*)::int AS usage
        FROM transactions
        GROUP BY department
        ORDER BY usage DESC, department ASC
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.warn("DB getDepartmentUsage unavailable:", error.message);
      return [];
    }
  },

  async getRecentActivities() {
    try {
      const query = `
        SELECT id, actor, message, category, severity, created_at AS timestamp
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 8
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.warn("DB getRecentActivities unavailable:", error.message);
      return [];
    }
  },

  async getRecentUsers() {
    try {
      const query = `
        SELECT
          id,
          name,
          id_number AS "idNumber",
          email,
          role,
          department,
          course,
          status,
          last_active AS "lastActive"
        FROM users
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.warn("DB getRecentUsers unavailable:", error.message);
      return [];
    }
  },

  async getLatestTransactions() {
    try {
      const query = `
        SELECT
          id,
          student_name AS "studentName",
          student_id AS "studentId",
          resource_title AS "resourceTitle",
          isbn,
          type,
          status,
          requested_at AS "requestedAt",
          due_date AS "dueDate",
          department,
          duration_days AS "durationDays"
        FROM transactions
        ORDER BY requested_at DESC
        LIMIT 8
      `;
      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.warn("DB getLatestTransactions unavailable:", error.message);
      return [];
    }
  },

  async listUsers({ search, role, limit, offset }) {
    try {
      const query = `
        SELECT
          id,
          name,
          id_number AS "idNumber",
          email,
          role,
          department,
          course,
          status,
          last_active AS "lastActive"
        FROM users
        WHERE (
          $1 = '' OR
          lower(name) LIKE '%' || lower($1) || '%' OR
          lower(id_number) LIKE '%' || lower($1) || '%' OR
          lower(email) LIKE '%' || lower($1) || '%' OR
          lower(course) LIKE '%' || lower($1) || '%'
        )
        AND ($2 = 'All' OR role = $2)
        ORDER BY name ASC
        LIMIT $3 OFFSET $4
      `;
      const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM users
        WHERE (
          $1 = '' OR
          lower(name) LIKE '%' || lower($1) || '%' OR
          lower(id_number) LIKE '%' || lower($1) || '%' OR
          lower(email) LIKE '%' || lower($1) || '%' OR
          lower(course) LIKE '%' || lower($1) || '%'
        )
        AND ($2 = 'All' OR role = $2)
      `;

      const [{ rows }, { rows: countRows }] = await Promise.all([
        pool.query(query, [search, role, limit, offset]),
        pool.query(countQuery, [search, role]),
      ]);

      return {
        rows,
        total: countRows[0]?.total ?? 0,
      };
    } catch (error) {
      console.warn("DB listUsers unavailable:", error.message);
      return { rows: [], total: 0 };
    }
  },

  async createUser(input) {
    try {
      const query = `
        INSERT INTO users (
          name,
          id_number,
          email,
          password_hash,
          role,
          department,
          course,
          status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'Active')
        RETURNING
          id,
          name,
          id_number AS "idNumber",
          email,
          role,
          department,
          course,
          status,
          last_active AS "lastActive"
      `;
      const values = [
        input.name,
        input.idNumber,
        input.email,
        input.passwordHash,
        input.role,
        input.department,
        input.course,
      ];
      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error("DB createUser failed:", error.message);
      throw new Error("Database unavailable for writing.");
    }
  },

  async updateUser(id, input) {
    try {
      const query = `
        UPDATE users
        SET
          name = COALESCE($2, name),
          id_number = COALESCE($3, id_number),
          email = COALESCE($4, email),
          role = COALESCE($5, role),
          department = COALESCE($6, department),
          course = COALESCE($7, course),
          status = COALESCE($8, status)
        WHERE id = $1
        RETURNING
          id,
          name,
          id_number AS "idNumber",
          email,
          role,
          department,
          course,
          status,
          last_active AS "lastActive"
      `;
      const values = [
        id,
        input.name ?? null,
        input.idNumber ?? null,
        input.email ?? null,
        input.role ?? null,
        input.department ?? null,
        input.course ?? null,
        input.status ?? null,
      ];
      const { rows } = await pool.query(query, values);
      return rows[0] ?? null;
    } catch (error) {
      console.error("DB updateUser failed:", error.message);
      throw new Error("Database unavailable for updating.");
    }
  },

  async deleteUser(id) {
    try {
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
    } catch (error) {
      console.error("DB deleteUser failed:", error.message);
      throw new Error("Database unavailable for deletion.");
    }
  },

  // --- Option A: Transaction approval workflow ---
  async listTransactions({ status, type }) {
    try {
      const query = `
        SELECT
          t.id,
          t.user_id AS "userId",
          t.student_name AS "studentName",
          t.student_id AS "studentId",
          t.resource_title AS "resourceTitle",
          t.isbn,
          t.department,
          t.type,
          t.status,
          t.requested_at AS "requestedAt",
          t.due_date AS "dueDate",
          t.decided_by AS "decidedBy",
          t.decided_at AS "decidedAt"
        FROM transactions t
        WHERE t.status = $1
        ${type ? "AND t.type = $2" : ""}
        ORDER BY t.requested_at DESC
      `;

      const values = type ? [status, type] : [status];
      const { rows } = await pool.query(query, values);
      return { transactions: rows };
    } catch (error) {
      console.warn("DB listTransactions unavailable:", error.message);
      return { transactions: [] };
    }
  },

  async decideTransaction({ transactionId, status, decidedBy }) {
    try {
      // Only allow deciding transactions that are still pending
      const query = `
        UPDATE transactions
        SET
          status = $2,
          decided_by = $3,
          decided_at = NOW()
        WHERE id = $1
          AND status = 'Pending'
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
          decided_by AS "decidedBy",
          decided_at AS "decidedAt"
      `;

      const { rows } = await pool.query(query, [transactionId, status, decidedBy]);
      return rows[0] ?? null;
    } catch (error) {
      console.error("DB decideTransaction failed:", error.message);
      throw new Error("Database unavailable for transaction decisions.");
    }
  },
};

