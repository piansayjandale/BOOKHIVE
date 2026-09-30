import { pool } from "../db/pool.js";
import { PDFParse } from "pdf-parse";

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
      const parser = new PDFParse({ data: buffer });
      await parser.load();
      const extracted = await parser.getText();
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

  // Detect curriculum domain from file
  const domain = resolveCurriculumDomain(fileName, extractedText);

  // Extract residual prompt keywords (removing stop words and directive words)
  const promptWords = cleanPrompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const searchKeywords = new Set();
  const searchCategories = new Set();
  let detectedSubject = domain ? domain.subject : "Academic Subject Reference";
  let targetDepartment = domain ? domain.department : null;

  if (domain) {
    domain.keywords.forEach((k) => searchKeywords.add(k));
    domain.categories.forEach((c) => searchCategories.add(c));
  }

  // Extract salient words from file name
  if (fileName) {
    const rawNameTokens = fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[_-]+/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    rawNameTokens.forEach((t) => searchKeywords.add(t));
  }

  // Extract salient words from extracted text if available
  if (extractedText && extractedText.length > 0) {
    const textTokens = extractedText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      .slice(0, 30);
    textTokens.forEach((t) => searchKeywords.add(t));
  }

  // Incorporate residual prompt words (if user specified additional constraints like "chapter 2 ethics")
  promptWords.forEach((pw) => searchKeywords.add(pw));

  const keywordList = Array.from(searchKeywords);
  const categoryList = Array.from(searchCategories);

  return {
    isDirectiveSimilarToFile,
    detectedSubject,
    targetDepartment,
    keywordList,
    categoryList,
    cleanPrompt,
    hasFile: Boolean(file && file.name),
  };
}

/**
 * Executes AI Semantic Search on PostgreSQL books table
 */
export async function executeAiSearch({ prompt, file, limit = 40, department = null }) {
  const extractedText = await extractTextFromFile(file || {});
  const analysis = interpretPromptAndFile(prompt, file, extractedText);

  const keywords = analysis.keywordList;
  const categories = analysis.categoryList;

  if (keywords.length === 0 && !analysis.hasFile && !prompt) {
    return {
      books: [],
      total: 0,
      aiAnalysis: {
        summary: "Please provide a search prompt or attach a document.",
        detectedSubject: "None",
        topics: [],
      },
    };
  }

  // Build intelligent SQL query ranking by semantic relevance to file and prompt
  const queryParams = [];
  let paramIdx = 1;

  const keywordCases = [];
  const orClauses = [];

  // 1. Primary search keywords from file analysis
  for (const kw of keywords.slice(0, 8)) {
    queryParams.push(`%${kw}%`);
    const idx = paramIdx++;
    orClauses.push(`LOWER(b.title) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.summary, '')) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.category, '')) LIKE LOWER($${idx})`);
    orClauses.push(`LOWER(COALESCE(b.genres, '')) LIKE LOWER($${idx})`);

    keywordCases.push(`CASE WHEN LOWER(b.title) LIKE LOWER($${idx}) THEN 40 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.summary, '')) LIKE LOWER($${idx}) THEN 25 ELSE 0 END`);
    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.category, '')) LIKE LOWER($${idx}) THEN 20 ELSE 0 END`);
  }

  // 2. Category / Subject cases
  for (const cat of categories.slice(0, 5)) {
    queryParams.push(`%${cat}%`);
    const cIdx = paramIdx++;
    orClauses.push(`LOWER(COALESCE(b.category, '')) LIKE LOWER($${cIdx})`);
    orClauses.push(`LOWER(COALESCE(b.genres, '')) LIKE LOWER($${cIdx})`);

    keywordCases.push(`CASE WHEN LOWER(COALESCE(b.category, '')) LIKE LOWER($${cIdx}) THEN 25 ELSE 0 END`);
  }

  // If department filter specified
  let deptClause = "";
  if (department && department !== "All") {
    queryParams.push(`%${department}%`);
    const dIdx = paramIdx++;
    deptClause = `AND (b.department ILIKE $${dIdx} OR b.category ILIKE $${dIdx})`;
  }

  const whereClause = orClauses.length > 0 ? `(${orClauses.join(" OR ")})` : "1=1";
  const relevanceExpression = keywordCases.length > 0 ? `(${keywordCases.join(" + ")})` : "50";

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
      ${relevanceExpression} AS relevance_score
    FROM books b
    WHERE ${whereClause}
      ${deptClause}
    ORDER BY relevance_score DESC, b.title ASC
    LIMIT $${limitIdx};
  `;

  let books = [];
  try {
    const res = await pool.query(sql, queryParams);
    const maxScore = res.rows.length > 0 ? Math.max(...res.rows.map((r) => Number(r.relevance_score) || 1)) : 1;

    books = res.rows.map((row) => {
      const rawScore = Number(row.relevance_score) || 0;
      // Normalize match percentage cleanly between 72% and 98%
      const matchPercentage = Math.min(98, Math.max(72, Math.round(70 + (rawScore / maxScore) * 28)));

      return {
        id: String(row.id),
        isbn: row.isbn,
        local: true,
        status: row.status || "Available",
        shelfLocation: row.shelfLocation || "Circulation Shelf",
        department: row.department || "Circulation Section",
        matchPercentage,
        volumeInfo: {
          title: row.title || "Library Reference",
          authors: [row.author || "Unknown Author"],
          description: row.description || row.summary || "",
          categories: [row.category || row.genres || row.department || "General"],
          publishedDate: String(row.year || "2024"),
          pageCount: row.pages || 320,
          language: row.language || "en",
          imageLinks: {
            thumbnail: row.coverUrl || "https://via.placeholder.com/100",
          },
        },
      };
    });
  } catch (err) {
    console.error("[AI Search] Database search error:", err.message);
  }

  // Structure user-facing AI analysis summary
  const topTopics = keywords.slice(0, 6).map((k) => k.charAt(0).toUpperCase() + k.slice(1));
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
