const { Client } = require("pg");

const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:5432/bookhive_2nd";
const NEON_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_t9Mv6obzqwYI@ep-small-rice-b4t0hk6r-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function sync() {
  console.log("=== Syncing Local User Accounts & Transactions -> Neon Cloud ===");

  const local = new Client({ connectionString: LOCAL_URL });
  const neon = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  await local.connect();
  console.log("✓ Connected to local database (bookhive_2nd).");

  await neon.connect();
  console.log("✓ Connected to Neon cloud database.");

  // 1. Sync Users
  console.log("\n1. Syncing Users...");
  const localUsers = await local.query("SELECT * FROM users ORDER BY created_at ASC");
  console.log(`Found ${localUsers.rows.length} users in local database.`);

  let usersSynced = 0;
  for (const u of localUsers.rows) {
    try {
      await neon.query(
        `
        INSERT INTO users (
          id, name, id_number, email, password_hash, role, department, course,
          status, avatar, qr_code, permissions, last_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          course = EXCLUDED.course,
          status = EXCLUDED.status,
          permissions = EXCLUDED.permissions,
          last_active = EXCLUDED.last_active,
          updated_at = NOW()
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

      // Also ensure in admin_account_users
      await neon.query(
        `
        INSERT INTO admin_account_users (
          id, name, id_number, email, password_hash, role, department, course, status, last_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          department = EXCLUDED.department,
          course = EXCLUDED.course,
          status = EXCLUDED.status,
          last_active = EXCLUDED.last_active,
          updated_at = NOW()
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

      usersSynced++;
    } catch (err) {
      console.warn(`User ${u.email} sync note:`, err.message);
    }
  }
  console.log(`✓ Synced ${usersSynced} users to Neon.`);

  // 2. Sync Transactions
  console.log("\n2. Syncing Transactions...");
  const localTx = await local.query("SELECT * FROM transactions ORDER BY requested_at ASC");
  console.log(`Found ${localTx.rows.length} transactions in local database.`);

  let txSynced = 0;
  for (const t of localTx.rows) {
    try {
      await neon.query(
        `
        INSERT INTO transactions (
          id, user_id, student_name, student_id, resource_title, isbn, department,
          type, status, duration_days, requested_at, due_date, decided_by, decided_at,
          created_at, student_id_image, comment, available_at, expires_at, picked_up_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          due_date = EXCLUDED.due_date,
          picked_up_at = EXCLUDED.picked_up_at
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
      txSynced++;
    } catch (err) {
      console.warn(`Transaction ${t.id} sync note:`, err.message);
    }
  }
  console.log(`✓ Synced ${txSynced} transactions to Neon.`);

  // 3. Sync Activity Logs
  console.log("\n3. Syncing Activity Logs...");
  const localAct = await local.query("SELECT * FROM activity_logs ORDER BY created_at ASC");
  let actSynced = 0;
  for (const a of localAct.rows) {
    try {
      await neon.query(
        `
        INSERT INTO activity_logs (id, actor, category, message, severity, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
        `,
        [a.id, a.actor, a.category, a.message, a.severity, a.created_at]
      );
      actSynced++;
    } catch (err) {
      // ignore duplicates
    }
  }
  console.log(`✓ Synced ${actSynced} activity logs to Neon.`);

  // 4. Sync History Logs
  console.log("\n4. Syncing History Logs...");
  const localHist = await local.query("SELECT * FROM history_logs ORDER BY created_at ASC");
  let histSynced = 0;
  for (const h of localHist.rows) {
    try {
      await neon.query(
        `
        INSERT INTO history_logs (id, actor, action, target, module, detail, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO NOTHING
        `,
        [h.id, h.actor, h.action, h.target, h.module, h.detail, h.created_at]
      );
      histSynced++;
    } catch (err) {
      // ignore duplicates
    }
  }
  console.log(`✓ Synced ${histSynced} history logs to Neon.`);

  // 5. Sync Announcements
  console.log("\n5. Syncing Announcements...");
  const localAnn = await local.query("SELECT * FROM announcements ORDER BY created_at ASC");
  let annSynced = 0;
  for (const an of localAnn.rows) {
    try {
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
      annSynced++;
    } catch (err) {
      // ignore duplicates
    }
  }
  console.log(`✓ Synced ${annSynced} announcements to Neon.`);

  // 6. Verify Neon final counts
  const finalUsers = await neon.query("SELECT COUNT(*)::int as count FROM users;");
  const finalTx = await neon.query("SELECT COUNT(*)::int as count FROM transactions;");
  const finalBooks = await neon.query("SELECT COUNT(*)::int as count FROM books;");

  console.log("\n==========================================");
  console.log("🎉 NEON SYNC COMPLETED SUCCESSFULLY!");
  console.log(`Total Users in Neon: ${finalUsers.rows[0].count}`);
  console.log(`Total Transactions in Neon: ${finalTx.rows[0].count}`);
  console.log(`Total Books in Neon: ${finalBooks.rows[0].count}`);
  console.log("==========================================");

  await local.end();
  await neon.end();
}

sync().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
