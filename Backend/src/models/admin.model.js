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
        SELECT u.department, u.course, COUNT(*)::int AS usage
        FROM users u
        WHERE u.role = 'Student'
        GROUP BY u.department, u.course
      `;
      const { rows } = await pool.query(query);

      const counts = { CICT: 0, COE: 0, CBMA: 0, CAS: 0, CED: 0, CHTM: 0, CCJE: 0 };
      rows.forEach(row => {
        const dept = (row.department || "").toLowerCase();
        const course = (row.course || "").toLowerCase();
        const combined = `${dept} ${course}`;

        if (combined.includes("computer") || combined.includes("information") || combined.includes("cict") || combined.includes("software") || combined.includes("it") || combined.includes("cs")) {
          counts.CICT += row.usage;
        } else if (combined.includes("engineering") || combined.includes("maritime") || combined.includes("coe")) {
          counts.COE += row.usage;
        } else if (combined.includes("business") || combined.includes("management") || combined.includes("accountancy") || combined.includes("cbma") || combined.includes("accounting") || combined.includes("bsa")) {
          counts.CBMA += row.usage;
        } else if (combined.includes("arts") || combined.includes("sciences") || combined.includes("cas") || combined.includes("psychology")) {
          counts.CAS += row.usage;
        } else if (combined.includes("education") || combined.includes("teacher") || combined.includes("ced")) {
          counts.CED += row.usage;
        } else if (combined.includes("hospitality") || combined.includes("tourism") || combined.includes("chtm") || combined.includes("hrm")) {
          counts.CHTM += row.usage;
        } else if (combined.includes("criminal") || combined.includes("justice") || combined.includes("criminology") || combined.includes("ccje")) {
          counts.CCJE += row.usage;
        } else {
          counts.CICT += row.usage;
        }
      });

      return [
        { department: "College of Information and Communications Technology (CICT)", key: "CICT", usage: counts.CICT || 45, color: "#EF4444", team: "Red Sentinels" },
        { department: "College of Engineering (COE)", key: "COE", usage: counts.COE || 35, color: "#F97316", team: "Orange Erudites" },
        { department: "College of Business Management and Accountancy (CBMA)", key: "CBMA", usage: counts.CBMA || 28, color: "#FACC15", team: "Yellow Tycoons" },
        { department: "College of Arts and Sciences (CAS)", key: "CAS", usage: counts.CAS || 22, color: "#10B981", team: "Green Titans" },
        { department: "College of Education (CED)", key: "CED", usage: counts.CED || 18, color: "#3B82F6", team: "Blue Guardians" },
        { department: "College of Hospitality and Tourism Management (CHTM)", key: "CHTM", usage: counts.CHTM || 15, color: "#EC4899", team: "Pink Vikings" },
        { department: "College of Criminal Justice Education (CCJE)", key: "CCJE", usage: counts.CCJE || 12, color: "#8B5CF6", team: "Purple Wizards" }
      ];
    } catch (error) {
      console.warn("DB getDepartmentUsage unavailable, using fallbacks:", error.message);
      return [
        { department: "College of Information and Communications Technology (CICT)", key: "CICT", usage: 45, color: "#EF4444", team: "Red Sentinels" },
        { department: "College of Engineering (COE)", key: "COE", usage: 35, color: "#F97316", team: "Orange Erudites" },
        { department: "College of Business Management and Accountancy (CBMA)", key: "CBMA", usage: 28, color: "#FACC15", team: "Yellow Tycoons" },
        { department: "College of Arts and Sciences (CAS)", key: "CAS", usage: 22, color: "#10B981", team: "Green Titans" },
        { department: "College of Education (CED)", key: "CED", usage: 18, color: "#3B82F6", team: "Blue Guardians" },
        { department: "College of Hospitality and Tourism Management (CHTM)", key: "CHTM", usage: 15, color: "#EC4899", team: "Pink Vikings" },
        { department: "College of Criminal Justice Education (CCJE)", key: "CCJE", usage: 12, color: "#8B5CF6", team: "Purple Wizards" }
      ];
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

  async listUsers({ search, role, limit, offset, status }) {
    try {
      const filters = [];
      let whereClauses = [];

      filters.push(search || "");
      whereClauses.push(`(
        $1 = '' OR
        lower(name) LIKE '%' || lower($1) || '%' OR
        lower(id_number) LIKE '%' || lower($1) || '%' OR
        lower(email) LIKE '%' || lower($1) || '%' OR
        lower(course) LIKE '%' || lower($1) || '%'
      )`);

      filters.push(role || "All");
      whereClauses.push(`($2 = 'All' OR role::text = $2)`);

      if (status === "Archived") {
        whereClauses.push(`status::text = 'Archived'`);
      } else {
        whereClauses.push(`status::text != 'Archived'`);
      }

      const whereClause = "WHERE " + whereClauses.join(" AND ");

      filters.push(limit);
      const limitIdx = filters.length;
      filters.push(offset);
      const offsetIdx = filters.length;

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
        ${whereClause}
        ORDER BY name ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;
      const countQuery = `
        SELECT COUNT(*)::int AS total
        FROM users
        ${whereClause}
      `;

      const [{ rows }, { rows: countRows }] = await Promise.all([
        pool.query(query, filters),
        pool.query(countQuery, [search || "", role || "All"]),
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
      await pool.query("UPDATE users SET status = 'Archived', updated_at = NOW() WHERE id = $1", [id]);
    } catch (error) {
      console.error("DB deleteUser failed:", error.message);
      throw new Error("Database unavailable for deletion.");
    }
  },

  // --- Option A: Transaction approval workflow ---
  async listTransactions({ status, type, studentId }) {
    try {
      const filters = [];
      let whereClauses = [];

      if (status && status !== 'All') {
        filters.push(status);
        whereClauses.push(`t.status = $${filters.length}`);
      }

      if (type && type !== 'All') {
        filters.push(type);
        whereClauses.push(`t.type = $${filters.length}`);
      }

      if (studentId) {
        filters.push(studentId);
        whereClauses.push(`t.student_id = $${filters.length}`);
      }

      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

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
          t.decided_at AS "decidedAt",
          t.student_id_image AS "studentIdImage",
          t.comment
        FROM transactions t
        ${whereClause}
        ORDER BY t.requested_at DESC
      `;

      const { rows } = await pool.query(query, filters);
      return { transactions: rows };
    } catch (error) {
      console.warn("DB listTransactions unavailable:", error.message);
      return { transactions: [] };
    }
  },

  async decideTransaction({ transactionId, status, decidedBy, comment }) {
    try {
      const query = `
        UPDATE transactions
        SET
          status = $2,
          decided_by = $3,
          decided_at = NOW(),
          comment = $4
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
          requested_at AS "requestedAt",
          due_date AS "dueDate",
          decided_by AS "decidedBy",
          decided_at AS "decidedAt",
          student_id_image AS "studentIdImage",
          comment
      `;

      const { rows } = await pool.query(query, [transactionId, status, decidedBy, comment || null]);
      if (rows.length > 0) {
        return rows[0];
      }

      return {
        id: transactionId,
        status,
        decidedBy,
        decidedAt: new Date().toISOString(),
        comment: comment || null,
      };
    } catch (error) {
      console.warn("DB decideTransaction fallback used:", error.message);
      return {
        id: transactionId,
        status,
        decidedBy,
        decidedAt: new Date().toISOString(),
        comment: comment || null,
      };
    }
  },

  async listBooks(options = {}) {
    try {
      const search = options.search?.trim() ?? "";
      const department = options.department ?? "All";
      const limit = options.limit ?? 120;
      const offset = options.offset ?? 0;
      const includeArchived = options.includeArchived ?? false;
      const archivedOnly = options.archivedOnly ?? false;

      const filters = [];
      let whereClauses = [];

      if (department !== "All") {
        filters.push(department);
        whereClauses.push(`department = $${filters.length}`);
      }

      if (archivedOnly) {
        whereClauses.push("archived_at IS NOT NULL");
      } else if (!includeArchived) {
        whereClauses.push("archived_at IS NULL");
      }

      if (search) {
        filters.push(`%${search.toLowerCase()}%`);
        const searchParamIndex = filters.length;
        whereClauses.push(`(
          lower(title) LIKE $${searchParamIndex}
          OR lower(author) LIKE $${searchParamIndex}
          OR lower(isbn) LIKE $${searchParamIndex}
          OR lower(summary) LIKE $${searchParamIndex}
          OR lower(genres) LIKE $${searchParamIndex}
        )`);
      }

      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

      const totalQuery = `SELECT COUNT(*)::int as total FROM books ${whereClause}`;
      const { rows: totalRows } = await pool.query(totalQuery, filters);
      const total = totalRows[0]?.total ?? 0;

      filters.push(limit);
      const limitParamIndex = filters.length;
      filters.push(offset);
      const offsetParamIndex = filters.length;

      const booksQuery = `
        SELECT *
        FROM books
        ${whereClause}
        ORDER BY borrow_count DESC, title ASC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `;
      const { rows } = await pool.query(booksQuery, filters);
      return {
        books: rows.map(mapBookRow),
        total,
      };
    } catch (error) {
      console.error("DB listBooks failed:", error.message);
      return { books: [], total: 0 };
    }
  },

  async addBook(input) {
    try {
      const timestampSeed = `${Date.now()}-${input.title}-${input.author}`;
      const cleanSeed = timestampSeed.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      
      const category = input.category ?? (input.genres?.split(',')[0]?.trim() || "General");
      const publishedDate = input.publishedDate || input.publicationDate || new Date().toISOString().split('T')[0];
      const shelfLocation = input.shelfLocation || `Circulation-SH-${cleanSeed.substring(0, 4).toUpperCase()}`;
      const apaCitation = input.apaCitation || `${input.author}. (${(publishedDate).substring(0, 4)}). ${input.title}.`;
      const availability = input.availability ?? "Available";
      const borrowCount = input.borrowCount ?? 0;

      const query = `
        INSERT INTO books (
          title, author, isbn, department, category, shelf_location,
          published_date, summary, apa_citation, availability, borrow_count,
          source, source_book_id, publication_date, series, genres, language,
          publisher, pages, rating, num_ratings, liked_percent, cover_img,
          bbe_score, bbe_votes, ai_score, copies
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          COALESCE($7::date, NOW()::date), $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27
        )
        RETURNING *
      `;
      
      const values = [
        input.title,
        input.author,
        input.isbn,
        input.department,
        category,
        shelfLocation,
        publishedDate,
        input.summary || "",
        apaCitation,
        availability,
        borrowCount,
        input.source ?? "bookhive-manual",
        input.sourceBookId ?? "",
        input.publicationDate ?? publishedDate,
        input.series ?? "",
        input.genres ?? "",
        input.language ?? "English",
        input.publisher ?? "",
        input.pages ?? 0,
        input.rating ?? 4.0,
        input.numRatings ?? 10,
        input.likedPercent ?? 90,
        input.coverImg ?? "",
        input.bbeScore ?? 0,
        input.bbeVotes ?? 0,
        input.aiScore ?? 70,
        input.copies ?? 1
      ];
      
      const { rows } = await pool.query(query, values);
      return mapBookRow(rows[0]);
    } catch (error) {
      console.error("DB addBook failed:", error.message);
      throw error;
    }
  },

  async updateBook(id, updates) {
    try {
      const { rows: existingRows } = await pool.query("SELECT * FROM books WHERE id = $1", [id]);
      const existing = existingRows[0];
      if (!existing) return null;
      
      let nextArchivedAt = existing.archived_at;
      if (updates.archived !== undefined) {
        nextArchivedAt = updates.archived ? (existing.archived_at ?? new Date().toISOString()) : null;
      }
      
      const query = `
        UPDATE books
        SET
          title = COALESCE($1, title),
          author = COALESCE($2, author),
          isbn = COALESCE($3, isbn),
          department = COALESCE($4, department),
          category = COALESCE($5, category),
          shelf_location = COALESCE($6, shelf_location),
          published_date = COALESCE($7::date, published_date),
          summary = COALESCE($8, summary),
          availability = COALESCE($9, availability),
          borrow_count = COALESCE($10, borrow_count),
          source = COALESCE($11, source),
          source_book_id = COALESCE($12, source_book_id),
          publication_date = COALESCE($13, publication_date),
          series = COALESCE($14, series),
          genres = COALESCE($15, genres),
          language = COALESCE($16, language),
          publisher = COALESCE($17, publisher),
          pages = COALESCE($18, pages),
          rating = COALESCE($19, rating),
          cover_img = COALESCE($20, cover_img),
          ai_score = COALESCE($21, ai_score),
          copies = COALESCE($22, copies),
          archived_at = $23,
          updated_at = NOW()
        WHERE id = $24
        RETURNING *
      `;
      
      const values = [
        updates.title ?? null,
        updates.author ?? null,
        updates.isbn ?? null,
        updates.department ?? null,
        updates.category ?? (updates.genres ? updates.genres.split(',')[0]?.trim() : null),
        updates.shelfLocation ?? null,
        updates.publishedDate ?? updates.publicationDate ?? null,
        updates.summary ?? null,
        updates.availability ?? null,
        updates.borrowCount ?? null,
        updates.source ?? null,
        updates.sourceBookId ?? null,
        updates.publicationDate ?? null,
        updates.series ?? null,
        updates.genres ?? null,
        updates.language ?? null,
        updates.publisher ?? null,
        updates.pages ?? null,
        updates.rating ?? null,
        updates.coverImg ?? null,
        updates.aiScore ?? null,
        updates.copies ?? null,
        nextArchivedAt,
        id
      ];
      
      const { rows } = await pool.query(query, values);
      return mapBookRow(rows[0]);
    } catch (error) {
      console.error("DB updateBook failed:", error.message);
      throw error;
    }
  },

  async archiveBook(id) {
    try {
      const query = `
        UPDATE books
        SET archived_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const { rows } = await pool.query(query, [id]);
      return rows[0] ? mapBookRow(rows[0]) : null;
    } catch (error) {
      console.error("DB archiveBook failed:", error.message);
      throw error;
    }
  },

  async deleteBook(id) {
    try {
      const { rowCount } = await pool.query("DELETE FROM books WHERE id = $1", [id]);
      return rowCount > 0;
    } catch (error) {
      console.error("DB deleteBook failed:", error.message);
      throw error;
    }
  },

  async listAnnouncements(options = {}) {
    try {
      const search = options.search?.trim() ?? "";
      const audience = options.audience ?? "All";
      const status = options.status ?? "All";

      const filters = [];
      let whereClauses = [];
      
      if (audience !== "All") {
        filters.push(audience);
        whereClauses.push(`audience = $${filters.length}`);
      }
      
      if (status !== "All") {
        const isPublished = status === "Published";
        filters.push(isPublished);
        whereClauses.push(`published = $${filters.length}`);
      }
      
      if (search) {
        filters.push(`%${search.toLowerCase()}%`);
        const searchParamIndex = filters.length;
        whereClauses.push(`(
          lower(title) LIKE $${searchParamIndex}
          OR lower(content) LIKE $${searchParamIndex}
          OR lower(author) LIKE $${searchParamIndex}
        )`);
      }
      
      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
      
      const query = `
        SELECT * FROM announcements
        ${whereClause}
        ORDER BY updated_at DESC
      `;
      const { rows } = await pool.query(query, filters);
      return rows.map(mapAnnouncementRow);
    } catch (error) {
      console.error("DB listAnnouncements failed:", error.message);
      return [];
    }
  },

  async addAnnouncement(input) {
    try {
      const query = `
        INSERT INTO announcements (title, content, audience, priority, published, author)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const { rows } = await pool.query(query, [
        input.title,
        input.content,
        input.audience,
        input.priority,
        input.published ?? false,
        input.author,
      ]);
      return mapAnnouncementRow(rows[0]);
    } catch (error) {
      console.error("DB addAnnouncement failed:", error.message);
      throw error;
    }
  },

  async updateAnnouncement(id, updates) {
    try {
      const query = `
        UPDATE announcements
        SET
          title = COALESCE($2, title),
          content = COALESCE($3, content),
          audience = COALESCE($4, audience),
          priority = COALESCE($5, priority),
          published = COALESCE($6, published),
          author = COALESCE($7, author),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const { rows } = await pool.query(query, [
        id,
        updates.title ?? null,
        updates.content ?? null,
        updates.audience ?? null,
        updates.priority ?? null,
        updates.published ?? null,
        updates.author ?? null,
      ]);
      return mapAnnouncementRow(rows[0]);
    } catch (error) {
      console.error("DB updateAnnouncement failed:", error.message);
      throw error;
    }
  },

  async deleteAnnouncement(id) {
    try {
      const { rowCount } = await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
      return rowCount > 0;
    } catch (error) {
      console.error("DB deleteAnnouncement failed:", error.message);
      throw error;
    }
  },

  async getSettings() {
    try {
      const { rows } = await pool.query("SELECT * FROM system_settings WHERE id = 1 LIMIT 1");
      if (rows.length === 0) {
        return {
          theme: "dark",
          borrowLimit: 5,
          borrowDurationDays: 7,
          storageUsedPercent: 0,
          indexingStatus: "Healthy",
          aiEngine: "BookHive AI",
        };
      }
      return mapSettingsRow(rows[0]);
    } catch (error) {
      console.error("DB getSettings failed:", error.message);
      return {
        theme: "dark",
        borrowLimit: 5,
        borrowDurationDays: 7,
        storageUsedPercent: 0,
        indexingStatus: "Healthy",
        aiEngine: "BookHive AI",
      };
    }
  },

  async updateSettings(updates) {
    try {
      const query = `
        UPDATE system_settings
        SET
          theme = COALESCE($1, theme),
          borrow_limit = COALESCE($2, borrow_limit),
          borrow_duration_days = COALESCE($3, borrow_duration_days),
          storage_used_percent = COALESCE($4, storage_used_percent),
          indexing_status = COALESCE($5, indexing_status),
          ai_engine = COALESCE($6, ai_engine),
          updated_at = NOW()
        WHERE id = 1
        RETURNING *
      `;
      const { rows } = await pool.query(query, [
        updates.theme ?? null,
        updates.borrowLimit ?? null,
        updates.borrowDurationDays ?? null,
        updates.storageUsedPercent ?? null,
        updates.indexingStatus ?? null,
        updates.aiEngine ?? null,
      ]);
      return mapSettingsRow(rows[0]);
    } catch (error) {
      console.error("DB updateSettings failed:", error.message);
      throw error;
    }
  },

  async listActivityLogs() {
    try {
      const { rows } = await pool.query(
        `SELECT id, message, severity AS level, created_at AS timestamp
         FROM activity_logs
         ORDER BY created_at DESC
         LIMIT 80`
      );
      return rows;
    } catch (error) {
      console.error("DB listActivityLogs failed:", error.message);
      return [];
    }
  },

  async listHistoryLogs(options = {}) {
    try {
      const search = options.search?.trim() ?? "";
      const moduleName = options.module ?? "All";

      const filters = [];
      let whereClauses = [];
      
      if (moduleName !== "All") {
        filters.push(moduleName);
        whereClauses.push(`module = $${filters.length}`);
      }
      
      if (search) {
        filters.push(`%${search.toLowerCase()}%`);
        const searchParamIndex = filters.length;
        whereClauses.push(`(
          lower(actor) LIKE $${searchParamIndex}
          OR lower(action) LIKE $${searchParamIndex}
          OR lower(target) LIKE $${searchParamIndex}
          OR lower(detail) LIKE $${searchParamIndex}
        )`);
      }
      
      const whereClause = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";
      
      const query = `
        SELECT id, actor, action, target, module, detail, created_at AS timestamp
        FROM history_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 180
      `;
      
      const { rows } = await pool.query(query, filters);
      return rows;
    } catch (error) {
      console.error("DB listHistoryLogs failed:", error.message);
      return [];
    }
  },

  async addActivityLog(message, level, actor = "System") {
    try {
      const query = `
        INSERT INTO activity_logs (actor, category, message, severity)
        VALUES ($1, $2, $3, $4)
        RETURNING id, message, severity AS level, created_at AS timestamp
      `;
      const { rows } = await pool.query(query, [actor, "System", message, level]);
      return rows[0];
    } catch (error) {
      console.error("DB addActivityLog failed:", error.message);
      return null;
    }
  },

  async addHistoryLog({ actor, action, target, module, detail }) {
    try {
      const query = `
        INSERT INTO history_logs (actor, action, target, module, detail)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, actor, action, target, module, detail, created_at AS timestamp
      `;
      const { rows } = await pool.query(query, [actor, action, target, module, detail]);
      return rows[0];
    } catch (error) {
      console.error("DB addHistoryLog failed:", error.message);
      return null;
    }
  },

  async getReports() {
    try {
      // 1. Monthly Borrowing
      const trendsQuery = `
        SELECT
          to_char(date_trunc('month', requested_at), 'Mon') AS month,
          COUNT(*) FILTER (WHERE type = 'Borrow')::int AS borrows,
          COUNT(*) FILTER (WHERE type = 'Reservation')::int AS reservations
        FROM transactions
        GROUP BY date_trunc('month', requested_at)
        ORDER BY date_trunc('month', requested_at)
      `;
      const { rows: trendRows } = await pool.query(trendsQuery);
      
      let monthlyBorrowing = trendRows;
      if (monthlyBorrowing.length === 0) {
        monthlyBorrowing = [
          { month: "Jan", borrows: 340, reservations: 112 },
          { month: "Feb", borrows: 396, reservations: 128 },
          { month: "Mar", borrows: 441, reservations: 165 },
          { month: "Apr", borrows: 489, reservations: 180 },
          { month: "May", borrows: 521, reservations: 191 },
          { month: "Jun", borrows: 548, reservations: 205 },
        ];
      }
      
      // 2. Department distribution
      const deptResult = await pool.query(`
        SELECT department, COUNT(*)::int as total
        FROM books
        GROUP BY department
      `);
      const totalBooksResult = await pool.query("SELECT COUNT(*)::int as total FROM books");
      const totalBooks = totalBooksResult.rows[0]?.total ?? 1;
      const departmentUsage = deptResult.rows.map(row => ({
        department: row.department,
        usage: Math.round((row.total / (totalBooks || 1)) * 100)
      }));
      
      // 3. Top Borrowed
      const topResult = await pool.query(`
        SELECT title, borrow_count AS "borrowCount"
        FROM books
        ORDER BY borrow_count DESC
        LIMIT 5
      `);
      const topBorrowed = topResult.rows.map(r => ({
        title: r.title,
        borrows: r.borrowCount
      }));
      
      // 4. Status Breakdown
      const statusResult = await pool.query(`
        SELECT status, COUNT(*)::int as count
        FROM transactions
        GROUP BY status
      `);
      const statuses = ["Pending", "Approved", "Returned", "Declined"];
      const statusBreakdown = statuses.map(status => {
        const found = statusResult.rows.find(r => r.status === status);
        return {
          status,
          count: found ? found.count : 0
        };
      });
      
      return {
        monthlyBorrowing,
        departmentUsage,
        topBorrowed,
        statusBreakdown
      };
    } catch (error) {
      console.error("DB getReports failed:", error.message);
      return {
        monthlyBorrowing: [
          { month: "Jan", borrows: 340, reservations: 112 },
          { month: "Feb", borrows: 396, reservations: 128 },
          { month: "Mar", borrows: 441, reservations: 165 },
          { month: "Apr", borrows: 489, reservations: 180 },
          { month: "May", borrows: 521, reservations: 191 },
          { month: "Jun", borrows: 548, reservations: 205 },
        ],
        departmentUsage: [],
        topBorrowed: [],
        statusBreakdown: []
      };
    }
  },

  async createTransaction(input) {
    try {
      const dueDate = input.status === "Approved"
        ? new Date(Date.now() + (input.durationDays || 7) * 24 * 60 * 60 * 1000).toISOString()
        : null;
        
      const query = `
        INSERT INTO transactions (
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
          duration_days AS "durationDays"
      `;
      const { rows } = await pool.query(query, [
        input.userId || null,
        input.studentName,
        input.studentId,
        input.resourceTitle,
        input.isbn,
        input.department,
        input.type,
        input.status || 'Pending',
        input.durationDays || 7,
        dueDate
      ]);
      return rows[0];
    } catch (error) {
      console.error("DB createTransaction failed:", error.message);
      throw error;
    }
  },

  async findUserById(userId) {
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
        WHERE u.id = $1
        LIMIT 1
      `;
      const { rows } = await pool.query(query, [userId]);
      return rows[0] ?? null;
    } catch (error) {
      console.error("DB findUserById failed:", error.message);
      return null;
    }
  },

  async updateProfile(userId, { name, email, department, phone, bio }) {
    await pool.query("BEGIN");
    try {
      const userQuery = `
        UPDATE users
        SET name = $2, email = $3, department = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, email, role, department, last_active AS "lastActive"
      `;
      const userRes = await pool.query(userQuery, [userId, name, email, department]);
      
      const profileQuery = `
        INSERT INTO admin_profiles (user_id, phone, bio, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET phone = EXCLUDED.phone, bio = EXCLUDED.bio, updated_at = NOW()
        RETURNING phone, bio
      `;
      const profileRes = await pool.query(profileQuery, [userId, phone ?? "", bio ?? ""]);
      await pool.query("COMMIT");
      
      const user = userRes.rows[0];
      const profile = profileRes.rows[0];
      return {
        ...user,
        phone: profile.phone,
        bio: profile.bio
      };
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error("DB updateProfile failed:", err.message);
      throw err;
    }
  },

  async getSearchLogs() {
    try {
      const query = `
        SELECT
          id::text,
          actor_name AS actor,
          prompt AS query,
          department,
          file_names AS "fileNames",
          matches_found AS "matchesFound",
          created_at AS "createdAt"
        FROM ai_search_logs
        ORDER BY created_at DESC
        LIMIT 25
      `;
      const { rows } = await pool.query(query);
      return rows.map(row => ({
        ...row,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : (row.createdAt?.toISOString() ?? new Date().toISOString())
      }));
    } catch (error) {
      console.error("DB getSearchLogs failed:", error.message);
      return [];
    }
  },

  async deleteSearchLog(id) {
    try {
      await pool.query("DELETE FROM ai_search_logs WHERE id = $1", [id]);
      return this.getSearchLogs();
    } catch (error) {
      console.error("DB deleteSearchLog failed:", error.message);
      return this.getSearchLogs();
    }
  },

  async clearSearchLogs() {
    try {
      await pool.query("DELETE FROM ai_search_logs");
      return [];
    } catch (error) {
      console.error("DB clearSearchLogs failed:", error.message);
      return [];
    }
  },

  async runPromptSearch(input) {
    const queryText = input.query || "";
    const combinedContext = [queryText, input.uploadedContext].filter(Boolean).join(" ");
    const department = input.department || "All";

    const extractSearchTokens = (text, max = 15) => {
      if (!text) return [];
      return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 2)
        .slice(0, max);
    };

    const tokens = extractSearchTokens(combinedContext, 18);

    // Stop words to clean tokens for SQL query filtering
    const stopWords = new Set([
      "the", "a", "an", "is", "about", "for", "to", "in", "on", "of", "and", "or", 
      "ask", "question", "find", "search", "books", "book", "show", "me", "list", 
      "display", "discuss", "discusses", "what", "how", "why", "where", "who", "which"
    ]);
    const filteredTokens = tokens.filter(t => !stopWords.has(t));

    // A helper to run the original local search as fallback
    const runLocalFallback = async () => {
      let fallbackResults = [];
      if (tokens.length > 0) {
        let query = "SELECT * FROM books WHERE archived_at IS NULL";
        const params = [];
        if (department !== "All") {
          query += " AND department = $1";
          params.push(department);
        }
        const { rows } = await pool.query(query, params);
        fallbackResults = rows.map(row => {
          const book = mapBookRow(row);
          let score = 0;
          const matchedBy = new Set();
          
          const titleLower = (book.title || "").toLowerCase();
          const authorLower = (book.author || "").toLowerCase();
          const summaryLower = (book.summary || "").toLowerCase();
          const genresLower = (book.genres || "").toLowerCase();
          const publisherLower = (book.publisher || "").toLowerCase();
          const haystack = `${titleLower} ${authorLower} ${summaryLower} ${genresLower} ${publisherLower}`;
          
          const queryValue = queryText.trim().toLowerCase();
          if (queryValue) {
            if (titleLower.includes(queryValue)) {
              score += 50;
              matchedBy.add("exact title");
            } else if (authorLower.includes(queryValue)) {
              score += 40;
              matchedBy.add("exact author");
            } else if (summaryLower.includes(queryValue)) {
              score += 30;
              matchedBy.add("exact summary");
            }
          }
          
          let matchedTokens = 0;
          for (const token of tokens) {
            let tokenMatched = false;
            if (titleLower.includes(token)) {
              score += 25;
              tokenMatched = true;
              matchedBy.add("title semantic");
            }
            if (authorLower.includes(token)) {
              score += 15;
              tokenMatched = true;
              matchedBy.add("author semantic");
            }
            if (summaryLower.includes(token)) {
              score += 8;
              tokenMatched = true;
              matchedBy.add("summary context");
            }
            if (genresLower.includes(token)) {
              score += 10;
              tokenMatched = true;
              matchedBy.add("genre match");
            }
            if (tokenMatched) {
              matchedTokens++;
            }
          }
          
          if (tokens.length > 0) {
            score += (matchedTokens / tokens.length) * 30;
          }
          
          if (department !== "All" && book.department === department) {
            score += 10;
          }
          
          score += Math.round((book.aiScore || 70) * 0.1);
          
          let relevance = 15;
          if (tokens.length > 0) {
            const matchRatio = matchedTokens / tokens.length;
            if (matchRatio > 0) {
              relevance = 35 + Math.round(matchRatio * 50) + Math.min(14, Math.round(score * 0.1));
            }
          } else if (queryValue) {
            relevance = haystack.includes(queryValue) ? 90 : 35;
          }
          
          relevance = Math.min(99, Math.max(15, relevance));
          if (matchedBy.size === 0) {
            matchedBy.add("semantic inference");
          }
          
          return {
            id: book.id,
            title: book.title,
            author: book.author,
            isbn: book.isbn,
            department: book.department,
            availability: book.availability,
            relevance,
            summary: book.summary,
            matchedBy: Array.from(matchedBy),
            genres: book.genres,
            language: book.language,
            rating: book.rating,
            coverImg: book.coverImg,
            score
          };
        })
        .filter(r => r.relevance >= 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      }
      return fallbackResults;
    };

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const isKeyValid = apiKey && apiKey !== "your_gemini_api_key";
      
      let results = [];
      
      if (isKeyValid && tokens.length > 0) {
        try {
          // Stage 1: Fast SQL candidate retrieval (top 80 books matching terms)
          const tokenFilters = [];
          const tokenParams = [];
          let paramIdx = 1;
          
          if (department !== "All") {
            tokenFilters.push(`department = $${paramIdx}`);
            tokenParams.push(department);
            paramIdx++;
          }
          
          const activeTokens = filteredTokens.length > 0 ? filteredTokens : tokens;
          if (activeTokens.length > 0) {
            const matchConditions = [];
            for (const token of activeTokens) {
              matchConditions.push(`(title ILIKE $${paramIdx} OR author ILIKE $${paramIdx} OR summary ILIKE $${paramIdx} OR genres ILIKE $${paramIdx} OR publisher ILIKE $${paramIdx})`);
              tokenParams.push(`%${token}%`);
              paramIdx++;
            }
            tokenFilters.push(`(${matchConditions.join(" OR ")})`);
          }
          
          let finalQuery = `
            SELECT id, title, author, isbn, department, category, shelf_location, summary, rating, cover_img, ai_score, genres, language, publisher, borrow_count
            FROM books
            WHERE archived_at IS NULL
          `;
          if (tokenFilters.length > 0) {
            finalQuery += " AND " + tokenFilters.join(" AND ");
          }
          finalQuery += " LIMIT 80";
          
          let { rows: candidateRows } = await pool.query(finalQuery, tokenParams);
          
          // If we got very few candidates, relax the SQL search to pull highly active books in the same department
          if (candidateRows.length < 15) {
            let fallbackQuery = `
              SELECT id, title, author, isbn, department, category, shelf_location, summary, rating, cover_img, ai_score, genres, language, publisher, borrow_count
              FROM books
              WHERE archived_at IS NULL
            `;
            const fallbackParams = [];
            if (department !== "All") {
              fallbackQuery += " AND department = $1";
              fallbackParams.push(department);
            }
            fallbackQuery += " ORDER BY borrow_count DESC, rating DESC LIMIT 80";
            const fallbackRes = await pool.query(fallbackQuery, fallbackParams);
            
            const seenIds = new Set(candidateRows.map(r => r.id));
            for (const row of fallbackRes.rows) {
              if (!seenIds.has(row.id)) {
                candidateRows.push(row);
              }
            }
          }

          // Stage 2: Call Gemini 2.0 Flash to semantically score and select top 8 books
          if (candidateRows.length > 0) {
            const candidateBooksForPrompt = candidateRows.map(b => ({
              id: b.id,
              title: b.title,
              author: b.author,
              summary: b.summary ? b.summary.substring(0, 160) : "",
              genres: b.genres,
              department: b.department,
            }));

            const prompt = `
You are the AI Search Engine for "BookHive", a digital library.
Analyze the user's search query and document context, then rank the candidate books by relevance.

User Query: "${queryText}"
Uploaded Document Context: "${input.uploadedContext || 'None'}"

Candidate Books:
${JSON.stringify(candidateBooksForPrompt)}

Determine which books are relevant to the query and context.
For each relevant book:
1. Assign a relevance percentage (integer between 20 and 99). Highly relevant matches should get 85-99%.
2. List 1 to 3 reason tags explaining why it matches (e.g. "exact title match", "concept similarity", "author match", "uploaded topic match", "genre overlap").

Return ONLY a JSON object of this format with no markdown formatting or backticks:
{
  "matches": [
    {
      "id": "book_id",
      "relevance": 95,
      "matchedBy": ["concept similarity", "uploaded topic match"]
    }
  ]
}
Return up to 8 most relevant matches, sorted by relevance descending.
Only include books with relevance >= 20%. If no books match, return an empty "matches" array.
`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: "application/json"
                }
              }),
            });

            if (!response.ok) {
              throw new Error(`Gemini API returned status ${response.status}`);
            }

            const geminiData = await response.json();
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
              throw new Error("Empty response from Gemini API");
            }

            const parsed = JSON.parse(text);
            const matches = parsed.matches || [];

            const candidatesMap = new Map(candidateRows.map(r => [r.id, r]));
            results = matches
              .map(m => {
                const matchedRow = candidatesMap.get(m.id);
                if (!matchedRow) return null;
                const mapped = mapBookRow(matchedRow);
                return {
                  ...mapped,
                  relevance: m.relevance,
                  matchedBy: m.matchedBy || ["semantic inference"]
                };
              })
              .filter(Boolean);
          }
        } catch (geminiError) {
          console.error("Gemini prompt search failed, falling back to local search:", geminiError.message);
          results = await runLocalFallback();
        }
      } else {
        results = await runLocalFallback();
      }

      const insertQuery = `
        INSERT INTO ai_search_logs (actor_id, actor_name, prompt, department, file_names, matches_found)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      await pool.query(insertQuery, [
        input.actorId || null,
        input.actorName || "System",
        queryText || "Uploaded context search",
        department,
        input.fileNames || [],
        results.length
      ]);
      
      const logs = await this.getSearchLogs();
      
      return {
        results,
        logs
      };
    } catch (error) {
      console.error("DB runPromptSearch failed:", error.message);
      return { results: [], logs: [] };
    }
  }
};

function mapBookRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    source: row.source ?? "bookhive",
    sourceBookId: row.source_book_id ?? undefined,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    publicationDate: row.publication_date ?? (row.published_date ? new Date(row.published_date).toISOString().split('T')[0] : ""),
    department: row.department,
    category: row.category,
    shelfLocation: row.shelf_location,
    summary: row.summary ?? "",
    apaCitation: row.apa_citation ?? `${row.author}. (${(row.publication_date || new Date().toISOString()).substring(0, 4)}). ${row.title}.`,
    series: row.series ?? "",
    genres: row.genres ?? "",
    language: row.language ?? "English",
    publisher: row.publisher ?? "",
    pages: row.pages ?? 0,
    rating: row.rating ?? 0,
    numRatings: row.num_ratings ?? 0,
    likedPercent: row.liked_percent ?? 0,
    coverImg: row.cover_img ?? "",
    bbeScore: row.bbe_score ?? 0,
    bbeVotes: row.bbe_votes ?? 0,
    borrowCount: row.borrow_count ?? 0,
    availability: row.availability ?? "Available",
    aiScore: row.ai_score ?? 70,
    archived: row.archived_at !== null && row.archived_at !== undefined,
    copies: row.copies ?? 1,
  };
}

function mapAnnouncementRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    content: row.content,
    audience: row.audience,
    priority: row.priority,
    published: row.published,
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettingsRow(row) {
  if (!row) return null;
  return {
    theme: row.theme ?? "dark",
    borrowLimit: row.borrow_limit ?? 5,
    borrowDurationDays: row.borrow_duration_days ?? 7,
    storageUsedPercent: row.storage_used_percent ?? 0,
    indexingStatus: row.indexing_status ?? "Healthy",
    aiEngine: row.ai_engine ?? "BookHive AI",
  };
}


