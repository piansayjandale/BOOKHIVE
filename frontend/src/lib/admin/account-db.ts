import { randomUUID } from "node:crypto";

import type {
  AdminProfilePayload,
  AdminUserRecord,
  AdminUsersPayload,
  MonitoringLog,
} from "@/lib/admin/types";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/admin/passwords";
import { seedUsers } from "@/lib/data/seed";
import { hasExplicitDatabaseUrl, pool } from "@/lib/db";
import type { Department, Role, SessionUser, SystemUser } from "@/lib/types";

type AccountUserRow = {
  id: string;
  name: string;
  idNumber: string;
  email: string;
  role: Role;
  department: Department;
  course: string;
  status: AdminUserRecord["status"];
  lastActive: string | Date;
  passwordHash?: string;
  phone?: string;
  bio?: string;
};

type AuthLogRow = {
  id: string;
  actor: string;
  message: string;
  severity: MonitoringLog["severity"];
  timestamp: string | Date;
};

let adminAccountSchemaPromise: Promise<void> | null = null;
let adminAccountDbFailureBackoffUntil = 0;

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function inferCourse(role: Role, department: Department) {
  if (role === "Admin") {
    return "Library Administration";
  }

  switch (department) {
    case "Computer Science":
      return "BS Computer Science";
    case "Engineering":
      return "BS Civil Engineering";
    case "Education":
      return "BSEd";
    case "Business & Accountancy":
      return "BS Accountancy";
    default:
      return "BA Social Sciences";
  }
}

function defaultIdNumber(user: SystemUser) {
  if (user.role === "Admin") {
    return "ADM-2026-0001";
  }

  if (user.role === "Librarian") {
    return `LIB-2026-${user.id.slice(-3)}`;
  }

  return `STU-2026-${user.id.slice(-3)}`;
}

function defaultPassword(user: SystemUser, idNumber: string) {
  if (user.role === "Admin") {
    return "BookHiveAdmin!2026";
  }

  if (user.role === "Librarian") {
    return "BookHiveLibrarian!2026";
  }

  return idNumber;
}

function defaultPhone(user: SystemUser) {
  return user.role === "Admin" ? "+63 917 555 0101" : "+63 917 555 0199";
}

function defaultBio(user: SystemUser) {
  return user.role === "Admin"
    ? "Oversees the BookHive platform, policy configuration, and system-wide analytics."
    : "Supports circulation, patron service, and day-to-day catalog operations.";
}

function mapUserRow(row: AccountUserRow): AdminUserRecord {
  return {
    id: row.id,
    name: row.name,
    idNumber: row.idNumber,
    email: row.email,
    role: row.role,
    department: row.department,
    course: row.course,
    status: row.status,
    lastActive: toIsoString(row.lastActive),
  };
}

function mapProfileRow(row: AccountUserRow): AdminProfilePayload {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    phone: row.phone ?? "",
    bio: row.bio ?? "",
    avatar: row.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
    lastActive: toIsoString(row.lastActive),
  };
}

