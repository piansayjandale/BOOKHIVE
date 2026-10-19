import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";
import { extractUploadContext } from "@/lib/search/uploads";
import { BACKEND_URL } from "@/lib/config";
import { pool } from "@/lib/db";
import type { PromptSearchLog } from "@/lib/admin/types";
import type { SearchResult } from "@/lib/types";

export const runtime = "nodejs";

function mapRowToSearchResult(row: any, cleanQ: string, isPrefix: boolean): SearchResult {
  const titleLower = (row.title || "").toLowerCase();
  const authorLower = (row.author || "").toLowerCase();
  const rawClean = cleanQ.replace(/[^a-z0-9]/g, "");

  let relevance = 75;
  const matchedBy: string[] = [];

  if (titleLower === cleanQ || titleLower.replace(/[^a-z0-9]/g, "") === rawClean) {
    relevance = 100;
    matchedBy.push("exact title match");
  } else if (titleLower.startsWith(cleanQ) || (rawClean && titleLower.replace(/[^a-z0-9]/g, "").startsWith(rawClean))) {
    const ratio = Math.min(1, cleanQ.length / Math.max(1, titleLower.length));
    relevance = Math.min(98, Math.round(86 + ratio * 12));
    matchedBy.push(isPrefix ? "title prefix filter" : "title match");
  } else if (titleLower.replace(/^(the|a|an)\s+/i, "").startsWith(cleanQ)) {
    relevance = 92;
    matchedBy.push(isPrefix ? "title prefix filter" : "title match");
  } else if (titleLower.includes(cleanQ)) {
    relevance = 86;
    matchedBy.push("title keyword filter");
  } else if (authorLower.includes(cleanQ)) {
    relevance = 80;
    matchedBy.push("author match");
  } else {
    relevance = 75;
    matchedBy.push("content match");
  }

  let genresStr: string | undefined = undefined;
  if (row.genres) {
    if (Array.isArray(row.genres)) {
      genresStr = row.genres.join(", ");
    } else if (typeof row.genres === "string") {
      genresStr = row.genres;
    }
  }

  const isAvailable = row.availability !== "Unavailable" && row.availability !== "Borrowed";

  return {
    id: String(row.id),
    title: row.title || "Untitled",
    author: row.author || "Unknown Author",
    isbn: row.isbn || "N/A",
    department: (row.department as any) || "General",
    availability: isAvailable ? "Available" : "Limited",
    relevance,
    summary: row.summary || "",
    matchedBy,
    genres: genresStr,
    language: row.language || "English",
    rating: row.rating ? Number(row.rating) : 4.5,
    coverImg: row.cover_img || undefined,
  };
}

