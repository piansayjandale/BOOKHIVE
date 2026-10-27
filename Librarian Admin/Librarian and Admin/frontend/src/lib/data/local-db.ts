import { randomUUID } from "node:crypto";
import snapshotData from "./localhost-tables.json";
import { readCatalogImportSnapshot } from "@/lib/catalog/import-snapshot";
import { seedBooks } from "./seed";

type LocalDbState = {
  users: any[];
  transactions: any[];
  history_logs: any[];
  activity_logs: any[];
  admin_auth_logs: any[];
  ai_search_logs: any[];
  announcements: any[];
  digitized_books: any[];
  system_settings: any[];
  system_backups: any[];
  admin_profiles: any[];
  institutional_sync_logs: any[];
  reservations: any[];
  violations: any[];
  books: any[] | null;
};

declare global {
  var __bookhiveLocalDbState: LocalDbState | undefined;
}

function clone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export function getLocalDbState(): LocalDbState {
  if (!globalThis.__bookhiveLocalDbState) {
    globalThis.__bookhiveLocalDbState = {
      users: clone((snapshotData as any).users || []),
      transactions: clone((snapshotData as any).transactions || []),
      history_logs: clone((snapshotData as any).history_logs || []),
      activity_logs: clone((snapshotData as any).activity_logs || []),
      admin_auth_logs: clone((snapshotData as any).admin_auth_logs || []),
      ai_search_logs: clone((snapshotData as any).ai_search_logs || []),
      announcements: clone((snapshotData as any).announcements || []),
      digitized_books: clone((snapshotData as any).digitized_books || []),
      system_settings: clone((snapshotData as any).system_settings || []),
      system_backups: clone((snapshotData as any).system_backups || []),
      admin_profiles: clone((snapshotData as any).admin_profiles || []),
      institutional_sync_logs: [],
      reservations: [],
      violations: [],
      books: null,
    };
  }
  return globalThis.__bookhiveLocalDbState;
}

export function getLocalBooksRows(): any[] {
  const state = getLocalDbState();
  if (!state.books) {
    const snap = readCatalogImportSnapshot();
    const sourceBooks = snap.length > 0 ? snap : seedBooks;
    state.books = sourceBooks.map((b: any, idx: number) => ({
      id: String(b.id || `book-${idx + 1}`),
      isbn: b.isbn || "N/A",
      title: b.title || "Untitled",
      author: b.author || "Unknown Author",
      department: b.department || "Circulation",
      category: b.genres?.split(",")[0]?.trim() || b.department || "General",
      genres: b.genres || b.department || "General",
      shelf_location: b.shelfLocation || "CIR-01A.1",
      summary: b.summary || "",
      publication_date: b.publicationDate || "2024-01-01",
      published_date: b.publicationDate || "2024-01-01",
      apa_citation: `${b.author || "Unknown"}. (${String(b.publicationDate || "2024").slice(0, 4)}). ${b.title}.`,
      availability: b.availability || "Available",
      borrow_count: Number(b.borrowCount || 0),
      ai_score: Number(b.aiScore || 75),
      copies: Number(b.copies || 1),
      archived_at: b.archived ? "2026-10-01T00:00:00.000Z" : null,
      created_at: (b as any).createdAt || "2025-01-01T00:00:00.000Z",
      updated_at: (b as any).createdAt || "2025-01-01T00:00:00.000Z",
      volume: b.volume || "Single Volume / None",
      edition: b.edition || "Single Edition / None",
      series: b.series || "",
      publisher: b.publisher || "",
      language: b.language || "English",
      pages: Number(b.pages || 0),
      rating: Number(b.rating || 4.5),
      num_ratings: 100,
      liked_percent: 90,
      cover_img: b.coverImg || "",
      accession_number: b.accessionNumber || `ACC-2026-${String(idx + 1).padStart(4, "0")}`,
      price: Number(b.price || 0),
      source: (b as any).createdAt ? "bookhive-manual" : "bookhive",
    }));
  }
  return state.books;
}

