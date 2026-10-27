import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, getSession } from "@/lib/auth";
import { extractUploadContext } from "@/lib/search/uploads";
import { BACKEND_URL } from "@/lib/config";
import { pool } from "@/lib/db";
import type { PromptSearchLog } from "@/lib/admin/types";
import type { BookAvailability, SearchResult } from "@/lib/types";

export const runtime = "nodejs";

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing",
  "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't",
  "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself",
  "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is",
  "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no",
  "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
  "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
  "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those",
  "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're",
  "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while",
  "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll",
  "you're", "you've", "your", "yours", "yourself", "yourselves",
  // Common search directive verbs, nouns, and fillers
  "find", "show", "search", "give", "recommend", "recommendation", "recommendations", "suggest", "suggestion",
  "get", "read", "want", "please", "library", "book", "books", "resource", "resources", "material", "materials",
  "looking", "look", "describe", "detail", "details", "analyze", "analyse", "similar", "file", "files",
  "document", "documents", "handout", "handouts", "syllabus", "tell", "need"
]);

// Conversational directives patterns to strip from the beginning or end of prompts
const DIRECTIVE_PREFIXES = [
  /^(find|show|give|search|recommend|get|suggest)(\s+me)?(\s+a|\s+an|\s+the|\s+any|\s+some)?\s+(books?|resources?|materials?|readings?)\s+(that\s+is\s+about|that\s+are\s+about|that\s+covers?|about|on|for|regarding|discussing)\s+/i,
  /^(can\s+you\s+)?(find|show|give|recommend|suggest)(\s+me)?\s+(a\s+book|books|resources?)\s+(about|on|for|regarding)\s+/i,
  /^(i\s+want|i\s+need|i'm\s+looking\s+for|looking\s+for)(\s+a|\s+an|\s+the)?\s+(books?|resources?)\s+(about|on|for|regarding)\s+/i,
  /^(what\s+are\s+some|what\s+is\s+a)\s+good\s+(books?|resources?)\s+(about|on|for)\s+/i,
  /^(tell\s+me\s+about|recommend\s+me)\s+/i,
  /^(is\s+there\s+any|are\s+there\s+any)\s+(books?|resources?)\s+(about|on|for)\s+/i,
];

interface AnalyzedPrompt {
  rawPrompt: string;
  cleanPrompt: string;
  keywords: string[];
}

function analyzePromptWordByWord(queryText: string, uploadedContext = ""): AnalyzedPrompt {
  let cleanPrompt = (queryText || "").trim();

  // 1. Strip conversational directives
  for (const pattern of DIRECTIVE_PREFIXES) {
    cleanPrompt = cleanPrompt.replace(pattern, "").trim();
  }

  // 2. Tokenize word by word
  const rawWords = (uploadedContext ? `${cleanPrompt} ${uploadedContext}` : cleanPrompt)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // 3. Filter significant keywords
  const keywords = rawWords.filter(w => !STOP_WORDS.has(w) && (w.length >= 2 || !isNaN(Number(w))));

  // 4. Fallback if all words were stripped
  const effectiveKeywords = keywords.length > 0 ? keywords : rawWords.filter(w => w.length >= 2);

  return {
    rawPrompt: queryText,
    cleanPrompt: cleanPrompt.toLowerCase(),
    keywords: effectiveKeywords,
  };
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function computeWordByWordRelevance(
  row: any,
  analyzed: AnalyzedPrompt,
  isPrefixFilter: boolean
): { relevance: number; matchedBy: string[] } {
  const title = (row.title || "").toLowerCase();
  const author = (row.author || "").toLowerCase();
  const category = (row.category || "").toLowerCase();
  const genres = (row.genres || "").toLowerCase();
  const department = (row.department || "").toLowerCase();
  const summary = (row.summary || "").toLowerCase();

  const cleanTitle = title.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const titleWords: string[] = cleanTitle.split(/\s+/).filter(Boolean);
  const titleSigWords = titleWords.filter((w: string) => !STOP_WORDS.has(w));
  const effectiveTitleWords = titleSigWords.length > 0 ? titleSigWords : titleWords;

  const rawCleanPrompt = analyzed.rawPrompt.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cleanCore = analyzed.cleanPrompt.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const keywords = analyzed.keywords;

  const matchedBy: string[] = [];

  // Filter Mode (Strict Prefix / Keyword Search)
  if (isPrefixFilter) {
    if (cleanTitle === rawCleanPrompt || cleanTitle === cleanCore) {
      return { relevance: 100, matchedBy: ["Exact Title Match"] };
    }
    if (cleanTitle.startsWith(rawCleanPrompt) || (cleanCore && cleanTitle.startsWith(cleanCore))) {
      const ratio = Math.min(1, Math.max(rawCleanPrompt.length, cleanCore.length) / Math.max(1, cleanTitle.length));
      return { relevance: Math.min(98, Math.round(86 + ratio * 12)), matchedBy: ["Title Prefix Filter"] };
    }
    if (cleanTitle.includes(rawCleanPrompt) || (cleanCore && cleanTitle.includes(cleanCore))) {
      return { relevance: 86, matchedBy: ["Title Keyword Filter"] };
    }
    if (author.includes(rawCleanPrompt) || (cleanCore && author.includes(cleanCore))) {
      return { relevance: 80, matchedBy: ["Author Match"] };
    }
    return { relevance: 75, matchedBy: ["Prefix Filter Match"] };
  }

  // AI Prompt Mode: Semantic & Word-by-Word Matching
  // 1. Exact Title Match
  if ((cleanTitle === rawCleanPrompt && rawCleanPrompt.length > 0) || (cleanTitle === cleanCore && cleanCore.length > 0)) {
    return { relevance: 100, matchedBy: ["Exact Title Match"] };
  }

  // 2. Full Core Phrase in Title (with strict word boundaries to avoid 'conscience' matching 'science')
  const coreWordRegex = cleanCore.length >= 2 ? new RegExp(`\\b${escapeRegex(cleanCore)}\\b`, "i") : null;
  if (coreWordRegex && coreWordRegex.test(cleanTitle)) {
    const coverage = cleanCore.length / Math.max(1, cleanTitle.length);
    const score = Math.round(92 + coverage * 6); // 92% - 98%
    return { relevance: Math.min(98, score), matchedBy: ["Title Phrase Match", `Covers "${analyzed.cleanPrompt}"`] };
  }

  // 3. Word-by-Word keyword evaluation
  if (keywords.length > 0) {
    let titleHits = 0;
    let authorHits = 0;
    let categoryHits = 0;
    let summaryHits = 0;
    const hitWords: string[] = [];

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const kwWordRegex = new RegExp(`\\b${escapeRegex(kwLower)}\\b`, "i");
      let hit = false;

      // Title word check with word boundaries or stem matching for longer words
      if (
        kwWordRegex.test(cleanTitle) ||
        titleWords.includes(kwLower) ||
        titleWords.some((tw: string) => tw.length >= 5 && kwLower.length >= 5 && (tw.startsWith(kwLower) || kwLower.startsWith(tw)))
      ) {
        titleHits++;
        hit = true;
      }

      // Author check
      if (kwWordRegex.test(author)) {
        authorHits++;
        hit = true;
      }

      // Category / Department / Genres check
      if (kwWordRegex.test(category) || kwWordRegex.test(genres) || kwWordRegex.test(department)) {
        categoryHits++;
        hit = true;
      }

      // Summary check
      if (kwWordRegex.test(summary)) {
        summaryHits++;
        hit = true;
      }

      if (hit) {
        hitWords.push(kw);
      }
    }

    const keywordRatio = hitWords.length / keywords.length;
    const titleRatio = titleHits / keywords.length;

    // All prompt keywords in title
    if (titleHits === keywords.length) {
      const titleCoverage = titleHits / Math.max(1, effectiveTitleWords.length);
      const score = Math.round(88 + titleCoverage * 9); // 88% - 97%
      matchedBy.push("Prompt Keywords in Title");
      if (hitWords.length > 0) matchedBy.push(`Matched: ${hitWords.join(", ")}`);
      return { relevance: Math.min(97, Math.max(88, score)), matchedBy };
    }

    // Partial keywords in title
    if (titleHits > 0) {
      const score = Math.round(76 + titleRatio * 14 + (categoryHits > 0 ? 4 : 0));
      matchedBy.push("Title Keyword Match");
      if (hitWords.length > 0) matchedBy.push(`Matched: ${hitWords.join(", ")}`);
      return { relevance: Math.min(90, Math.max(76, score)), matchedBy };
    }

    // Category / Subject match
    if (categoryHits > 0) {
      const score = Math.round(72 + (summaryHits > 0 ? 8 : 4));
      matchedBy.push("Subject & Category Match");
      if (hitWords.length > 0) matchedBy.push(`Topic: ${hitWords.join(", ")}`);
      return { relevance: Math.min(84, Math.max(72, score)), matchedBy };
    }

    // Author match
    if (authorHits > 0) {
      const score = Math.round(78 + (authorHits / keywords.length) * 10);
      matchedBy.push("Author Match");
      return { relevance: Math.min(88, Math.max(78, score)), matchedBy };
    }

    // Summary / content match
    if (summaryHits > 0) {
      const score = Math.round(62 + keywordRatio * 10);
      matchedBy.push("Content Synopsis Match");
      if (hitWords.length > 0) matchedBy.push(`Context: ${hitWords.join(", ")}`);
      return { relevance: Math.min(74, Math.max(60, score)), matchedBy };
    }
  }

  // Not relevant to this query
  return { relevance: 0, matchedBy: [] };
}

async function getSearchLogsFromDb(actor = ""): Promise<PromptSearchLog[]> {
  try {
    let whereClause = "";
    const params: any[] = [];
    if (actor) {
      const parts = actor.split(/\s+/).filter((p) => p.length > 2 && !p.includes("."));
      const surname = parts[parts.length - 1];
      if (surname && surname.toLowerCase() !== actor.toLowerCase()) {
        whereClause = "WHERE (lower(actor_name) LIKE $1 OR lower(actor_name) LIKE $2)";
        params.push(`%${actor.toLowerCase()}%`, `%${surname.toLowerCase()}%`);
      } else {
        whereClause = "WHERE lower(actor_name) LIKE $1";
        params.push(`%${actor.toLowerCase()}%`);
      }
    }

    const { rows } = await pool.query(
      `
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
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 1000
    `,
      params
    );
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
  const { searchParams } = new URL(request.url);
  const session = await getSession();
  const actor = searchParams.get("actor")?.trim() || session?.name || "";

  // Try proxying to Express backend first if available
  try {
    const backendUrl = actor
      ? `${BACKEND_URL}/api/admin/prompt-search?actor=${encodeURIComponent(actor)}`
      : `${BACKEND_URL}/api/admin/prompt-search`;
    const res = await fetch(backendUrl, {
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

  const logs = await getSearchLogsFromDb(actor);
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
        // AI semantic mode: match tokens word-by-word
        const analyzed = analyzePromptWordByWord(queryText, payload.uploadedContext);
        const keywords = analyzed.keywords;
        const cleanCore = analyzed.cleanPrompt;

        if (keywords.length > 0) {
          const kwPatterns = keywords.map(kw => `%${kw}%`);
          const kwIdx = paramIdx++;
          const coreIdx = paramIdx++;
          params.push(kwPatterns, `%${cleanCore}%`);

          sql += ` AND (
            LOWER(title) LIKE ANY($${kwIdx})
            OR LOWER(category) LIKE ANY($${kwIdx})
            OR LOWER(genres) LIKE ANY($${kwIdx})
            OR LOWER(author) LIKE ANY($${kwIdx})
            OR LOWER(summary) LIKE ANY($${kwIdx})
            OR LOWER(title) LIKE $${coreIdx}
          )`;

          sql += `
            ORDER BY
              CASE
                WHEN LOWER(title) = LOWER($${coreIdx}) THEN 1
                WHEN LOWER(title) LIKE LOWER($${coreIdx}) THEN 2
                WHEN LOWER(title) LIKE ANY($${kwIdx}) THEN 3
                WHEN LOWER(category) LIKE ANY($${kwIdx}) OR LOWER(genres) LIKE ANY($${kwIdx}) THEN 4
                ELSE 5
              END,
              borrow_count DESC,
              rating DESC
            LIMIT 80
          `;
        } else {
          const qIdx = paramIdx++;
          params.push(`%${cleanQ}%`);
          sql += ` AND (
            LOWER(title) LIKE $${qIdx}
            OR LOWER(author) LIKE $${qIdx}
            OR LOWER(summary) LIKE $${qIdx}
          ) ORDER BY borrow_count DESC, rating DESC LIMIT 80`;
        }
      }

      const { rows } = await pool.query(sql, params);
      const analyzed = analyzePromptWordByWord(queryText, payload.uploadedContext);

      results = rows
        .map((r: any) => {
          const { relevance, matchedBy } = computeWordByWordRelevance(r, analyzed, isPrefixFilter);
          let genresStr: string | undefined = undefined;
          if (r.genres) {
            if (Array.isArray(r.genres)) {
              genresStr = r.genres.join(", ");
            } else if (typeof r.genres === "string") {
              genresStr = r.genres;
            }
          }
          const isAvailable = r.availability !== "Unavailable" && r.availability !== "Borrowed";

          return {
            id: String(r.id),
            title: r.title || "Untitled",
            author: r.author || "Unknown Author",
            isbn: r.isbn || "N/A",
            department: (r.department as any) || "General",
            availability: (isAvailable ? "Available" : "Limited") as BookAvailability,
            relevance,
            summary: r.summary || "",
            matchedBy,
            genres: genresStr,
            language: r.language || "English",
            rating: r.rating ? Number(r.rating) : 4.5,
            coverImg: r.cover_img || undefined,
          };
        })
        .filter((r) => isPrefixFilter || r.relevance > 0);

      results.sort((a, b) => (b.relevance !== a.relevance ? b.relevance - a.relevance : a.title.localeCompare(b.title)));
    }

    // 3. Log search query in Neon DB
    if (queryText) {
      try {
        const session = await getSession();
        const actorName = session?.name || "Librarian / Admin";
        await pool.query(
          `INSERT INTO ai_search_logs (
            id, actor_name, prompt, department, mode, file_names, matches_found, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
          )`,
          [
            actorName,
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

    const session = await getSession();
    const actor = session?.name || "";
    const logs = await getSearchLogsFromDb(actor);
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
  const session = await getSession();
  const actor = searchParams.get("actor")?.trim() || session?.name || "";

  try {
    if (id) {
      await pool.query("DELETE FROM ai_search_logs WHERE id::text = $1", [id]);
    } else if (mode) {
      if (actor) {
        const surname = actor.split(/\s+/).pop() || actor;
        await pool.query(
          "DELETE FROM ai_search_logs WHERE mode = $1 AND (lower(actor_name) LIKE $2 OR lower(actor_name) LIKE $3)",
          [mode, `%${actor.toLowerCase()}%`, `%${surname.toLowerCase()}%`]
        );
      } else {
        await pool.query("DELETE FROM ai_search_logs WHERE mode = $1", [mode]);
      }
    } else {
      if (actor) {
        const surname = actor.split(/\s+/).pop() || actor;
        await pool.query(
          "DELETE FROM ai_search_logs WHERE lower(actor_name) LIKE $1 OR lower(actor_name) LIKE $2",
          [`%${actor.toLowerCase()}%`, `%${surname.toLowerCase()}%`]
        );
      } else {
        await pool.query("DELETE FROM ai_search_logs");
      }
    }
  } catch (err) {
    console.warn("[Prompt Search] Delete logs error:", err);
  }

  const logs = await getSearchLogsFromDb(actor);
  return NextResponse.json({ success: true, logs });
}