async function getSearchLogsFromDb(): Promise<PromptSearchLog[]> {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id::text,
        actor_name AS "actor",
        prompt AS "query",
        department,
        mode,
        COALESCE(file_names, ARRAY[]::text[]) AS "fileNames",
        matches_found AS "matchesFound",
        created_at::text AS "createdAt"
      FROM ai_search_logs
      ORDER BY created_at DESC
      LIMIT 50
    `);
    return rows.map((r: any) => ({
      id: r.id,
      actor: r.actor || "Staff",
      query: r.query || "",
      department: r.department || "All",
      mode: (r.mode as any) || "ai",
      fileNames: Array.isArray(r.fileNames) ? r.fileNames : [],
      matchesFound: Number(r.matchesFound || 0),
      createdAt: r.createdAt || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("[Prompt Search] Failed to fetch search logs from Neon DB:", err);
    return [];
  }
}

export async function GET(request: Request) {
  // Try proxying to Express backend first if available
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/prompt-search`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.logs)) {
        return NextResponse.json(data);
      }
    }
  } catch {
    // Backend offline / suspended -> use direct Neon DB fallback
  }

  const logs = await getSearchLogsFromDb();
  return NextResponse.json({ logs });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  
  let payload: {
    query: string;
    department: string;
    mode: string;
    uploadedContext: string;
    fileNames: string[];
  };

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const query = String(formData.get("query") ?? "");
    const department = String(formData.get("department") ?? "All");
    const mode = String(formData.get("mode") ?? "prefix");
    const files = formData.getAll("files").filter((file): file is File => file instanceof File);
    const uploadContext = await extractUploadContext(files);
    
    payload = {
      query,
      department,
      mode,
      uploadedContext: uploadContext.text,
      fileNames: uploadContext.fileNames,
    };
  } else {
    const body = await request.json();
    payload = {
      query: body.query ?? "",
      department: body.department ?? "All",
      mode: body.mode ?? "prefix",
      uploadedContext: body.uploadedContext ?? "",
      fileNames: body.fileNames ?? [],
    };
  }

  const cookieStore = await cookies();
  const token =
    cookieStore.get("bookhive_backend_token")?.value ||
    cookieStore.get(SESSION_COOKIE)?.value;

  // 1. Try Express backend with a fast timeout (1500ms)
  try {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(`${BACKEND_URL}/api/admin/prompt-search`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }
  } catch {
    // Express backend unavailable / suspended -> execute search directly via Neon PostgreSQL
  }

  // 2. Direct Neon PostgreSQL Search
  try {
    const queryText = (payload.query || "").trim();
    const department = payload.department || "All";
    const mode = payload.mode || "prefix";
    const isPrefixFilter = mode === "prefix" || mode === "filter";
    const cleanQ = queryText.toLowerCase();
    const rawClean = cleanQ.replace(/[^a-z0-9\s]/g, "").trim();

    let results: SearchResult[] = [];

    if (rawClean || queryText) {
      let sql = `
        SELECT id, title, author, isbn, department, category, shelf_location, summary, rating, cover_img, ai_score, genres, language, publisher, borrow_count, availability
        FROM books
        WHERE archived_at IS NULL
      `;
      const params: any[] = [];
      let paramIdx = 1;

      if (department !== "All") {
        sql += ` AND department = $${paramIdx}`;
        params.push(department);
        paramIdx++;
      }

      if (isPrefixFilter && rawClean) {
        const p1 = `${rawClean}%`;
        const p2 = `the ${rawClean}%`;
        const p3 = `a ${rawClean}%`;
        const p4 = `an ${rawClean}%`;
        const p5 = `%${rawClean}%`;

        const prefixIdx = paramIdx++;
        const thePrefixIdx = paramIdx++;
        const aPrefixIdx = paramIdx++;
        const anPrefixIdx = paramIdx++;
        const subIdx = paramIdx++;
        const exactIdx = paramIdx++;

        params.push(p1, p2, p3, p4, p5, rawClean);

        sql += ` AND (
          LOWER(title) LIKE LOWER($${prefixIdx})
          OR LOWER(title) LIKE LOWER($${thePrefixIdx})
          OR LOWER(title) LIKE LOWER($${aPrefixIdx})
          OR LOWER(title) LIKE LOWER($${anPrefixIdx})
          OR LOWER(title) LIKE LOWER($${subIdx})
          OR LOWER(author) LIKE LOWER($${subIdx})
          OR LOWER(isbn) LIKE LOWER($${subIdx})
        )`;

        sql += `
          ORDER BY
            CASE
              WHEN LOWER(title) = LOWER($${exactIdx}) THEN 1
              WHEN LOWER(title) LIKE LOWER($${prefixIdx}) THEN 2
              WHEN LOWER(title) LIKE LOWER($${thePrefixIdx}) OR LOWER(title) LIKE LOWER($${aPrefixIdx}) OR LOWER(title) LIKE LOWER($${anPrefixIdx}) THEN 3
              WHEN LOWER(title) LIKE LOWER($${subIdx}) THEN 4
              ELSE 5
            END,
            title ASC
          LIMIT 60
        `;
      } else {
        // AI semantic mode: match tokens in title, summary, genres, author
        const tokens = (payload.uploadedContext ? `${queryText} ${payload.uploadedContext}` : queryText)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter(t => t.length >= 3)
          .slice(0, 8);

        const subIdx = paramIdx++;
        params.push(`%${rawClean || cleanQ}%`);

        if (tokens.length > 0) {
          const tokenPatterns = tokens.map(t => `%${t}%`);
          const tokenIdx = paramIdx++;
          params.push(tokenPatterns);

          sql += ` AND (
            LOWER(title) LIKE LOWER($${subIdx})
            OR LOWER(author) LIKE LOWER($${subIdx})
            OR LOWER(summary) LIKE LOWER($${subIdx})
            OR LOWER(genres) LIKE LOWER($${subIdx})
            OR LOWER(title) LIKE ANY($${tokenIdx})
            OR LOWER(summary) LIKE ANY($${tokenIdx})
          )`;
        } else {
          sql += ` AND (
            LOWER(title) LIKE LOWER($${subIdx})
            OR LOWER(author) LIKE LOWER($${subIdx})
            OR LOWER(summary) LIKE LOWER($${subIdx})
          )`;
        }

        sql += ` ORDER BY borrow_count DESC, rating DESC LIMIT 60`;
      }

      const { rows } = await pool.query(sql, params);
      results = rows.map((r: any) => mapRowToSearchResult(r, cleanQ, isPrefixFilter));
      results.sort((a, b) => (b.relevance !== a.relevance ? b.relevance - a.relevance : a.title.localeCompare(b.title)));
    }

    // 3. Log search query in Neon DB
    if (queryText) {
      try {
        await pool.query(
          `INSERT INTO ai_search_logs (
            id, actor_name, prompt, department, mode, file_names, matches_found, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
          )`,
          [
            "Librarian / Admin",
            queryText,
            department,
            mode,
            payload.fileNames || [],
            results.length,
          ]
        );
      } catch (logErr) {
        console.warn("[Prompt Search] Failed to write search log:", logErr);
      }
    }

    const logs = await getSearchLogsFromDb();
    return NextResponse.json({ results, logs });
  } catch (dbError: any) {
    console.error("[Prompt Search] Direct Neon DB execution error:", dbError);
    return NextResponse.json(
      { message: dbError.message || "Search failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const mode = searchParams.get("mode");

  try {
    if (id) {
      await pool.query("DELETE FROM ai_search_logs WHERE id::text = $1", [id]);
    } else if (mode) {
      await pool.query("DELETE FROM ai_search_logs WHERE mode = $1", [mode]);
    } else {
      await pool.query("DELETE FROM ai_search_logs");
    }
  } catch (err) {
    console.warn("[Prompt Search] Delete logs error:", err);
  }

  const logs = await getSearchLogsFromDb();
  return NextResponse.json({ success: true, logs });
}
