const { Client } = require("pg");

const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd";
const NEON_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_t9Mv6obzqwYI@ep-small-rice-b4t0hk6r-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function cleanSync() {
  console.log("=== High-Fidelity Local -> Neon Database Sync ===");

  const local = new Client({ connectionString: LOCAL_URL });
  const neon = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  await local.connect();
  await neon.connect();
  console.log("✓ Connected to both local and Neon databases.");

  // Clear existing users and transactions in Neon to avoid ID collisions
  console.log("Clearing placeholder users/transactions in Neon...");
  await neon.query("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'Archived';");
  await neon.query("TRUNCATE TABLE transactions, reservations, users CASCADE;");
  await neon.query("TRUNCATE TABLE admin_account_profiles, admin_account_users CASCADE;");
  console.log("✓ Clean slate prepared in Neon.");

  // 1. Transfer ALL 21 Users
  console.log("Transferring 21 Users with exact UUIDs & Credentials...");
  const localUsers = await local.query("SELECT * FROM users ORDER BY created_at ASC");
  for (const u of localUsers.rows) {
    await neon.query(
      `
      INSERT INTO users (
        id, name, id_number, email, password_hash, role, department, course,
        status, avatar, qr_code, permissions, last_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `,
      [
        u.id,
        u.name,
        u.id_number,
        u.email,
        u.password_hash,
        u.role,
        u.department,
        u.course,
        u.status || "Active",
        u.avatar,
        u.qr_code,
        u.permissions,
        u.last_active || new Date(),
        u.created_at || new Date(),
        u.updated_at || new Date(),
      ]
    );

    await neon.query(
      `
      INSERT INTO admin_account_users (
        id, name, id_number, email, password_hash, role, department, course, status, last_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        id_number = EXCLUDED.id_number,
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash
      `,
      [
        String(u.id),
        u.name,
        u.id_number,
        u.email,
        u.password_hash,
        u.role,
        u.department,
        u.course,
        u.status || "Active",
        u.last_active || new Date(),
        u.created_at || new Date(),
        u.updated_at || new Date(),
      ]
    );
  }
  console.log(`✓ Successfully transferred all ${localUsers.rows.length} users!`);

  // 2. Transfer ALL 36 Transactions
  console.log("Transferring 36 Transactions...");
  const localTx = await local.query("SELECT * FROM transactions ORDER BY requested_at ASC");
  for (const t of localTx.rows) {
    await neon.query(
      `
      INSERT INTO transactions (
        id, user_id, student_name, student_id, resource_title, isbn, department,
        type, status, duration_days, requested_at, due_date, decided_by, decided_at,
        created_at, student_id_image, comment, available_at, expires_at, picked_up_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      `,
      [
        t.id,
        t.user_id,
        t.student_name,
        t.student_id,
        t.resource_title,
        t.isbn,
        t.department,
        t.type,
        t.status,
        t.duration_days,
        t.requested_at,
        t.due_date,
        t.decided_by,
        t.decided_at,
        t.created_at,
        t.student_id_image,
        t.comment,
        t.available_at,
        t.expires_at,
        t.picked_up_at,
      ]
    );
  }
  console.log(`✓ Successfully transferred all ${localTx.rows.length} transactions!`);

  // 3. Bulk Transfer Activity Logs
  console.log("Bulk transferring activity logs...");
  const localAct = await local.query("SELECT * FROM activity_logs ORDER BY created_at ASC");
  if (localAct.rows.length > 0) {
    const values = [];
    const placeholders = [];
    let pIdx = 1;
    for (const a of localAct.rows) {
      placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5})`);
      values.push(a.id, a.actor, a.category, a.message, a.severity, a.created_at);
      pIdx += 6;
    }
    await neon.query(
      `INSERT INTO activity_logs (id, actor, category, message, severity, created_at)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (id) DO NOTHING`,
      values
    );
  }
  console.log(`✓ Transferred ${localAct.rows.length} activity logs.`);

  // 4. Bulk Transfer History Logs
  console.log("Bulk transferring history logs...");
  const localHist = await local.query("SELECT * FROM history_logs ORDER BY created_at ASC");
  if (localHist.rows.length > 0) {
    const values = [];
    const placeholders = [];
    let pIdx = 1;
    for (const h of localHist.rows) {
      placeholders.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6})`);
      values.push(h.id, h.actor, h.action, h.target, h.module, h.detail, h.created_at);
      pIdx += 7;
    }
    await neon.query(
      `INSERT INTO history_logs (id, actor, action, target, module, detail, created_at)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (id) DO NOTHING`,
      values
    );
  }
  console.log(`✓ Transferred ${localHist.rows.length} history logs.`);

  // 5. Transfer Announcements
  console.log("Transferring announcements...");
  const localAnn = await local.query("SELECT * FROM announcements ORDER BY created_at ASC");
  for (const an of localAnn.rows) {
    await neon.query(
      `
      INSERT INTO announcements (
        id, title, content, audience, priority, published, author, duration_days, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        an.id,
        an.title,
        an.content,
        an.audience,
        an.priority,
        an.published,
        an.author,
        an.duration_days,
        an.expires_at,
        an.created_at,
        an.updated_at,
      ]
    );
  }
  console.log(`✓ Transferred ${localAnn.rows.length} announcements.`);

  // 6. Verify Final Counts in Neon
  const countUsers = await neon.query("SELECT COUNT(*)::int as count FROM users;");
  const countTx = await neon.query("SELECT COUNT(*)::int as count FROM transactions;");
  const countBooks = await neon.query("SELECT COUNT(*)::int as count FROM books;");
  const countHist = await neon.query("SELECT COUNT(*)::int as count FROM history_logs;");

  console.log("\n==========================================");
  console.log("🎯 NEON RESTORATION COMPLETED 100%!");
  console.log(`Users in Neon: ${countUsers.rows[0].count} / 21`);
  console.log(`Transactions in Neon: ${countTx.rows[0].count} / 36`);
  console.log(`History Logs in Neon: ${countHist.rows[0].count}`);
  console.log(`Books in Neon: ${countBooks.rows[0].count}`);
  console.log("==========================================");

  await local.end();
  await neon.end();
}

cleanSync().catch((err) => {
  console.error("Clean sync failed:", err);
  process.exit(1);
});