function computeBookLoanCounts(state: LocalDbState) {
  const borrowedByIsbn = new Map<string, number>();
  const reservedByIsbn = new Map<string, number>();
  for (const t of state.transactions) {
    const isbn = String(t.isbn || "").trim();
    if (!isbn) continue;
    if (t.type === "Borrow" && (t.status === "Borrowed" || t.status === "Overdue" || t.status === "Approved" || t.status === "Pending")) {
      borrowedByIsbn.set(isbn, (borrowedByIsbn.get(isbn) || 0) + 1);
    } else if ((t.type === "Reserve" || t.type === "Reservation") && (t.status === "Pending" || t.status === "Approved")) {
      reservedByIsbn.set(isbn, (reservedByIsbn.get(isbn) || 0) + 1);
    }
  }
  return { borrowedByIsbn, reservedByIsbn };
}

function mapStudentBookRow(b: any, borrowedByIsbn: Map<string, number>, reservedByIsbn: Map<string, number>) {
  return {
    ...b,
    id: String(b.id),
    shelfLocation: b.shelf_location,
    shelf: b.shelf_location,
    description: b.summary,
    coverImg: b.cover_img || "",
    cover_img: b.cover_img || "",
    coverUrl: b.cover_img || "",
    coverImage: b.cover_img || "",
    publicationDate: b.publication_date,
    publishedDate: b.published_date,
    accessionNumber: b.accession_number,
    borrowCount: Number(b.borrow_count || 0),
    borrowedCount: borrowedByIsbn.get(b.isbn) || 0,
    reservedCount: reservedByIsbn.get(b.isbn) || 0,
    borrowed_count: borrowedByIsbn.get(b.isbn) || 0,
    reserved_count: reservedByIsbn.get(b.isbn) || 0,
  };
}

function throwOffline(): never {
  const err: any = new Error("Database offline: delegating to in-memory repository.");
  err.code = "DB_OFFLINE";
  throw err;
}