async function seedAdminAccounts() {
  const existing = await pool.query<{ total: string }>(
    "SELECT COUNT(*) AS total FROM admin_account_users",
  );

  if (parseInt(existing.rows[0]?.total ?? "0", 10) > 0) {
    return;
  }

  await pool.query("BEGIN");

  try {
    for (const user of seedUsers) {
      const idNumber = defaultIdNumber(user);
      const course = inferCourse(user.role, user.department);
      const passwordHash = hashAdminPassword(defaultPassword(user, idNumber));
      const phone = defaultPhone(user);
      const bio = defaultBio(user);

      await pool.query(
        `
          INSERT INTO admin_account_users (
            id,
            name,
            id_number,
            email,
            password_hash,
            role,
            department,
            course,
            status,
            last_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `,
        [
          user.id,
          user.name,
          idNumber,
          user.email,
          passwordHash,
          user.role,
          user.department,
          course,
          user.status,
          user.lastActive,
        ],
      );

      await pool.query(
        `
          INSERT INTO admin_account_profiles (
            user_id,
            phone,
            bio,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, NOW(), NOW())
        `,
        [user.id, phone, bio],
      );
    }

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function initializeAdminAccountSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_account_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_number TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT NOT NULL,
      course TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_account_profiles (
      user_id TEXT PRIMARY KEY REFERENCES admin_account_users(id) ON DELETE CASCADE,
      phone TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_auth_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_admin_account_users_role
      ON admin_account_users(role);
    CREATE INDEX IF NOT EXISTS idx_admin_account_users_last_active
      ON admin_account_users(last_active DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_auth_logs_created_at
      ON admin_auth_logs(created_at DESC);
  `);

  await seedAdminAccounts();
}

async function ensureAdminAccountSchema() {
  if (!hasExplicitDatabaseUrl) {
    throw new Error("Admin PostgreSQL is not configured.");
  }

  if (Date.now() < adminAccountDbFailureBackoffUntil) {
    throw new Error("Admin PostgreSQL temporarily unavailable.");
  }

  if (!adminAccountSchemaPromise) {
    adminAccountSchemaPromise = initializeAdminAccountSchema().catch((error) => {
      adminAccountDbFailureBackoffUntil = Date.now() + 60_000;
      adminAccountSchemaPromise = null;
      throw error;
    });
  }

  await adminAccountSchemaPromise;
}

export async function authenticateAccountUser(identifier: string, password: string) {
  await ensureAdminAccountSchema();

  const result = await pool.query<AccountUserRow>(
    `
      SELECT
        id,
        name,
        id_number AS "idNumber",
        email,
        password_hash AS "passwordHash",
        role,
        department,
        course,
        status,
        last_active AS "lastActive"
      FROM admin_account_users
      WHERE lower(email) = lower($1) OR lower(id_number) = lower($1)
      LIMIT 1
    `,
    [identifier],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  if (!["Admin", "Librarian"].includes(row.role) || !verifyAdminPassword(password, row.passwordHash ?? "")) {
    return null;
  }

  await pool.query(
    `
      UPDATE admin_account_users
      SET
        last_active = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `,
    [row.id],
  );

  return {
    ...mapUserRow(row),
    lastActive: new Date().toISOString(),
  } satisfies AdminUserRecord;
}

export async function countAccountUsers() {
  await ensureAdminAccountSchema();

  const result = await pool.query<{ total: string }>(
    "SELECT COUNT(*) AS total FROM admin_account_users",
  );

  return parseInt(result.rows[0]?.total ?? "0", 10);
}

export async function listRecentAccountUsers(limit = 5) {
  await ensureAdminAccountSchema();

  const result = await pool.query<AccountUserRow>(
    `
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
      FROM admin_account_users
      ORDER BY created_at DESC, last_active DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapUserRow);
}

export async function listAccountUsers(options: {
  search?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminUsersPayload> {
  await ensureAdminAccountSchema();

  const search = options.search?.trim() ?? "";
  const role = options.role ?? "All";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  const [rowsResult, countResult] = await Promise.all([
    pool.query<AccountUserRow>(
      `
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
        FROM admin_account_users
        WHERE (
          $1 = '' OR
          lower(name) LIKE '%' || lower($1) || '%' OR
          lower(id_number) LIKE '%' || lower($1) || '%' OR
          lower(email) LIKE '%' || lower($1) || '%' OR
          lower(course) LIKE '%' || lower($1) || '%'
        )
        AND ($2 = 'All' OR role = $2)
        ORDER BY created_at DESC, name ASC
        LIMIT $3 OFFSET $4
      `,
      [search, role, pageSize, offset],
    ),
    pool.query<{ total: string }>(
      `
        SELECT COUNT(*) AS total
        FROM admin_account_users
        WHERE (
          $1 = '' OR
          lower(name) LIKE '%' || lower($1) || '%' OR
          lower(id_number) LIKE '%' || lower($1) || '%' OR
          lower(email) LIKE '%' || lower($1) || '%' OR
          lower(course) LIKE '%' || lower($1) || '%'
        )
        AND ($2 = 'All' OR role = $2)
      `,
      [search, role],
    ),
  ]);

  return {
    users: rowsResult.rows.map(mapUserRow),
    total: parseInt(countResult.rows[0]?.total ?? "0", 10),
    page,
    pageSize,
  };
}

export async function createAccountUser(
  input: Omit<AdminUserRecord, "id" | "lastActive" | "status">,
) {
  await ensureAdminAccountSchema();

  const userId = `user-${randomUUID()}`;
  const result = await pool.query<AccountUserRow>(
    `
      INSERT INTO admin_account_users (
        id,
        name,
        id_number,
        email,
        password_hash,
        role,
        department,
        course,
        status,
        last_active,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Active', NOW(), NOW(), NOW())
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
    `,
    [
      userId,
      input.name,
      input.idNumber,
      input.email,
      hashAdminPassword(input.idNumber),
      input.role,
      input.department,
      input.course,
    ],
  );

  await pool.query(
    `
      INSERT INTO admin_account_profiles (user_id, phone, bio, created_at, updated_at)
      VALUES ($1, '', $2, NOW(), NOW())
    `,
    [userId, `${input.role} access for ${input.department}.`],
  );

  return {
    user: mapUserRow(result.rows[0]),
    tempPassword: input.idNumber,
  };
}

export async function updateAccountUser(
  id: string,
  updates: Partial<Omit<AdminUserRecord, "id" | "lastActive">>,
) {
  await ensureAdminAccountSchema();

  const result = await pool.query<AccountUserRow>(
    `
      UPDATE admin_account_users
      SET
        name = COALESCE($2, name),
        id_number = COALESCE($3, id_number),
        email = COALESCE($4, email),
        role = COALESCE($5, role),
        department = COALESCE($6, department),
        course = COALESCE($7, course),
        status = COALESCE($8, status),
        updated_at = NOW()
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
    `,
    [
      id,
      updates.name ?? null,
      updates.idNumber ?? null,
      updates.email ?? null,
      updates.role ?? null,
      updates.department ?? null,
      updates.course ?? null,
      updates.status ?? null,
    ],
  );

  const row = result.rows[0];
  return row ? mapUserRow(row) : null;
}

export async function deleteAccountUser(id: string) {
  await ensureAdminAccountSchema();

  const result = await pool.query(
    "DELETE FROM admin_account_users WHERE id = $1",
    [id],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getAccountProfile(userId: string) {
  await ensureAdminAccountSchema();

  const result = await pool.query<AccountUserRow>(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.department,
        u.last_active AS "lastActive",
        p.phone,
        p.bio
      FROM admin_account_users u
      LEFT JOIN admin_account_profiles p ON p.user_id = u.id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];
  return row ? mapProfileRow(row) : null;
}

export async function updateAccountProfile(
  userId: string,
  updates: Pick<AdminProfilePayload, "name" | "email" | "department" | "phone" | "bio">,
) {
  await ensureAdminAccountSchema();

  await pool.query("BEGIN");

  try {
    const userResult = await pool.query<AccountUserRow>(
      `
        UPDATE admin_account_users
        SET
          name = $2,
          email = $3,
          department = $4,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          email,
          role,
          department,
          last_active AS "lastActive"
      `,
      [userId, updates.name, updates.email, updates.department],
    );

    const userRow = userResult.rows[0];
    if (!userRow) {
      await pool.query("ROLLBACK");
      return null;
    }

    await pool.query(
      `
        INSERT INTO admin_account_profiles (
          user_id,
          phone,
          bio,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          phone = EXCLUDED.phone,
          bio = EXCLUDED.bio,
          updated_at = NOW()
      `,
      [userId, updates.phone, updates.bio],
    );

    await pool.query("COMMIT");

    return mapProfileRow({
      ...userRow,
      phone: updates.phone,
      bio: updates.bio,
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
) {
  await ensureAdminAccountSchema();

  const result = await pool.query<AccountUserRow>(
    `
      SELECT
        id,
        password_hash AS "passwordHash"
      FROM admin_account_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];
  if (!row?.passwordHash) {
    return { error: "Profile not found." };
  }

  if (!verifyAdminPassword(currentPassword, row.passwordHash)) {
    return { error: "Current password is incorrect." };
  }

  await pool.query(
    `
      UPDATE admin_account_users
      SET
        password_hash = $2,
        updated_at = NOW()
      WHERE id = $1
    `,
    [userId, hashAdminPassword(nextPassword)],
  );

  return { success: true as const };
}

export async function registerAccountAuthEvent(
  actor: string,
  message: string,
  severity: MonitoringLog["severity"] = "info",
) {
  await ensureAdminAccountSchema();

  await pool.query(
    `
      INSERT INTO admin_auth_logs (
        id,
        actor,
        message,
        severity,
        created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `,
    [`auth-${randomUUID()}`, actor, message, severity],
  );
}

export async function listAccountAuthLogs(limit = 60): Promise<AuthLogRow[]> {
  await ensureAdminAccountSchema();

  const result = await pool.query<AuthLogRow>(
    `
      SELECT
        id,
        actor,
        message,
        severity,
        created_at AS timestamp
      FROM admin_auth_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows;
}

export async function syncAccountUserSession(userId: string, session?: SessionUser | null) {
  await ensureAdminAccountSchema();

  await pool.query(
    `
      UPDATE admin_account_users
      SET
        last_active = NOW(),
        updated_at = NOW(),
        name = COALESCE($2, name),
        email = COALESCE($3, email),
        role = COALESCE($4, role)
      WHERE id = $1
    `,
    [userId, session?.name ?? null, session?.email ?? null, session?.role ?? null],
  );
}
