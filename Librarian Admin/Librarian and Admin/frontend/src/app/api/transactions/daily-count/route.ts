import { NextResponse } from "next/server";
import { pool, hasExplicitDatabaseUrl } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const FALLBACK_LIBRARIANS = [
  {
    id: "821b7b9e-bd26-40a5-b4b3-91ba308130db",
    name: "Yana Brich R. Palmares",
    subRole: "Technical Librarian",
    approvedCount: 29,
    todayApprovedCount: 0,
  },
  {
    id: "a27ee733-1bf0-4532-8683-37d23c41b3a2",
    name: "Jan Dale B. Piansay",
    subRole: "Circulation Librarian",
    approvedCount: 1,
    todayApprovedCount: 0,
  },
  {
    id: "ab3c2f9c-535a-45b7-99c6-794f537401a5",
    name: "Joseph Tan",
    subRole: "Librarian",
    approvedCount: 0,
    todayApprovedCount: 0,
  },
  {
    id: "bc09ab5a-d432-4929-b71b-726257f82b84",
    name: "Maria Santos",
    subRole: "Librarian",
    approvedCount: 0,
    todayApprovedCount: 0,
  },
  {
    id: "11bcde76-9d4c-4e0b-acb2-32cb1b167265",
    name: "Raf Ryan Villanueva",
    subRole: "Librarian",
    approvedCount: 1,
    todayApprovedCount: 0,
  },
];

