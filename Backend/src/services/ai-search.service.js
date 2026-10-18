import "../polyfills.js";
import { pool } from "../db/pool.js";
import { searchCatalogByKeyword, formatCatalogBook } from "./catalog-loader.service.js";


// Academic Curriculum Knowledge Base for College Handouts, Syllabi & Course Codes
const ACADEMIC_CURRICULUM = [
  {
    code: "EUTHENICS",
    patterns: [/euthenics/i, /euth\s*ii/i, /euth\s*i/i, /values?\s*ed/i, /personality\s*dev/i, /character\s*build/i],
    subject: "Euthenics & Values Education",
    keywords: ["euthenics", "ethics", "values", "personality", "self help", "character", "human relations", "life skills", "psychology", "social grace", "attitude", "happiness", "integrity"],
    categories: ["Self Help", "Psychology", "Philosophy", "Nonfiction", "Education", "Humanities", "General Reference"],
    department: "Circulation Section",
  },
  {
    code: "NSTP",
    patterns: [/nstp/i, /rotc/i, /cwts/i, /lts/i, /national\s*service/i, /civic\s*welfare/i],
    subject: "National Service Training Program & Civic Welfare",
    keywords: ["civic welfare", "community service", "citizenship", "volunteerism", "disaster risk", "philippines", "leadership"],
    categories: ["Nonfiction", "Social Science", "History", "Education"],
    department: "General Reference Section",
  },
  {
    code: "DATA_STRUCTURES",
    patterns: [/data\s*struct/i, /algorithm/i, /dsa/i, /comp\s*sci/i, /cs\s*1/i],
    subject: "Data Structures & Algorithms",
    keywords: ["data structures", "algorithms", "arrays", "trees", "graphs", "sorting", "searching", "programming", "computer science"],
    categories: ["Computer Science", "Technology", "Programming", "Engineering"],
    department: "Technical Section",
  },
  {
    code: "PROGRAMMING",
    patterns: [/python/i, /java/i, /c\+\+/i, /javascript/i, /oop/i, /coding/i, /software\s*dev/i],
    subject: "Computer Programming & Software Development",
    keywords: ["programming", "software engineering", "coding", "object oriented", "web development", "syntax", "applications"],
    categories: ["Computer Science", "Technology", "Programming"],
    department: "Technical Section",
  },
  {
    code: "CYBERSECURITY",
    patterns: [/cyber/i, /infosec/i, /security/i, /network\s*sec/i, /crypt/i, /hacking/i],
    subject: "Cybersecurity & Information Assurance",
    keywords: ["cybersecurity", "information security", "cryptography", "firewall", "penetration testing", "ethical hacking", "vulnerability"],
    categories: ["Computer Science", "Technology", "Cybersecurity"],
    department: "Technical Section",
  },
  {
    code: "DATABASE",
    patterns: [/database/i, /dbms/i, /sql/i, /relational/i, /postgres/i, /mysql/i],
    subject: "Database Management Systems",
    keywords: ["database", "sql", "relational database", "queries", "normalization", "data modeling", "storage"],
    categories: ["Computer Science", "Technology", "Databases"],
    department: "Technical Section",
  },
  {
    code: "NETWORKING",
    patterns: [/network/i, /cisco/i, /tcp/i, /routing/i, /switch/i, /osi/i],
    subject: "Computer Networking & Telecommunications",
    keywords: ["computer networks", "tcp ip", "routing", "switching", "lan", "wan", "protocols", "telecommunications"],
    categories: ["Computer Science", "Engineering", "Technology"],
    department: "Technical Section",
  },
  {
    code: "ACCOUNTING",
    patterns: [/account/i, /finance/i, /bookkeep/i, /audit/i, /tax/i, /ledger/i],
    subject: "Accountancy & Financial Management",
    keywords: ["accounting", "financial statements", "bookkeeping", "auditing", "taxation", "balance sheet", "cost accounting"],
    categories: ["Business", "Economics", "Finance", "Management"],
    department: "Circulation Section",
  },
  {
    code: "MARKETING",
    patterns: [/market/i, /business/i, /entrepreneur/i, /advertis/i, /commerce/i],
    subject: "Business Administration & Marketing",
    keywords: ["marketing", "business strategy", "entrepreneurship", "consumer behavior", "management", "sales"],
    categories: ["Business", "Management", "Marketing", "Economics"],
    department: "Circulation Section",
  },
  {
    code: "CRIMINOLOGY",
    patterns: [/crimin/i, /forensic/i, /law\s*enforce/i, /police/i, /penology/i],
    subject: "Criminology & Forensic Science",
    keywords: ["criminology", "forensic science", "criminal justice", "investigation", "law enforcement", "penology"],
    categories: ["Law", "Criminology", "Social Science"],
    department: "Circulation Section",
  },
  {
    code: "FILIPINIANA",
    patterns: [/filipin/i, /rizal/i, /philippine/i, /tagalog/i, /negros/i, /history\s*phil/i],
    subject: "Filipiniana, History & Philippine Culture",
    keywords: ["philippines", "rizal", "filipino", "history", "culture", "literature", "heritage"],
    categories: ["History", "Philippines", "Literature", "Cultural"],
    department: "Filipiniana & Negrosiana Section",
  },
  {
    code: "MATHEMATICS",
    patterns: [/math/i, /calculus/i, /algebra/i, /geometry/i, /statist/i, /trigonomet/i],
    subject: "Mathematics & Statistics",
    keywords: ["mathematics", "calculus", "linear algebra", "statistics", "probability", "differential equations"],
    categories: ["Mathematics", "Science", "Education"],
    department: "Circulation Section",
  },
];

