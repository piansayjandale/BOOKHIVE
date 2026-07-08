/**
 * reassign-sections.mjs
 * Bulk-updates every book in the `books` table to one of the 6 library sections
 * based on genres, title, and summary content.
 */

import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = new Pool({ connectionString: "postgresql://postgres:postgres@localhost:5432/bookhive" });

const SHELF_PREFIX = {
  "Circulation": "CIR",
  "General Reference": "REF",
  "Filipiniana": "FIL",
  "Reserve": "RES",
  "Periodical": "PER",
  "Special Collections": "SPC",
};

function normalize(str = "") {
  return str.toLowerCase();
}

function matchesAny(text, keywords) {
  const t = normalize(text);
  return keywords.some((kw) => t.includes(kw));
}

const RULES = [
  {
    section: "Filipiniana",
    test: (r) =>
      matchesAny(`${r.genres} ${r.title} ${r.summary} ${r.author} ${r.publisher}`, [
        "philippine", "filipino", "pilipino", "filipin",
        "tagalog", "cebuano", "bisaya", "ilocano",
        "negros", "visayas", "batangas", "rizal jose",
        "noli me tangere", "el filibusterismo",
        "pamana", "bayan", "panitikan", "manila",
        "mindanao", "luzon", "visayan", "pilipinas",
      ]),
  },
  {
    section: "Periodical",
    test: (r) =>
      matchesAny(`${r.genres} ${r.title} ${r.summary}`, [
        "journalism", "newspaper", "magazine", "periodical",
        "newsletter", "serial", "editorial", "media studies",
        "broadcast", "reporting", "gazette", "chronicle",
        "press", "news", "current events",
      ]),
  },
  {
    section: "Special Collections",
    test: (r) =>
      matchesAny(`${r.genres} ${r.title} ${r.summary}`, [
        "thesis", "dissertation", "engineering", "maritime",
        "naval", "civil engineer", "mechanical engineer",
        "electrical engineer", "chemical engineer",
        "architecture", "technical report", "capstone",
        "shipboard", "nautical", "graduate research",
      ]),
  },
  {
    section: "Reserve",
    test: (r) =>
      matchesAny(`${r.genres} ${r.title} ${r.summary}`, [
        "textbook", "accounting", "auditing", "taxation",
        "law", "legal", "jurisprudence",
        "nursing", "medicine", "medical", "pharmacology",
        "anatomy", "physiology", "pathology", "clinical",
        "surgery", "board exam", "criminology",
        "study guide", "exam review", "course material",
      ]),
  },
  {
    section: "General Reference",
    test: (r) =>
      matchesAny(`${r.genres} ${r.title} ${r.summary}`, [
        "encyclopedia", "encyclopaedia", "dictionary",
        "handbook", "almanac", "atlas", "reference",
        "manual", "guide", "directory", "thesaurus",
        "bibliography", "glossary", "nonfiction",
        "non-fiction", "self-help", "how-to",
        "biography", "autobiography", "memoir",
      ]),
  },
  {
    section: "Circulation",
    test: () => true,
  },
];

function classifyBook(row) {
  for (const rule of RULES) {
    if (rule.test(row)) return rule.section;
  }
  return "Circulation";
}

function makeShelfLocation(section, seed) {
  const prefix = SHELF_PREFIX[section] ?? "CIR";
  const hash = crypto.createHash("md5").update(seed).digest("hex").substring(0, 4).toUpperCase();
  const num = (parseInt(hash, 16) % 900) + 100;
  return `${prefix}-${num}`;
}

async function main() {
  console.log("Connecting to database…");
  const client = await pool.connect();

  try {
    const { rows } = await client.query(
      "SELECT id, title, author, genres, summary, publisher FROM books"
    );
    console.log(`Found ${rows.length} books. Classifying…\n`);

    const counts = {};
    const updates = rows.map((row) => {
      const section = classifyBook(row);
      counts[section] = (counts[section] ?? 0) + 1;
      const shelf = makeShelfLocation(section, `${row.id}-${row.title}`);
      return { id: row.id, section, shelf };
    });

    console.log("Section distribution preview:");
    for (const [section, count] of Object.entries(counts).sort((a,b) => b[1]-a[1])) {
      console.log(`  ${section.padEnd(24)} ${count}`);
    }

    console.log("\nApplying updates (one by one — may take a moment)…");

    // Use a temp table for a fast bulk update
    await client.query(`
      CREATE TEMP TABLE _section_updates (
        id uuid,
        department text,
        shelf_location text
      )
    `);

    // Insert in batches
    const batchSize = 200;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const valuePlaceholders = batch.map(
        (_, idx) => `($${idx * 3 + 1}::uuid, $${idx * 3 + 2}, $${idx * 3 + 3})`
      ).join(", ");
      const params = batch.flatMap((u) => [u.id, u.section, u.shelf]);
      await client.query(
        `INSERT INTO _section_updates (id, department, shelf_location) VALUES ${valuePlaceholders}`,
        params
      );
      process.stdout.write(`\r  Staged ${Math.min(i + batchSize, updates.length)}/${updates.length}…`);
    }

    // Single bulk UPDATE via join
    const result = await client.query(`
      UPDATE books b
      SET
        department    = u.department,
        shelf_location = u.shelf_location
      FROM _section_updates u
      WHERE b.id = u.id
    `);

    await client.query("DROP TABLE IF EXISTS _section_updates");

    console.log(`\n\nDone! ${result.rowCount} books reassigned to library sections.`);

    // Final verification
    const { rows: dist } = await client.query(
      "SELECT department, COUNT(*) as total FROM books GROUP BY department ORDER BY total DESC"
    );
    console.log("\nFinal distribution in database:");
    for (const row of dist) {
      console.log(`  ${(row.department ?? "(null)").padEnd(24)} ${row.total}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