export async function executeLocalSqlFallback(rawSql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
  const sql = rawSql.replace(/\s+/g, " ").trim();
  const sqlLower = sql.toLowerCase();
  const state = getLocalDbState();

  // 1. Health checks & index maintenance statements
  if (
    sqlLower === "select 1" ||
    sqlLower.startsWith("vacuum") ||
    sqlLower.startsWith("reindex") ||
    sqlLower.startsWith("create index")
  ) {
    return { rows: [{ "?column?": 1 }], rowCount: 1 };
  }

  if (sqlLower.startsWith("create table") || sqlLower.startsWith("alter table")) {
    throwOffline();
  }

  // 2. Digitized books
  if (sqlLower.includes("from digitized_books") || sqlLower.includes("into digitized_books") || sqlLower.includes("update digitized_books")) {
    if (sqlLower.startsWith("select")) {
      if (sqlLower.includes("where id = $1")) {
        const id = String(params[0] || "");
        const rows = state.digitized_books.filter((r) => String(r.id) === id);
        return { rows, rowCount: rows.length };
      }
      return { rows: state.digitized_books, rowCount: state.digitized_books.length };
    }
    if (sqlLower.startsWith("insert into digitized_books")) {
      const newRecord = {
        id: randomUUID(),
        title: params[0] || "Untitled Scanned Document",
        author: params[1] || "Unknown Author",
        isbn: params[2] || "N/A",
        department: params[3] || "Circulation",
        category: params[4] || "General",
        summary: params[5] || "",
        ocr_text: params[6] || "",
        file_name: params[7] || "scan.jpg",
        file_size: params[8] || "120 KB",
        page_count: Number(params[9] || 1),
        status: params[10] || "Pending Review",
        scanned_by: params[11] || "Librarian",
        volume: params[12] || "None",
        edition: params[13] || "None",
        copies: Number(params[14] || 1),
        shelf_location: params[15] || "CIR-01A.1",
        published_year: params[16] || "2026",
        publisher: params[17] || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      state.digitized_books.unshift(newRecord);
      return { rows: [newRecord], rowCount: 1 };
    }
    if (sqlLower.startsWith("update digitized_books")) {
      const id = String(params[0] || "");
      const found = state.digitized_books.find((r) => String(r.id) === id);
      if (found) {
        found.status = "Approved";
        found.updated_at = new Date().toISOString();
        return { rows: [found], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
  }

  // 3. System Settings
  if (sqlLower.includes("system_settings")) {
    if (state.system_settings.length === 0) {
      state.system_settings.push({
        id: 1,
        theme: "dark",
        borrow_limit: 5,
        borrow_duration_days: 7,
        storage_used_percent: 84,
        indexing_status: "Healthy",
        ai_engine: "BookHive AI",
        notifications_enabled: true,
        email_notifications: true,
        allow_admin_transaction_control: false,
        ai_strict_mode: true,
        is_maintenance_mode: false,
        maintenance_title: "System Maintenance & Update",
        maintenance_message: "BookHive is currently undergoing scheduled maintenance and updates.",
        maintenance_until: null,
        min_app_version: "1.0.6",
        latest_apk_url: "https://expo.dev/artifacts/eas/xc8SUbZZdm5ObSv2fEFJIqtMbYHYyDuaEBsqcpwf2c8.apk",
        updated_at: new Date().toISOString(),
      });
    }
    if (sqlLower.startsWith("select")) {
      return { rows: [state.system_settings[0]], rowCount: 1 };
    }
    if (sqlLower.startsWith("update system_settings")) {
      const s = state.system_settings[0];
      if (sqlLower.includes("is_maintenance_mode")) {
        if (params.length >= 6) {
          if (params[0] !== undefined && params[0] !== null) s.is_maintenance_mode = Boolean(params[0]);
          if (params[1] !== undefined && params[1] !== null) s.maintenance_title = params[1];
          if (params[2] !== undefined && params[2] !== null) s.maintenance_message = params[2];
          s.maintenance_until = params[3] ?? s.maintenance_until;
          if (params[4]) s.min_app_version = params[4];
          if (params[5]) s.latest_apk_url = params[5];
        } else if (params.length >= 1) {
          s.is_maintenance_mode = Boolean(params[0]);
        }
      }
      s.updated_at = new Date().toISOString();
      return { rows: [s], rowCount: 1 };
    }
    return { rows: [state.system_settings[0]], rowCount: 1 };
  }

  // 4. System Backups & Institutional Sync Logs
  if (sqlLower.includes("system_backups")) {
    if (sqlLower.startsWith("select")) {
      return { rows: state.system_backups, rowCount: state.system_backups.length };
    }
    if (sqlLower.startsWith("insert into system_backups")) {
      const row = {
        id: params[0] || `bkp-${Date.now()}`,
        label: params[1] || "Manual System Snapshot",
        size: params[2] || "42.8 MB",
        status: params[3] || "Completed",
        created_by: params[4] || "Super Admin",
        created_at: new Date().toISOString(),
      };
      state.system_backups.unshift(row);
      return { rows: [row], rowCount: 1 };
    }
  }

  if (sqlLower.includes("institutional_sync_logs")) {
    if (sqlLower.startsWith("select")) {
      return { rows: state.institutional_sync_logs, rowCount: state.institutional_sync_logs.length };
    }
    if (sqlLower.startsWith("insert into institutional_sync_logs")) {
      const row = {
        id: randomUUID(),
        synced_records: params[0] || 30,
        status: params[1] || "Success",
        triggered_by: params[2] || "Super Admin",
        created_at: new Date().toISOString(),
      };
      state.institutional_sync_logs.unshift(row);
      return { rows: [row], rowCount: 1 };
    }
  }

  // 5. Reports / Analytics special aggregations
  if (sqlLower.includes("to_char(created_at, 'mon')") && sqlLower.includes("from books")) {
    return {
      rows: [
        { month: "Sep", month_num: 9, count: 3 },
        { month: "Oct", month_num: 10, count: 4 },
      ],
      rowCount: 2,
    };
  }

  if (sqlLower.includes("as course_code") && sqlLower.includes("from transactions")) {
    const userById = new Map(state.users.map((u) => [String(u.id), u]));
    const userByIdNum = new Map(state.users.map((u) => [String(u.id_number || ""), u]));
    const counts = new Map<string, { borrow_count: number; students: Set<string> }>();

    for (const t of state.transactions) {
      const u = userById.get(String(t.user_id)) || userByIdNum.get(String(t.student_id));
      const raw = String(u?.course || t.department || "").toLowerCase();
      if (!raw || raw.includes("general")) continue;
      let code = u?.course || t.department;
      if (raw.includes("information technology") || raw === "bsit") code = "BSIT";
      else if (raw.includes("computer science") || raw === "bscs") code = "BSCS";
      else if (raw.includes("tourism") || raw === "bstm") code = "BSTM";
      else if (raw.includes("hospitality") || raw === "bshm") code = "BSHM";
      else if (raw.includes("business") || raw === "bsba") code = "BSBA";

      if (!counts.has(code)) counts.set(code, { borrow_count: 0, students: new Set() });
      const entry = counts.get(code)!;
      entry.borrow_count += 1;
      entry.students.add(String(t.student_id || t.user_id || ""));
    }

    const rows = Array.from(counts.entries())
      .map(([course_code, v]) => ({
        course_code,
        borrow_count: v.borrow_count,
        student_count: v.students.size,
      }))
      .sort((a, b) => b.borrow_count - a.borrow_count);

    return { rows, rowCount: rows.length };
  }

  if (sqlLower.includes("from transactions t") && sqlLower.includes("order by borrow_count desc") && sqlLower.includes("limit 10")) {
    const userById = new Map(state.users.map((u) => [String(u.id), u]));
    const userByIdNum = new Map(state.users.map((u) => [String(u.id_number || ""), u]));
    const studentMap = new Map<string, { name: string; student_id: string; course: string; borrow_count: number }>();

    for (const t of state.transactions) {
      const u = userById.get(String(t.user_id)) || userByIdNum.get(String(t.student_id));
      const role = String(u?.role || "student").toLowerCase();
      if (["admin", "super_admin", "superadmin", "librarian"].includes(role)) continue;
      const name = u?.name || t.student_name || "Unknown Student";
      const student_id = u?.id_number || t.student_id || "N/A";
      const raw = String(u?.course || t.department || "").toLowerCase();
      let course = "BSIT";
      if (raw.includes("tourism") || raw === "bstm") course = "BSTM";
      else if (raw.includes("hospitality") || raw === "bshm") course = "BSHM";
      else if (raw.includes("computer science") || raw === "bscs") course = "BSCS";
      else if (raw.includes("criminology") || raw === "bscrim") course = "BSCrim";
      else if (raw.includes("business") || raw === "bsba") course = "BSBA";

      const key = `${name}|${student_id}`;
      if (!studentMap.has(key)) {
        studentMap.set(key, { name, student_id, course, borrow_count: 0 });
      }
      studentMap.get(key)!.borrow_count += 1;
    }

    const rows = Array.from(studentMap.values())
      .sort((a, b) => b.borrow_count - a.borrow_count)
      .slice(0, 10);
    return { rows, rowCount: rows.length };
  }

  if (sqlLower.includes("from ai_search_logs") && sqlLower.includes("group by prompt")) {
    const counts = new Map<string, number>();
    for (const log of state.ai_search_logs) {
      const p = String(log.prompt || "").trim();
      if (!p) continue;
      counts.set(p, (counts.get(p) || 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([title, search_count]) => ({ title, search_count }))
      .sort((a, b) => b.search_count - a.search_count)
      .slice(0, 8);
    return { rows, rowCount: rows.length };
  }

  // 6. History Logs, Activity Logs, Auth Logs, AI Search Logs
  if (sqlLower.includes("from history_logs") || sqlLower.includes("into history_logs")) {
    if (sqlLower.startsWith("insert into history_logs")) {
      const row = {
        id: randomUUID(),
        actor_name: params[0] || "BookHive Admin",
        action: params[1] || "System Action",
        target: params[2] || "System",
        detail: params[3] || "",
        module: params[4] || "Records",
        created_at: new Date().toISOString(),
      };
      state.history_logs.unshift(row);
      return { rows: [row], rowCount: 1 };
    }
    if (sqlLower.includes("created_at >= current_date") && sqlLower.includes("count(*)")) {
      const today = new Date().toISOString().slice(0, 10);
      const count = state.history_logs.filter(
        (h) => String(h.created_at || "").startsWith(today) && (h.module === "Records" || String(h.action || "").toLowerCase().includes("add"))
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }
    if (sqlLower.includes("count(*)")) {
      return { rows: [{ total: state.history_logs.length, count: state.history_logs.length }], rowCount: 1 };
    }
    const rows = state.history_logs.map((h) => ({
      ...h,
      actor: h.actor_name || h.actor || "System",
      timestamp: h.created_at || h.timestamp || new Date().toISOString(),
    }));
    return { rows, rowCount: rows.length };
  }

  if (sqlLower.includes("into activity_logs") || sqlLower.includes("from activity_logs")) {
    if (sqlLower.startsWith("insert into activity_logs")) {
      const row = {
        id: randomUUID(),
        message: params[0] || "",
        level: params[1] || "info",
        created_at: new Date().toISOString(),
      };
      state.activity_logs.unshift(row);
      return { rows: [row], rowCount: 1 };
    }
    return { rows: state.activity_logs, rowCount: state.activity_logs.length };
  }

  if (sqlLower.includes("auth_logs")) {
    if (sqlLower.startsWith("insert")) {
      const row = {
        id: `auth-${Date.now()}`,
        actor: params[0] || "User",
        message: params[1] || "Authentication event",
        severity: params[2] || "info",
        created_at: new Date().toISOString(),
      };
      state.admin_auth_logs.unshift(row);
      return { rows: [row], rowCount: 1 };
    }
    const rows = state.admin_auth_logs.map((a) => ({
      ...a,
      actor_name: a.actor,
      event: a.message,
      timestamp: a.created_at,
    }));
    return { rows, rowCount: rows.length };
  }

  if (sqlLower.includes("ai_search_logs")) {
    if (sqlLower.startsWith("insert")) {
      const row = {
        id: randomUUID(),
        actor_name: params[0] || "Student",
        prompt: params[1] || "",
        department: params[2] || "All",
        matches_count: Number(params[3] || 0),
        created_at: new Date().toISOString(),
      };
      state.ai_search_logs.unshift(row);
      return { rows: [row], rowCount: 1 };
    }
    const rows = state.ai_search_logs.map((s) => ({
      ...s,
      actor: s.actor_name || "Student",
      matches: s.matches_count || 0,
      timestamp: s.created_at,
    }));
    return { rows, rowCount: rows.length };
  }

  // 7. Users table
  if (sqlLower.includes("from users") || sqlLower.includes("into users") || sqlLower.includes("update users") || sqlLower.includes("delete from users")) {
    if (sqlLower.includes("select count(*)") && !sqlLower.includes("group by")) {
      if (params.length === 0) {
        return { rows: [{ count: state.users.length, total: state.users.length }], rowCount: 1 };
      }
      throwOffline();
    }

    if (sqlLower.startsWith("select")) {
      // Login check by email or id_number
      if (sqlLower.includes("lower(email) = $1") || sqlLower.includes("lower(email) = lower($1)")) {
        const idf = String(params[0] || "").trim().toLowerCase();
        const rows = state.users
          .filter((u) => String(u.email || "").toLowerCase() === idf || String(u.id_number || "").toLowerCase() === idf)
          .map((u) => ({
            ...u,
            idNumber: u.id_number || "",
            passwordHash: u.password_hash || "",
            lastActive: u.last_active || u.created_at || new Date().toISOString(),
          }));
        return { rows, rowCount: rows.length };
      }

      // QR lookup
      if (sqlLower.includes("qr_code") && params.length === 1 && !sqlLower.includes("offset")) {
        const q = String(params[0] || "").trim().toLowerCase();
        const rows = state.users.filter(
          (u) =>
            String(u.qr_code || "").toLowerCase() === q ||
            String(u.id || "").toLowerCase() === q ||
            String(u.id_number || "").toLowerCase() === q ||
            `sti-lib-${String(u.id_number || "").toLowerCase()}` === q
        );
        return { rows, rowCount: rows.length };
      }

      // By ID
      if ((sqlLower.includes("where id = $1") || sqlLower.includes("where u.id = $1") || sqlLower.includes("where id::text = $1")) && params.length > 0) {
        const id = String(params[0] || "");
        const rows = state.users
          .filter((u) => String(u.id) === id || String(u.id_number) === id)
          .map((u) => ({
            ...u,
            idNumber: u.id_number || "",
            yearLevel: u.year_level || "",
            lastActive: u.last_active || u.created_at || new Date().toISOString(),
          }));
        return { rows, rowCount: rows.length };
      }

      // Active users for OCR verify-id
      if (sqlLower.includes("status = 'active'") && !sqlLower.includes("coalesce") && !sqlLower.includes("offset")) {
        const rows = state.users
          .filter((u) => (u.status || "Active") === "Active")
          .map((u) => ({
            ...u,
            idNumber: u.id_number || "",
            yearLevel: u.year_level || "",
            lastActive: u.last_active || u.created_at || new Date().toISOString(),
          }));
        return { rows, rowCount: rows.length };
      }

      // For paginated admin/super-admin user lists, delegate to adminRepository fallback
      if (sqlLower.includes("offset")) {
        throwOffline();
      }

      const rows = state.users.map((u) => ({
        ...u,
        idNumber: u.id_number || "",
        yearLevel: u.year_level || "",
        lastActive: u.last_active || u.created_at || new Date().toISOString(),
      }));
      return { rows, rowCount: rows.length };
    }

    if (sqlLower.startsWith("update users")) {
      const targetId = String(params[0] || "");
      const u = state.users.find(
        (x) =>
          String(x.id) === targetId ||
          String(x.email || "").toLowerCase() === targetId.toLowerCase() ||
          String(x.id_number || "").toLowerCase() === targetId.toLowerCase()
      );
      if (u) {
        if (sqlLower.includes("password_hash = $2")) {
          u.password_hash = params[1];
        } else {
          if (params[1] !== undefined && params[1] !== null) u.name = params[1];
          if (params[2] !== undefined && params[2] !== null) u.email = params[2];
        }
        u.updated_at = new Date().toISOString();
        return { rows: [u], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
  }

  // 8. Transactions table (card-by-qr and infrastructure count)
  if (sqlLower.includes("from transactions")) {
    if (sqlLower.includes("select count(*)") && params.length === 0 && !sqlLower.includes("group by")) {
      return { rows: [{ count: state.transactions.length, total: state.transactions.length }], rowCount: 1 };
    }
    if (sqlLower.includes("where user_id = $1") || sqlLower.includes("student_id = $2")) {
      const uid = String(params[0] || "");
      const sid = String(params[1] || params[0] || "");
      const rows = state.transactions.filter(
        (t) => String(t.user_id) === uid || String(t.student_id) === sid
      );
      return { rows, rowCount: rows.length };
    }
    throwOffline();
  }

  // 9. Books table (Student APIs, OCR scan-paper, daily-count, infrastructure count)
  if (sqlLower.includes("from books") || sqlLower.includes("from paged_books") || sqlLower.includes("into books")) {
    const books = getLocalBooksRows();
    const { borrowedByIsbn, reservedByIsbn } = computeBookLoanCounts(state);

    if (sqlLower.includes("created_at >= current_date") && sqlLower.includes("count(*)")) {
      const today = new Date().toISOString().slice(0, 10);
      const count = books.filter((b) => String(b.created_at || "").startsWith(today)).length;
      return { rows: [{ count }], rowCount: 1 };
    }

    // Student /api/student/books count or infrastructure count
    if (sqlLower.includes("select count(*)") && !sqlLower.includes("$1 = 'all'")) {
      const activeOnly = sqlLower.includes("archived_at is null");
      let filtered = activeOnly ? books.filter((b) => !b.archived_at) : books;
      if (params.length === 1 && typeof params[0] === "string" && params[0] !== "All" && !params[0].includes("%")) {
        filtered = filtered.filter((b) => b.department === params[0]);
      }
      return { rows: [{ count: filtered.length, total: filtered.length }], rowCount: 1 };
    }

    // Student /api/student/books paginated list (WITH paged_books AS)
    if (sqlLower.includes("with paged_books as")) {
      let list = books.filter((b) => !b.archived_at);
      let limit = 50;
      let offset = 0;
      if (params.length === 3) {
        const dept = String(params[0] || "");
        if (dept && dept !== "All") list = list.filter((b) => b.department === dept);
        limit = Number(params[1] || 50);
        offset = Number(params[2] || 0);
      } else if (params.length >= 2) {
        limit = Number(params[0] || 50);
        offset = Number(params[1] || 0);
      }
      const rows = list.slice(offset, offset + limit).map((b) => mapStudentBookRow(b, borrowedByIsbn, reservedByIsbn));
      return { rows, rowCount: rows.length };
    }

    // Student /api/student/books/[id]
    if ((sqlLower.includes("where b.id::text = $1") || sqlLower.includes("where id::text = $1") || sqlLower.includes("where id = $1")) && params.length > 0) {
      const q = String(params[0] || "").trim().toLowerCase();
      const found = books.filter(
        (b) => String(b.id).toLowerCase() === q || String(b.isbn || "").toLowerCase() === q
      );
      const rows = found.map((b) => mapStudentBookRow(b, borrowedByIsbn, reservedByIsbn));
      return { rows, rowCount: rows.length };
    }

    // Student /api/student/books/search or /api/student/ocr/scan-paper
    if (sqlLower.includes("lower(b.title) like $1") || sqlLower.includes("title ilike")) {
      const rawPattern = String(params[0] || "").replace(/%/g, "").trim().toLowerCase();
      let list = books.filter((b) => !b.archived_at);
      if (rawPattern) {
        list = list.filter(
          (b) =>
            String(b.title || "").toLowerCase().includes(rawPattern) ||
            String(b.author || "").toLowerCase().includes(rawPattern) ||
            String(b.isbn || "").toLowerCase().includes(rawPattern) ||
            String(b.category || "").toLowerCase().includes(rawPattern) ||
            String(b.genres || "").toLowerCase().includes(rawPattern)
        );
      }
      const limit = Number(params[params.length - 1]) || 50;
      const rows = list.slice(0, Math.min(200, limit)).map((b) => mapStudentBookRow(b, borrowedByIsbn, reservedByIsbn));
      return { rows, rowCount: rows.length };
    }

    if (sqlLower.startsWith("insert into books")) {
      const newBook = {
        id: randomUUID(),
        title: params[0] || "Untitled",
        author: params[1] || "Unknown Author",
        isbn: params[2] || `ISBN-${Date.now()}`,
        department: params[3] || "Circulation",
        category: params[4] || "General",
        shelf_location: params[5] || "CIR-01A.1",
        published_date: params[6] || "2026-01-01",
        publication_date: String(params[6] || "2026-01-01").slice(0, 10),
        summary: params[7] || "",
        apa_citation: params[8] || "",
        availability: params[9] || "Available",
        borrow_count: 0,
        copies: Number(params[10] || 1),
        volume: params[11] || "Single Volume / None",
        edition: params[12] || "Single Edition / None",
        genres: params[13] || params[4] || "General",
        publisher: params[14] || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        source: "bookhive-manual",
      };
      books.unshift(newBook);
      return { rows: [newBook], rowCount: 1 };
    }
  }

  throwOffline();
}