// Common conversational phrases that should be stripped when interpreting intent
const DIRECTIVE_PHRASES = [
  /is\s+there\s+any\s+books?\s+similar\s+to\s+this\s+file\??/i,
  /is\s+there\s+any\s+books?\s+similar\s+to\s+this\??/i,
  /are\s+there\s+any\s+books?\s+similar\s+to\s+this\s+file\??/i,
  /books?\s+similar\s+to\s+this\s+file\??/i,
  /books?\s+similar\s+to\s+this\??/i,
  /books?\s+like\s+this\s+file\??/i,
  /books?\s+like\s+this\??/i,
  /recommend\s+books?\s+for\s+this\s+file\??/i,
  /recommend\s+books?\s+for\s+this\??/i,
  /recommend\s+books?\s+about\s+this\??/i,
  /what\s+books?\s+should\s+i\s+read\s+for\s+this\??/i,
  /what\s+books?\s+are\s+related\s+to\s+this\??/i,
  /can\s+you\s+find\s+books?\s+for\s+this\??/i,
  /find\s+books?\s+about\s+this\s+file\??/i,
  /find\s+books?\s+similar\s+to\s+this\??/i,
  /similar\s+to\s+this\s+file/i,
  /related\s+to\s+this\s+file/i,
  /based\s+on\s+this\s+file/i,
  /similar\s+to\s+this/i,
  /related\s+to\s+this/i,
];

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do",
  "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
  "having", "he", "her", "here", "hers", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it",
  "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some",
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "with", "you", "your", "yours", "yourself", "yourselves",
  "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend",
  "recommended", "looking", "for", "about", "describe", "detail", "details", "analyse", "analyze", "similar", "file", "files", "document", "handout", "handouts"
]);

/**
 * Extract text from uploaded file buffer or base64
 */
