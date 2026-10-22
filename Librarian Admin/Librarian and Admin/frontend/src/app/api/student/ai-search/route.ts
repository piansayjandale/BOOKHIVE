import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
  "find", "show", "search", "give", "recommend", "recommendation", "recommendations", "suggest", "suggestion",
  "get", "read", "want", "please", "library", "book", "books", "resource", "resources", "material", "materials",
  "looking", "look", "describe", "detail", "details", "analyze", "analyse", "similar", "file", "files",
  "document", "documents", "handout", "handouts", "syllabus", "tell", "need"
]);

const DIRECTIVE_PREFIXES = [
  /^(find|show|give|search|recommend|get|suggest)(\s+me)?(\s+a|\s+an|\s+the|\s+any|\s+some)?\s+(books?|resources?|materials?|readings?)\s+(that\s+is\s+about|that\s+are\s+about|that\s+covers?|about|on|for|regarding|discussing)\s+/i,
  /^(can\s+you\s+)?(find|show|give|recommend|suggest)(\s+me)?\s+(a\s+book|books|resources?)\s+(about|on|for|regarding)\s+/i,
  /^(i\s+want|i\s+need|i'm\s+looking\s+for|looking\s+for)(\s+a|\s+an|\s+the)?\s+(books?|resources?)\s+(about|on|for|regarding)\s+/i,
  /^(what\s+are\s+some|what\s+is\s+a)\s+good\s+(books?|resources?)\s+(about|on|for)\s+/i,
  /^(tell\s+me\s+about|recommend\s+me)\s+/i,
  /^(is\s+there\s+any|are\s+there\s+any)\s+(books?|resources?)\s+(about|on|for)\s+/i,
];

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function analyzePrompt(queryText: string) {
  let cleanPrompt = (queryText || "").trim();

  for (const pattern of DIRECTIVE_PREFIXES) {
    cleanPrompt = cleanPrompt.replace(pattern, "").trim();
  }

  const rawWords = cleanPrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const keywords = rawWords.filter(w => !STOP_WORDS.has(w) && (w.length >= 2 || !isNaN(Number(w))));
  const effectiveKeywords = keywords.length > 0 ? keywords : rawWords.filter(w => w.length >= 2);

  return {
    rawPrompt: queryText,
    cleanPrompt: cleanPrompt.toLowerCase(),
    keywords: effectiveKeywords,
  };
}

function computeRelevance(row: any, analyzed: { rawPrompt: string; cleanPrompt: string; keywords: string[] }) {
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

  if ((cleanTitle === rawCleanPrompt && rawCleanPrompt.length > 0) || (cleanTitle === cleanCore && cleanCore.length > 0)) {
    return 100;
  }

  const coreWordRegex = cleanCore.length >= 2 ? new RegExp(`\\b${escapeRegex(cleanCore)}\\b`, "i") : null;
  if (coreWordRegex && coreWordRegex.test(cleanTitle)) {
    const coverage = cleanCore.length / Math.max(1, cleanTitle.length);
    return Math.min(98, Math.round(92 + coverage * 6));
  }

  if (keywords.length > 0) {
    let titleHits = 0;
    let authorHits = 0;
    let categoryHits = 0;
    let summaryHits = 0;
    let hitCount = 0;

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      const kwWordRegex = new RegExp(`\\b${escapeRegex(kwLower)}\\b`, "i");
      let hit = false;

      if (
        kwWordRegex.test(cleanTitle) ||
        titleWords.includes(kwLower) ||
        titleWords.some((tw: string) => tw.length >= 5 && kwLower.length >= 5 && (tw.startsWith(kwLower) || kwLower.startsWith(tw)))
      ) {
        titleHits++;
        hit = true;
      }

      if (kwWordRegex.test(author)) {
        authorHits++;
        hit = true;
      }

      if (kwWordRegex.test(category) || kwWordRegex.test(genres) || kwWordRegex.test(department)) {
        categoryHits++;
        hit = true;
      }

      if (kwWordRegex.test(summary)) {
        summaryHits++;
        hit = true;
      }

      if (hit) hitCount++;
    }

    const keywordRatio = hitCount / keywords.length;
    const titleRatio = titleHits / keywords.length;

    if (titleHits === keywords.length) {
      const titleCoverage = titleHits / Math.max(1, effectiveTitleWords.length);
      return Math.min(97, Math.max(88, Math.round(88 + titleCoverage * 9)));
    }

    if (titleHits > 0) {
      return Math.min(90, Math.max(76, Math.round(76 + titleRatio * 14 + (categoryHits > 0 ? 4 : 0))));
    }

    if (categoryHits > 0) {
      return Math.min(84, Math.max(72, Math.round(72 + (summaryHits > 0 ? 8 : 4))));
    }

    if (authorHits > 0) {
      return Math.min(88, Math.max(78, Math.round(78 + (authorHits / keywords.length) * 10)));
    }

    if (summaryHits > 0) {
      return Math.min(74, Math.max(60, Math.round(62 + keywordRatio * 10)));
    }
  }

  return 0;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = (body.query || body.q || "").trim();
    const department = body.department || "All";

    if (!query) {
      return NextResponse.json({ results: [], books: [] }, { status: 200, headers: corsHeaders });
    }

    const analyzed = analyzePrompt(query);
    const keywords = analyzed.keywords;
    const cleanCore = analyzed.cleanPrompt;

    let sql = `
      SELECT 
        id::text AS "id",
        title,
        author,
        isbn,
        department,
        category,
        shelf_location AS "shelfLocation",
        summary,
        rating,
        cover_img AS "coverImg",
        cover_img AS "cover_img",
        genres,
        language,
        borrow_count AS "borrowCount",
        availability
      FROM books
      WHERE archived_at IS NULL
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (department && department !== "All") {
      sql += ` AND department = $${paramIdx++}`;
      params.push(department);
    }

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

      sql += ` ORDER BY 
        CASE 
          WHEN LOWER(title) = LOWER($${coreIdx}) THEN 1
          WHEN LOWER(title) LIKE LOWER($${coreIdx}) THEN 2
          WHEN LOWER(title) LIKE ANY($${kwIdx}) THEN 3
          WHEN LOWER(category) LIKE ANY($${kwIdx}) OR LOWER(genres) LIKE ANY($${kwIdx}) THEN 4
          ELSE 5
        END,
        borrow_count DESC,
        rating DESC
        LIMIT 60`;
    } else {
      const qIdx = paramIdx++;
      params.push(`%${query.toLowerCase()}%`);
      sql += ` AND (
        LOWER(title) LIKE $${qIdx}
        OR LOWER(author) LIKE $${qIdx}
        OR LOWER(summary) LIKE $${qIdx}
      ) ORDER BY borrow_count DESC, rating DESC LIMIT 60`;
    }

    const { rows } = await pool.query(sql, params);

    const formatted = rows
      .map((r: any) => {
        const isAvailable = r.availability !== "Unavailable" && r.availability !== "Borrowed";
        const totalCopies = Math.max(1, Number(r.copies || 1));
        const availableCopies = isAvailable ? totalCopies : 0;
        const relevance = computeRelevance(r, analyzed);

        return {
          id: r.id,
          title: r.title,
          author: r.author,
          isbn: r.isbn,
          department: r.department,
          totalCopies,
          copies: totalCopies,
          isAvailable,
          availableCopies,
          availability: isAvailable ? "Available" : "Unavailable",
          status: isAvailable ? "Available" : "Unavailable",
          borrowedCount: 0,
          reservedCount: 0,
          summary: r.summary,
          genres: r.genres,
          rating: r.rating ? Number(r.rating) : 4.5,
          coverImg: r.coverImg,
          cover_img: r.cover_img,
          relevance,
        };
      })
      .filter((r: any) => r.relevance > 0);

    formatted.sort((a: any, b: any) => b.relevance - a.relevance);

    return NextResponse.json(
      {
        results: formatted,
        books: formatted,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[Student AI Search API] Error:", err);
    return NextResponse.json(
      { message: err.message || "Search failed.", results: [], books: [] },
      { status: 500, headers: corsHeaders }
    );
  }
}