export async function GET() {
  try {
    if (hasExplicitDatabaseUrl) {
      const [usersRes, txDecidedAllRes, txDecidedTodayRes, histAllRes, histTodayRes] = await Promise.all([
        pool.query(`
          SELECT id, name, role::text, sub_role AS "subRole", permissions
          FROM users
          WHERE (role::text ILIKE '%librarian%' OR sub_role ILIKE '%librarian%')
            AND role::text NOT ILIKE '%admin%'
            AND name NOT ILIKE '%super%admin%'
            AND name NOT ILIKE '%super administrator%'
          ORDER BY name ASC
        `),
        // All-time approved transactions grouped by decided_by
        pool.query(`
          SELECT decided_by::text as "decidedBy", COUNT(*)::int as count
          FROM transactions
          WHERE status IN ('Approved', 'Returned')
            AND decided_by IS NOT NULL
          GROUP BY decided_by
        `),
        // Today's approved transactions grouped by decided_by
        pool.query(`
          SELECT decided_by::text as "decidedBy", COUNT(*)::int as count
          FROM transactions
          WHERE status IN ('Approved', 'Returned')
            AND decided_by IS NOT NULL
            AND (decided_at >= CURRENT_DATE OR (requested_at >= CURRENT_DATE AND status = 'Approved'))
          GROUP BY decided_by
        `),
        // All-time approval logs from history_logs grouped by actor
        pool.query(`
          SELECT actor, COUNT(*)::int as count
          FROM history_logs
          WHERE module = 'Transactions'
            AND action ILIKE '%approve%'
          GROUP BY actor
        `),
        // Today's approval logs from history_logs grouped by actor
        pool.query(`
          SELECT actor, COUNT(*)::int as count
          FROM history_logs
          WHERE module = 'Transactions'
            AND action ILIKE '%approve%'
            AND created_at >= CURRENT_DATE
          GROUP BY actor
        `),
      ]);

      const allDbUsers = usersRes.rows;
      const restrictedLibrarians = new Set<string>();

      // Track all users with restricted access to the Transactions module
      for (const u of allDbUsers) {
        const uId = String(u.id || "");
        const uName = (u.name || "").trim().toLowerCase();
        if (u.permissions && u.permissions.transactions === false) {
          restrictedLibrarians.add(uId);
          restrictedLibrarians.add(uName);
        }
      }

      // Filter: only show librarians who currently have active (unrestricted) access to Transactions
      const eligibleLibrarians = allDbUsers.filter((u: any) => {
        const role = (u.role || "").toLowerCase();
        const subRole = (u.subRole || "").toLowerCase();
        const name = (u.name || "").toLowerCase();
        const id = String(u.id || "");

        if (role.includes("admin") || name.includes("super admin") || name.includes("super administrator")) {
          return false;
        }

        const isLibrarian = role.includes("librarian") || subRole.includes("librarian");
        if (!isLibrarian) return false;

        // Hide if the whole Transactions page is restricted
        if (u.permissions && u.permissions.transactions === false) {
          return false;
        }

        return true;
      });

      // Ensure any fallback librarians not yet in database are merged in ONLY if not restricted
      const existingDbNames = new Set(allDbUsers.map((u: any) => (u.name || "").trim().toLowerCase()));
      for (const fb of FALLBACK_LIBRARIANS) {
        const fbName = fb.name.toLowerCase();
        const fbId = String(fb.id || "");
        if (!existingDbNames.has(fbName) && !restrictedLibrarians.has(fbId) && !restrictedLibrarians.has(fbName)) {
          eligibleLibrarians.push(fb);
        }
      }

      const librarians = eligibleLibrarians.map((lib: any) => {
        const libId = String(lib.id || "");
        const libName = (lib.name || "").trim().toLowerCase();
        const nameParts = libName.split(" ").filter((p: string) => p.length > 2 && !p.endsWith("."));

        // Match from transactions.decided_by
        const txAllRow = txDecidedAllRes.rows.find((r: any) => r.decidedBy === libId);
        const txAllCount = Number(txAllRow?.count || 0);

        const txTodayRow = txDecidedTodayRes.rows.find((r: any) => r.decidedBy === libId);
        const txTodayCount = Number(txTodayRow?.count || 0);

        // Match from history_logs
        const histAllCount = histAllRes.rows.reduce((acc: number, row: any) => {
          const actor = (row.actor || "").toLowerCase();
          if (actor.includes(libName)) return acc + Number(row.count || 0);
          if (nameParts.length >= 2 && nameParts.every((part: string) => actor.includes(part))) {
            return acc + Number(row.count || 0);
          }
          return acc;
        }, 0);

        const histTodayCount = histTodayRes.rows.reduce((acc: number, row: any) => {
          const actor = (row.actor || "").toLowerCase();
          if (actor.includes(libName)) return acc + Number(row.count || 0);
          if (nameParts.length >= 2 && nameParts.every((part: string) => actor.includes(part))) {
            return acc + Number(row.count || 0);
          }
          return acc;
        }, 0);

        const totalApproved = Math.max(txAllCount, histAllCount, lib.approvedCount || 0);
        const todayApproved = Math.max(txTodayCount, histTodayCount, lib.todayApprovedCount || 0);

        return {
          id: lib.id,
          name: lib.name,
          subRole:
            lib.subRole ||
            (lib.name?.toLowerCase().includes("jan dale")
              ? "Circulation Librarian"
              : lib.name?.toLowerCase().includes("yana")
              ? "Technical Librarian"
              : lib.role && !lib.role.toLowerCase().includes("librarian")
              ? lib.role
              : "Librarian"),
          approvedCount: totalApproved,
          todayApprovedCount: todayApproved,
        };
      });

      const session = await getSession().catch(() => null);
      const currentLibrarian = session
        ? librarians.find(
            (l: any) =>
              (session.id && l.id === session.id) ||
              (session.name && l.name.toLowerCase().includes(session.name.toLowerCase())) ||
              (l.name && session.name && session.name.toLowerCase().includes(l.name.toLowerCase()))
          )
        : null;

      const personalTodayCount = currentLibrarian ? currentLibrarian.todayApprovedCount : 0;
      const personalTotalCount = currentLibrarian ? currentLibrarian.approvedCount : 0;

      return NextResponse.json({
        count: personalTodayCount,
        personalTodayCount,
        personalTotalCount,
        librarians,
        date: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      count: 0,
      personalTodayCount: 0,
      personalTotalCount: 0,
      librarians: FALLBACK_LIBRARIANS,
      date: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Transactions daily count error:", err);
    return NextResponse.json(
      { count: 0, personalTodayCount: 0, personalTotalCount: 0, librarians: FALLBACK_LIBRARIANS, error: err.message },
      { status: 200 }
    );
  }
}