export async function extractTextFromFile({ name, mimeType, base64, text }) {
  if (text && typeof text === "string" && text.trim().length > 0) {
    return text.trim();
  }

  if (!base64 || typeof base64 !== "string") {
    return "";
  }

  const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  const isPdf = (name && name.toLowerCase().endsWith(".pdf")) || (mimeType && mimeType.includes("pdf"));

  if (isPdf) {
    try {
      // Ensure browser globals are guaranteed to be present before parsing
      if (typeof globalThis.DOMMatrix === "undefined") {
        globalThis.DOMMatrix = class DOMMatrix {
          constructor() {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.e = 0;
            this.f = 0;
          }
        };
      }
      if (typeof globalThis.ImageData === "undefined") {
        globalThis.ImageData = class ImageData {};
      }
      if (typeof globalThis.Path2D === "undefined") {
        globalThis.Path2D = class Path2D {};
      }

      let extracted = "";
      try {
        // Dynamic runtime import to ensure pdf parser is never evaluated during server initialization
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        await parser.load();
        extracted = await parser.getText();
      } catch (parseErr) {
        // Fallback: direct dynamic import of pdfjs-dist
        try {
          const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            disableFontFace: true,
          });
          const doc = await loadingTask.promise;
          let fullText = "";
          for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
            const page = await doc.getPage(pageNum);
            const content = await page.getTextContent();
            const strings = content.items.map((item) => item.str || "");
            fullText += strings.join(" ") + "\n";
          }
          extracted = fullText;
        } catch (pdfjsErr) {
          console.warn("[AI Search] Direct pdfjs-dist fallback notice:", pdfjsErr.message);
          throw parseErr;
        }
      }

      return (extracted || "").trim();
    } catch (err) {
      console.warn("[AI Search] PDF text extraction error:", err.message);
    }
  }

  const isText = (name && (name.endsWith(".txt") || name.endsWith(".json") || name.endsWith(".csv") || name.endsWith(".md"))) || (mimeType && mimeType.includes("text"));
  if (isText) {
    try {
      return buffer.toString("utf-8").trim();
    } catch (err) {
      console.warn("[AI Search] Text decoding error:", err.message);
    }
  }

  return "";
}

/**
 * Resolves curriculum domain concepts from filename and extracted text
 */
