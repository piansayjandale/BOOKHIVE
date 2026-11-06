import { NextResponse } from "next/server";
import { pool, hasExplicitDatabaseUrl } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const FALLBACK_LIBRARIANS = [
  {
    id: "821b7b9e-bd26-40a5-b4b3-91ba308130db",
    name: "Yana Brich R. Palmares",
    subRole: "Technical Librarian",
    booksAdded: 7,
    todayBooksAdded: 0,
  },
  {
    id: "a27ee733-1bf0-4532-8683-37d23c41b3a2",
    name: "Jan Dale B. Piansay",
    subRole: "Circulation Librarian",
    booksAdded: 0,
    todayBooksAdded: 0,
  },
  {
    id: "ab3c2f9c-535a-45b7-99c6-794f537401a5",
    name: "Joseph Tan",
    subRole: "Librarian",
    booksAdded: 0,
    todayBooksAdded: 0,
  },
  {
    id: "bc09ab5a-d432-4929-b71b-726257f82b84",
    name: "Maria Santos",
    subRole: "Librarian",
    booksAdded: 0,
    todayBooksAdded: 0,
  },
  {
    id: "11bcde76-9d4c-4e0b-acb2-32cb1b167265",
    name: "Raf Ryan Villanueva",
    subRole: "Librarian",
    booksAdded: 0,
    todayBooksAdded: 0,
  },
];

export async function GET() {
  try {
    if (hasExplicitDatabaseUrl) {
      const [bookRes, histRes, usersRes, totalRes, todayRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int as count FROM books WHERE created_at >= CURRENT_DATE`),
        pool.query(`SELECT COUNT(*)::int as count FROM history_logs WHERE (module = 'Records' OR action ILIKE '%add%book%') AND created_at >= CURRENT_DATE`),
        pool.query(`
          SELECT id, name, role::text, sub_role AS "subRole", permissions
          FROM users
          WHERE (role::text ILIKE '%librarian%' OR sub_role ILIKE '%librarian%')
            AND role::text NOT ILIKE '%admin%'
            AND name NOT ILIKE '%super%admin%'
            AND name NOT ILIKE '%super administrator%'
          ORDER BY name ASC
        `),
        pool.query(`
          SELECT actor, COUNT(*)::int as count
          FROM history_logs
          WHERE action ILIKE '%add%book%' 
             OR action ILIKE '%approved digitized%' 
             OR action ILIKE '%digitized%'
             OR (action ILIKE '%add%' AND module = 'Records')
          GROUP BY actor
        `),
        pool.query(`
          SELECT actor, COUNT(*)::int as count
          FROM history_logs
          WHERE (action ILIKE '%add%book%' 
             OR action ILIKE '%approved digitized%' 
             OR action ILIKE '%digitized%'
             OR (action ILIKE '%add%' AND module = 'Records'))
            AND created_at >= CURRENT_DATE
          GROUP BY actor
        `),
      ]);

      const booksCount = bookRes.rows[0]?.count ?? 0;
      const historyCount = histRes.rows[0]?.count ?? 0;
      const count = Math.max(booksCount, historyCount);

      const allDbUsers = usersRes.rows;
      const restrictedLibrarians = new Set<string>();

      // Track all users with restricted access to the Cataloging (records) module
      for (const u of allDbUsers) {
        const uId = String(u.id || "");
        const uName = (u.name || "").trim().toLowerCase();
        if (u.permissions && u.permissions.records === false) {
          restrictedLibrarians.add(uId);
          restrictedLibrarians.add(uName);
        }
      }

      // Filter: only show librarians who currently have active (unrestricted) access to Cataloging
      const eligibleLibrarians = allDbUsers.filter((u: any) => {
        const role = (u.role || "").toLowerCase();
        const subRole = (u.subRole || "").toLowerCase();
        const name = (u.name || "").toLowerCase();

        if (role.includes("admin") || name.includes("super admin") || name.includes("super administrator")) {
          return false;
        }

        const isLibrarian = role.includes("librarian") || subRole.includes("librarian");
        if (!isLibrarian) return false;

        // Hide if the whole Cataloging page is restricted
        if (u.permissions && u.permissions.records === false) {
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
        const libName = (lib.name || "").trim().toLowerCase();
        const nameParts = libName.split(" ").filter((p: string) => p.length > 2 && !p.endsWith("."));

        const totalCount = totalRes.rows.reduce((acc: number, row: any) => {
          const actor = (row.actor || "").toLowerCase();
          if (actor.includes(libName)) {
            return acc + Number(row.count || 0);
          }
          if (nameParts.length >= 2 && nameParts.every((part: string) => actor.includes(part))) {
            return acc + Number(row.count || 0);
          }
          return acc;
        }, 0);

        const todayCount = todayRes.rows.reduce((acc: number, row: any) => {
          const actor = (row.actor || "").toLowerCase();
          if (actor.includes(libName)) {
            return acc + Number(row.count || 0);
          }
          if (nameParts.length >= 2 && nameParts.every((part: string) => actor.includes(part))) {
            return acc + Number(row.count || 0);
          }
          return acc;
        }, 0);

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
          booksAdded: totalCount || (lib.booksAdded || 0),
          todayBooksAdded: todayCount || (lib.todayBooksAdded || 0),
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

      const personalTodayCount = currentLibrarian ? currentLibrarian.todayBooksAdded : 0;

      return NextResponse.json({
        count: personalTodayCount,
        personalCount: personalTodayCount,
        globalCount: count,
        booksCount,
        historyCount,
        librarians,
        date: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      count: 0,
      booksCount: 0,
      historyCount: 0,
      librarians: FALLBACK_LIBRARIANS,
      date: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Daily count error:", err);
    return NextResponse.json({ count: 0, librarians: FALLBACK_LIBRARIANS, error: err.message }, { status: 500 });
  }
}