export function resolveCurriculumDomain(fileName, extractedText = "") {
  const combined = `${fileName || ""} ${extractedText || ""}`.toLowerCase();

  for (const entry of ACADEMIC_CURRICULUM) {
    for (const pattern of entry.patterns) {
      if (pattern.test(combined)) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Parses user prompt and attached file to determine search intention and search tokens
 */
export function interpretPromptAndFile(prompt = "", file = null, extractedText = "") {
  const cleanPrompt = (prompt || "").trim();
  const fileName = file?.name || "";

  let isDirectiveSimilarToFile = false;
  for (const pattern of DIRECTIVE_PHRASES) {
    if (pattern.test(cleanPrompt)) {
      isDirectiveSimilarToFile = true;
      break;
    }
  }

  // Strip conversational prefixes/filler to isolate the core book title or keyword phrase
  let coreQuery = cleanPrompt;
  for (const pattern of DIRECTIVE_PHRASES) {
    coreQuery = coreQuery.replace(pattern, " ");
  }
  coreQuery = coreQuery
    .replace(
      /^(please\s+)?(can\s+you\s+)?(find|show|search|get|give|recommend|suggest|look\s+for|looking\s+for|i\s+want\s+to\s+read|i\s+need)\s+(me\s+)?(a\s+|an\s+|the\s+|some\s+|any\s+)?(books?\s+|novels?\s+|references?\s+|titles?\s+)?(about\s+|on\s+|for\s+|titled\s+|called\s+|named\s+|by\s+|with\s+)?/i,
      ""
    )
    .replace(/^(books?\s+|novels?\s+|references?\s+)(about\s+|on\s+|for\s+|like\s+|titled\s+|called\s+)/i, "")
    .trim();

  if (!coreQuery && cleanPrompt && !isDirectiveSimilarToFile) {
    coreQuery = cleanPrompt;
  }

  // Extract prompt keywords (supporting 2+ letter words and falling back to raw words if all are stop words)
  const rawPromptWords = (coreQuery || cleanPrompt)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const filteredPromptWords = rawPromptWords.filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const promptWords =
    filteredPromptWords.length > 0
      ? filteredPromptWords
      : isDirectiveSimilarToFile
      ? []
      : rawPromptWords.filter((w) => w.length >= 1);

  // Detect curriculum domain from file or prompt
  const domain = resolveCurriculumDomain(`${fileName} ${cleanPrompt}`, extractedText);

  const searchKeywords = new Set();
  const searchCategories = new Set();

  // 1. Always prioritize the user's explicit prompt words FIRST so they are never truncated
  promptWords.forEach((pw) => searchKeywords.add(pw));

  // 2. Extract salient words from file name
  if (fileName) {
    const rawNameTokens = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]+/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
    rawNameTokens.forEach((t) => searchKeywords.add(t));
  }

  // 3. Extract salient words from extracted file text if available
  if (extractedText && extractedText.length > 0) {
    const textTokens = extractedText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      .slice(0, 30);
    textTokens.forEach((t) => searchKeywords.add(t));
  }

  // 4. Add curriculum domain keywords (when a file is attached or domain is explicitly matched)
  if (domain) {
    domain.keywords.forEach((k) => searchKeywords.add(k));
    domain.categories.forEach((c) => searchCategories.add(c));
  }

  const formattedPromptTopic =
    promptWords.length > 0
      ? promptWords
          .slice(0, 5)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : cleanPrompt;

  const detectedSubject = domain
    ? domain.subject
    : formattedPromptTopic || "Library Catalog Reference";
  const targetDepartment = domain ? domain.department : null;

  const keywordList = Array.from(searchKeywords);
  const categoryList = Array.from(searchCategories);

  return {
    isDirectiveSimilarToFile,
    detectedSubject,
    targetDepartment,
    promptWords,
    coreQuery: coreQuery || cleanPrompt,
    keywordList,
    categoryList,
    cleanPrompt,
    hasFile: Boolean(file && file.name),
  };
}

/**
 * Computes an accurate relevance match percentage (0-100%) prioritizing book title matches
 */
export function computeAccurateMatchPercentage(row, analysis) {
  const rawTitle = String(row.title || "").trim();
  if (!rawTitle) return 0;

  const normTitle = rawTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cleanTitle = normTitle.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const compactTitle = normTitle.replace(/[^a-z0-9]/g, "");
  const titleWords = cleanTitle.split(/\s+/).filter(Boolean);
  const significantTitleWords = titleWords.filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  const effectiveTitleWords = significantTitleWords.length > 0 ? significantTitleWords : titleWords;

  const normAuthor = String(row.author || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const normCategory = `${row.category || ""} ${row.genres || ""} ${row.department || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const normSummary = String(row.summary || row.description || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const coreQuery = String(analysis.coreQuery || analysis.cleanPrompt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const cleanQuery = coreQuery.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const compactQuery = coreQuery.replace(/[^a-z0-9]/g, "");

  // 1. Exact Title Match -> 100%
  if (
    cleanQuery.length > 0 &&
    (normTitle === coreQuery || cleanTitle === cleanQuery || (compactQuery.length > 0 && compactTitle === compactQuery))
  ) {
    return 100;
  }

  const promptWords = Array.isArray(analysis.promptWords) ? analysis.promptWords : [];

  // 2. Full query phrase contained directly in the book title -> 94% - 99%
  if (cleanQuery.length >= 2 && cleanTitle.includes(cleanQuery)) {
    const wholeWordMatch = titleWords.includes(cleanQuery) || cleanTitle.startsWith(cleanQuery);
    const lengthRatio = Math.min(1, cleanQuery.length / Math.max(1, cleanTitle.length));
    const base = wholeWordMatch ? 94 : 90;
    return Math.min(99, Math.round(base + lengthRatio * 5));
  }

  // 3. Evaluate word-by-word matches against the Book Title, Author, Category, and Summary
  if (promptWords.length > 0) {
    let exactTitleWordHits = 0;
    let partialTitleWordHits = 0;
    let authorHits = 0;
    let catHits = 0;
    let summaryHits = 0;

    for (const pw of promptWords) {
      const pwLower = pw.toLowerCase();
      if (titleWords.includes(pwLower)) {
        exactTitleWordHits++;
        partialTitleWordHits++;
      } else if (
        cleanTitle.includes(pwLower) ||
        (pwLower.length >= 4 && titleWords.some((tw) => tw.startsWith(pwLower) || pwLower.startsWith(tw)))
      ) {
        partialTitleWordHits++;
      }

      if (normAuthor.includes(pwLower)) authorHits++;
      if (normCategory.includes(pwLower)) catHits++;
      if (normSummary.includes(pwLower)) summaryHits++;
    }

    // Count how many of the book's significant title words were matched by the prompt
    let matchedBookTitleWords = 0;
    for (const tw of effectiveTitleWords) {
      if (
        promptWords.some(
          (pw) =>
            tw === pw ||
            tw.includes(pw) ||
            (pw.length >= 4 && (tw.startsWith(pw) || pw.startsWith(tw)))
        )
      ) {
        matchedBookTitleWords++;
      }
    }
    const bookTitleCoverage =
      effectiveTitleWords.length > 0 ? matchedBookTitleWords / effectiveTitleWords.length : 0;
    const promptTitleRatio = partialTitleWordHits / promptWords.length;

    // All prompt words found in the book title -> 94% - 100%
    if (partialTitleWordHits === promptWords.length) {
      if (exactTitleWordHits === promptWords.length && bookTitleCoverage >= 0.85) {
        return 100;
      }
      return Math.min(99, Math.max(94, 93 + Math.round(bookTitleCoverage * 6)));
    }

    // Partial prompt words found in the book title
    if (partialTitleWordHits > 0) {
      const score =
        78 +
        Math.round(promptTitleRatio * 12) +
        Math.round(bookTitleCoverage * 5) +
        (exactTitleWordHits > 0 ? 2 : 0);
      return Math.min(93, Math.max(80, score));
    }

    // Author match
    if (authorHits > 0) {
      const authorRatio = authorHits / promptWords.length;
      return Math.min(90, Math.max(78, Math.round(78 + authorRatio * 12)));
    }

    // Category / Summary match
    if (catHits > 0 || summaryHits > 0) {
      const metaRatio = Math.min(1, (catHits + summaryHits) / promptWords.length);
      return Math.min(82, Math.max(68, Math.round(68 + metaRatio * 12)));
    }
  }

  // 4. File-based / curriculum domain match fallback
  if (analysis.hasFile || (analysis.keywordList && analysis.keywordList.length > 0)) {
    const kws = analysis.keywordList || [];
    let hits = 0;
    for (const kw of kws) {
      const kwL = kw.toLowerCase();
      if (cleanTitle.includes(kwL)) hits += 2;
      else if (normCategory.includes(kwL) || normSummary.includes(kwL)) hits += 1;
    }
    if (hits > 0) {
      return Math.min(92, Math.max(72, 70 + Math.min(22, hits * 4)));
    }
  }

  return 72;
}

/**
 * Executes AI Semantic Search on PostgreSQL books table
 */
export async function executeAiSearch({ prompt, file, limit = 40, department = null }) {
  const extractedText = await extractTextFromFile(file || {});
  const analysis = interpretPromptAndFile(prompt, file, extractedText);

  const promptWords = analysis.promptWords || [];
  const keywords = analysis.keywordList || [];
  const categories = analysis.categoryList || [];
  const coreQuery = (analysis.coreQuery || "").trim();

  if (keywords.length === 0 && !analysis.hasFile && !coreQuery) {
    return {
      books: [],
      total: 0,
      aiAnalysis: {
        fileName: file?.name || "",
        summary: "Please provide a search prompt or attach a document.",
        detectedSubject: "None",
        topics: [],
        totalMatches: 0,
      },
    };
  }

  const queryParams = [];
  let paramIdx = 1;

  const keywordCases = [];
  const orClauses = [];
  const titleMatchCases = [];

  // 1. Exact & Full Phrase Title / Author Matching
  if (coreQuery.length > 0 && !analysis.isDirectiveSimilarToFile) {
    queryParams.push(coreQuery);
    const exactIdx = paramIdx++;
    queryParams.push(`%${coreQuery}%`);
    const phraseIdx = paramIdx++;

    orClauses.push(`LOWER(TRIM(b.title)) = LOWER($${exactIdx})`);
    orClauses.push(`LOWER(b.title) LIKE LOWER($${phraseIdx})`);
    orClauses.push(`LOWER(b.author) LIKE LOWER($${phraseIdx})`);

    keywordCases.push(`CASE WHEN LOWER(TRIM(b.title)) = LOWER($${exactIdx}) THEN 350 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${phraseIdx}) THEN 220 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(b.author) LIKE LOWER($${phraseIdx}) THEN 90 ELSE 0 END`);
    titleMatchCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${phraseIdx}) THEN 1 ELSE 0 END`);
  }

  // 2. Prompt Word-by-Word Title & Metadata Matching (Highest priority for title words)
  for (const pw of promptWords.slice(0, 8)) {
    queryParams.push(`%${pw}%`);
    const idx = paramIdx++;

    orClauses.push(`LOWER(b.title) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(b.author) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.summary, '')) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.category, '')) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.genres::text, '')) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.department, '')) LIKE LOWER($${idx})`);

    keywordCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${idx}) THEN 100 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(b.author) LIKE LOWER($${idx}) THEN 45 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.category, '')) LIKE LOWER($${idx}) THEN 25 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.genres::text, '')) LIKE LOWER($${idx}) THEN 20 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.summary, '')) LIKE LOWER($${idx}) THEN 15 ELSE 0 END`);
    titleMatchCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${idx}) THEN 1 ELSE 0 END`);

    // Also support prefix/stem matching for words >= 4 chars (e.g., "program" <-> "programming")
    if (pw.length >= 5) {
      const stem = pw.replace(/(ing|tion|s|es|ed|ment)$/i, "");
      if (stem.length >= 4 && stem !== pw) {
        queryParams.push(`%${stem}%`);
        const sIdx = paramIdx++;
        orClauses.push(`LOWER(b.title) LIKE LOWER($${sIdx})`);
        keywordCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${sIdx}) THEN 60 ELSE 0 END`);
        titleMatchCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${sIdx}) THEN 1 ELSE 0 END`);
      }
    }
  }

  // 3. Supplementary File & Domain Keywords (when file is attached or no prompt words matched)
  const extraKeywords = keywords.filter((k) => !promptWords.includes(k)).slice(0, 8);
  for (const kw of extraKeywords) {
    queryParams.push(`%${kw}%`);
    const idx = paramIdx++;
    if (analysis.hasFile || promptWords.length === 0) {
      orClauses.push(`LOWER(b.title) LIKE LOWER($${idx})`);
      orClauses.push(`LOWER(COALESCE(b.summary, '')) LIKE LOWER($${idx})`);
      orClauses.push(`LOWER(COALESCE(b.category, '')) LIKE LOWER($${idx})`);
      orClauses.push(`LOWER(COALESCE(b.genres::text, '')) LIKE LOWER($${idx})`);
    }
    keywordCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${idx}) THEN 35 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.summary, '')) LIKE LOWER($${idx}) THEN 20 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.category, '')) LIKE LOWER($${idx}) THEN 15 ELSE 0 END`);
  }

  // 4. Category / Subject cases (only broaden OR clause when file is attached)
  for (const cat of categories.slice(0, 5)) {
    queryParams.push(`%${cat}%`);
    const cIdx = paramIdx++;
    if (analysis.hasFile) {
      orClauses.push(`LOWER(COALESCE(b.category, '')) LIKE LOWER($${cIdx})`);
      orClauses.push(`LOWER(COALESCE(b.genres::text, '')) LIKE LOWER($${cIdx})`);
    }
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.category, '')) LIKE LOWER($${cIdx}) THEN 20 ELSE 0 END`);
  }

  // NOTE: Do NOT restrict WHERE by department when searching by prompt/keywords,
  // because the mobile client sends activeDepartment ("Circulation Section") by default,
  // which previously hid books in Filipiniana, Engineering, or "Circulation" (without "Section")
  // and caused 0 MATCHES to be returned!
  const whereClause = orClauses.length > 0 ? `(${orClauses.join(" OR ")})` : "1=1";
  const relevanceExpression = keywordCases.length > 0 ? `(${keywordCases.join(" + ")})` : "50";
  const titleHitsExpression = titleMatchCases.length > 0 ? `(${titleMatchCases.join(" + ")})` : "0";

  queryParams.push(limit);
  const limitIdx = paramIdx++;

  const sql = `
    SELECT
      b.id,
      b.title,
      b.author,
      b.isbn,
      b.cover_img AS "coverUrl",
      b.summary AS "description",
      b.summary,
      b.rating,
      b.availability AS "status",
      b.department,
      b.category,
      b.genres,
      b.shelf_location AS "shelfLocation",
      TO_CHAR(COALESCE(b.published_date, b.created_at), 'YYYY') AS "year",
      COALESCE(b.copies, 1) AS copies,
      COALESCE(b.pages, 320) AS pages,
      COALESCE(b.language, 'EN') AS language,
      b.volume,
      b.edition,
      b.accession_number AS "accessionNumber",
      COALESCE(COUNT(CASE WHEN t.type::text = 'Borrow' AND t.status::text IN ('Approved', 'Pending') THEN 1 END), 0)::int AS "borrowedCount",
      COALESCE(COUNT(CASE WHEN t.type::text = 'Reservation' AND t.status::text IN ('Approved', 'Pending') AND (t.expires_at IS NULL OR t.expires_at > NOW()) THEN 1 END), 0)::int AS "reservedCount",
      ${relevanceExpression} AS relevance_score,
      ${titleHitsExpression} AS title_hits
    FROM books b
    LEFT JOIN transactions t ON (
      (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
      OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
    )
    WHERE b.archived_at IS NULL
      AND ${whereClause}
    GROUP BY b.id
    ORDER BY title_hits DESC, relevance_score DESC, b.title ASC
    LIMIT $${limitIdx};
  `;

  let books = [];
  try {
    const res = await pool.query(sql, queryParams);
    let rows = res.rows || [];

    // Supplement from 48k catalog books so books like "Romeo and Juliet" match across web and mobile
    if (promptWords.length > 0) {
      try {
        const catalogMatches = searchCatalogByKeyword(coreQuery || prompt, 20);
        const existingTitles = new Set(rows.map((r) => (r.title || "").toLowerCase().trim()));
        for (const cb of catalogMatches) {
          const cbTitle = (cb.title || "").toLowerCase().trim();
          if (!existingTitles.has(cbTitle)) {
            existingTitles.add(cbTitle);
            const fb = formatCatalogBook(cb);
            let titleHits = 0;
            for (const pw of promptWords) {
              if (cbTitle.includes(pw.toLowerCase())) titleHits++;
            }
            const rowItem = {
              ...fb,
              title_hits: titleHits,
              relevance_score: titleHits > 0 ? 300 : 50,
              borrowedCount: 0,
              reservedCount: 0,
            };
            if (titleHits > 0) {
              rows.unshift(rowItem);
            } else {
              rows.push(rowItem);
            }
          }
        }
      } catch (catErr) {
        console.warn("[AI Search] Catalog keyword supplement warning:", catErr.message);
      }
    }

    // If the user searched a text prompt (no file attached) and at least one book matched in the TITLE,
    // prioritize books that actually match the prompt words in title or author so results are tightly accurate to the prompt!
    if (!analysis.hasFile && promptWords.length > 0 && rows.some((r) => Number(r.title_hits) > 0)) {
      const titleOrAuthorRows = rows.filter((r) => {
        if (Number(r.title_hits) > 0) return true;
        const authorLower = String(r.author || "").toLowerCase();
        return promptWords.some((pw) => authorLower.includes(pw));
      });
      if (titleOrAuthorRows.length > 0) {
        rows = titleOrAuthorRows;
      }
    }

    books = rows
      .map((row) => {
        const matchPercentage = computeAccurateMatchPercentage(row, analysis);
        const totalCopies = Math.max(1, Number(row.copies || 1));
        const borrowedCount = Number(row.borrowedCount || 0);
        const reservedCount = Number(row.reservedCount || 0);
        const unavailableCopies = Math.min(totalCopies, borrowedCount);
        const reservedCopies = Math.min(Math.max(0, totalCopies - unavailableCopies), reservedCount);
        const availableCopies = Math.max(0, totalCopies - unavailableCopies - reservedCopies);
        const isAvailable = availableCopies > 0;
        const computedStatus = isAvailable ? "Available" : reservedCount > 0 ? "Reserved" : "Unavailable";

        return {
          id: String(row.id),
          isbn: row.isbn || "",
          local: true,
          status: computedStatus,
          availability: computedStatus,
          available: isAvailable,
          copies: totalCopies,
          availableCopies,
          borrowedCount,
          reservedCount,
          volume: row.volume || "Single Volume / None",
          edition: row.edition || "Single Edition / None",
          accessionNumber: row.accessionNumber || "",
          shelfLocation: row.shelfLocation || "Circulation Shelf",
          department: row.department || "Circulation Section",
          matchPercentage,
          volumeInfo: {
            title: row.title || "Library Reference",
            authors: [row.author || "Unknown Author"],
            description: row.description || row.summary || "",
            categories: [
              row.category ||
                (Array.isArray(row.genres) ? row.genres[0] : row.genres) ||
                row.department ||
                "General",
            ],
            publishedDate: String(row.year || "2024"),
            pageCount: row.pages || 320,
            language: row.language || "en",
            imageLinks: {
              thumbnail: row.coverUrl || "https://via.placeholder.com/100",
            },
          },
        };
      })
      .sort((a, b) => {
        if (b.matchPercentage !== a.matchPercentage) {
          return b.matchPercentage - a.matchPercentage;
        }
        return (a.volumeInfo?.title || "").localeCompare(b.volumeInfo?.title || "");
      });
  } catch (err) {
    console.error("[AI Search] Database search error:", err.message);
  }

  // Structure user-facing AI analysis summary
  const topTopics = (promptWords.length > 0 ? promptWords : keywords)
    .slice(0, 6)
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
  const fileNotice = file?.name ? `Analyzed file "${file.name}"` : "Analyzed prompt";
  const intentNotice = analysis.isDirectiveSimilarToFile
    ? `Identified topic: ${analysis.detectedSubject}. Recommending relevant library books matching the file.`
    : `Matching library references for ${analysis.detectedSubject}.`;

  const aiAnalysis = {
    fileName: file?.name || "",
    detectedSubject: analysis.detectedSubject,
    topics: topTopics,
    summary: `${fileNotice} • ${intentNotice}`,
    totalMatches: books.length,
  };

  return {
    books,
    total: books.length,
    aiAnalysis,
  };
}
