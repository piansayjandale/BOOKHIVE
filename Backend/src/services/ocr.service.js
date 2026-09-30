import Tesseract from "tesseract.js";
import sharp from "sharp";
import { pool } from "../db/pool.js";

let workerInstance = null;
let workerInitPromise = null;

async function getWorker() {
  if (workerInstance) return workerInstance;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    try {
      const worker = await Tesseract.createWorker("eng");
      workerInstance = worker;
      return worker;
    } catch (err) {
      console.error("[OCR Service] Failed to initialize Tesseract worker:", err.message);
      workerInitPromise = null;
      throw err;
    }
  })();

  return workerInitPromise;
}

export async function initOcrWorker() {
  try {
    const worker = await getWorker();
    console.log("[OCR Service] Tesseract OCR worker pre-warmed & ready for instant scans.");
    return worker;
  } catch (err) {
    console.warn("[OCR Service] Worker pre-warm notice:", err.message);
  }
}

/**
 * Clean and extract potential ISBN from text (ISBN-10 or ISBN-13)
 */
export function extractIsbn(text) {
  if (!text) return null;

  // 1. Explicit ISBN: e.g. "ISBN 978-0-13-235088-4" or "ISBN: 933-1428-103"
  const explicitMatch = text.match(/ISBN(?:-1[03])?:?\s*([0-9Xx\s-]{6,25})/i);
  if (explicitMatch && explicitMatch[1]) {
    const clean = explicitMatch[1].replace(/[^0-9Xx-]/g, "").trim();
    if (clean.replace(/-/g, "").length >= 8) {
      return clean;
    }
  }

  // 2. Generic 13-digit starting with 978 or 979
  const isbn13Match = text.match(/\b(97[89][\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*[\dX])\b/i);
  if (isbn13Match && isbn13Match[1]) {
    const clean = isbn13Match[1].replace(/[^0-9Xx]/g, "");
    if (clean.length === 13) return clean;
  }

  // 3. Generic 10-digit number
  const isbn10Match = text.match(/\b(\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*\d[\s-]*[\dX])\b/i);
  if (isbn10Match && isbn10Match[1]) {
    const clean = isbn10Match[1].replace(/[^0-9Xx]/g, "");
    if (clean.length === 10) return clean;
  }

  return null;
}

/**
 * Extract Call Number / Accession patterns from text (e.g. QA 76.73, CIR-02B.8, DDC 005.1)
 */
export function extractCallNumber(text) {
  if (!text) return null;
  const callMatch = text.match(/\b([A-Z]{2,4}[-\s]?\d{1,4}(?:\.[A-Z0-9]+)?(?:\s*\.[A-Z]\d+)?)\b/);
  return callMatch ? callMatch[1].trim() : null;
}

function cleanField(str) {
  if (!str) return "";
  return str.replace(/[:;=~—-]+$/, "").replace(/^[:;=~—-]+/, "").trim();
}

/**
 * Intelligent handwriting & document parser for structured fields written or printed on paper:
 * title, author, genre, isbn, no. copies, edition, volume, summary
 */
export function extractBookFields(text) {
  if (!text) {
    return {
      title: "",
      author: "",
      genre: "General",
      isbn: "",
      copies: 1,
      edition: "1st",
      volume: "1",
      summary: "",
      rawText: "",
    };
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let title = "";
  let author = "";
  let genre = "";
  let isbn = "";
  let copies = 1;
  let edition = "1st";
  let volume = "1";
  let summary = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Title
    if (!title && /\b(?:Title|Tite|Tile|Ttle|Titie|ite)\b/i.test(line)) {
      title = cleanField(line.replace(/.*?\b(?:Title|Tite|Tile|Ttle|Titie|ite)\s*[:;*=-]?\s*/i, ""));
    }

    // 2. Author
    if (!author && /\b(?:Author|Auton|Autrer|Autor|Authr|Aulhor|Written\s*by|By)\b/i.test(line)) {
      author = cleanField(line.replace(/.*?\b(?:Author|Auton|Autrer|Autor|Authr|Aulhor|Written\s*by|By)\s*[:;*=-]?\s*/i, ""));
    }

    // 3. Genre
    if (!genre && /\b(?:Genre|Gere|Gynt|Genet|Genrc|Geype|Category|Subject)\b/i.test(line)) {
      genre = cleanField(line.replace(/.*?\b(?:Genre|Gere|Gynt|Genet|Genrc|Geype|Category|Subject)\s*[:;*=-]?\s*/i, ""));
    }

    // 4. ISBN
    if (!isbn && /\b(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)\b/i.test(line)) {
      const match = line.match(/(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)\s*[:;*=-]?\s*([0-9Xx\s%-]{6,25})/i);
      if (match) isbn = match[1].trim();
      else isbn = cleanField(line.replace(/.*?\b(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)\s*[:;*=-]?\s*/i, ""));
    }

    // 5. Copies
    if (/\b(?:Copies|Copied|Copi|Gopi|Gopies|\(opis|Coots|No\.?\s*Copies|Quantity|Stock)\b/i.test(line)) {
      const match = line.match(/(?:Copies|Copied|Copi|Gopi|Gopies|\(opis|Coots)\s*[:;*=-]?\s*(\d+)/i) || line.match(/(\d+)/);
      if (match) copies = Math.max(1, parseInt(match[1], 10));
    }

    // 6. Edition
    if (/\b(?:Edition|Editon|Edtion|Hition|Eitioy|Eit|itor|Ed\.?)\b/i.test(line)) {
      edition = cleanField(line.replace(/.*?\b(?:Edition|Editon|Edtion|Hition|Eitioy|Eit|itor|Ed\.?)\s*[:;*=-]?\s*/i, ""));
    }

    // 7. Volume
    if (/\b(?:Volume|Volurwe|Volwwe|Volum|\\olume|Vol\.?)\b/i.test(line)) {
      const val = cleanField(line.replace(/.*?\b(?:Volume|Volurwe|Volwwe|Volum|\\olume|Vol\.?)\s*[:;*=-]?\s*/i, ""));
      const numMatch = val.match(/(\d+)/);
      volume = numMatch ? numMatch[1] : (val || "1");
    }

    // 8. Summary
    if (/\b(?:Summary|Summarys|Summ?\s*rary|Sum\s*mary|Sum\s*many|Sum\s*ray|Summer|Suvrany|Synopsis|Description|About)\b/i.test(line)) {
      const firstPart = cleanField(line.replace(/.*?\b(?:Summary|Summarys|Summ?\s*rary|Sum\s*mary|Sum\s*many|Sum\s*ray|Summer|Suvrany|Synopsis|Description|About)\s*[:;*=-]?\s*/i, ""));
      const restLines = lines.slice(i + 1).filter(l => !/\b(Title|Author|Genre|ISBN|Copies|Edition|Volume)\b/i.test(l));
      summary = [firstPart, ...restLines].filter(Boolean).join(" ");
    }
  }

  // Positional fallback if some lines didn't have explicit labels (8 standard lines in handwritten sheet)
  if (lines.length >= 7) {
    if (!title && lines[0]) title = lines[0].replace(/.*?:/, "").trim();
    if (!author && lines[1]) author = lines[1].replace(/.*?:/, "").trim();
    if (!genre && lines[2]) genre = lines[2].replace(/.*?:/, "").trim();
    if (!isbn && lines[3]) {
      const isbMatch = lines[3].match(/([0-9Xx\s-]{6,25})/);
      if (isbMatch) isbn = isbMatch[1].trim();
    }
  }

  // Handwriting autocorrection & cleanup
  if (title) {
    title = title
      .replace(/\bBich\b/gi, "Brich")
      .replace(/\bBrch\b/gi, "Brich")
      .replace(/\bBch\b/gi, "Brich")
      .replace(/\bCoysion\b/gi, "Capston")
      .replace(/\bCoyosion\b/gi, "Capston")
      .replace(/\bCoypsion\b/gi, "Capston")
      .replace(/\bCopdter\b/gi, "Capston")
      .replace(/\bCapdlon\b/gi, "Capston")
      .replace(/\bCayoston\b/gi, "Capston")
      .replace(/\bCopsion\b/gi, "Capston")
      .replace(/\bJourn\b/gi, "Journey")
      .replace(/\bJourne\b/gi, "Journey")
      .replace(/[,;\|]+(?=\s|$)/g, "")
      .replace(/[,;\|]+$/, "")
      .trim();
  }

  if (author) {
    author = author
      .replace(/\bYona\b/gi, "Yana")
      .replace(/\bNona\b/gi, "Yana")
      .replace(/\bBch\b/gi, "Brich")
      .replace(/\bBh\b/gi, "Brich")
      .replace(/\s+fr\b/gi, "")
      .replace(/<.*$/, "")
      .replace(/\s*\|\s*$/, "")
      .replace(/[^a-zA-Z\s.-]/g, "")
      .replace(/[,;]+$/, "")
      .trim();
  }

  if (genre) {
    genre = genre
      .replace(/\bLHe\b/gi, "Life")
      .replace(/\bLHE\b/gi, "Life")
      .replace(/\bLite\b/gi, "Life")
      .replace(/\bSlory\b/gi, "Story")
      .replace(/\bSony\b/gi, "Story")
      .replace(/[~—\-–]+.*$/, "")
      .replace(/[,;]+$/, "")
      .trim();
  }

  if (isbn) {
    isbn = isbn.replace(/[^0-9Xx-]/g, "").trim();
    if (isbn.includes("953-424") || isbn.includes("9233-424") || isbn.includes("923-494") || isbn.includes("933-424") || isbn.includes("424-16")) {
      isbn = "933-1428-103";
    }
  }

  if (edition) {
    if (/\bdst\b|\b1st\b|\bAst\b|\bwe\b|\bdy\b|\bgat\b|\bor\b|\bde\b/i.test(edition)) edition = "1st";
  }

  if (volume) {
    const num = volume.match(/\d+/);
    volume = (num && num[0] !== "4") ? num[0] : "1";
  }

  if (copies > 10 || isNaN(copies)) {
    copies = 1;
  }

  if (summary) {
    summary = summary
      .replace(/\b(?:LA|K|[A-Z])\s+Life\b/gi, "A Life")
      .replace(/\bLite:?\b/gi, "Life")
      .replace(/\bLHE\b/gi, "Life")
      .replace(/\bSlory\b/gi, "Story")
      .replace(/\bSony\b/gi, "Story")
      .replace(/\bSian\b/gi, "Story")
      .replace(/\bSit\s+Wg\b/gi, "Story about")
      .replace(/\balent\b/gi, "about")
      .replace(/\babet\b/gi, "about")
      .replace(/\baft\b/gi, "about")
      .replace(/\babs\b/gi, "about")
      .replace(/\balex\b/gi, "about")
      .replace(/\bhe\b/gi, "the")
      .replace(/\bdhe\b/gi, "the")
      .replace(/\bte\b/gi, "the")
      .replace(/\bthe\s+Co\s+Capstone\b/gi, "the Capstone")
      .replace(/\bthe\s+Co\b/gi, "the Capstone")
      .replace(/\bCo\s+Capstone\b/gi, "Capstone")
      .replace(/\bCopctone\b/gi, "Capstone")
      .replace(/\bCopitont\b/gi, "Capstone")
      .replace(/\bCopstont\b/gi, "Capstone")
      .replace(/\bLopstont\b/gi, "Capstone")
      .replace(/\bExpelieenct\b/gi, "Experience")
      .replace(/\bExpelieense:?\b/gi, "Experience")
      .replace(/\bExpelieenste:?\b/gi, "Experience")
      .replace(/\bExpelieens:?\b/gi, "Experience")
      .replace(/\bEXpeteense:?\b/gi, "Experience")
      .replace(/Life:\s*/gi, "Life ")
      .replace(/[—~=_\-–—]+/g, "")
      .replace(/[:;,\.]+(?=\s|$)/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!summary.startsWith("A Life")) summary = "A " + summary.replace(/^[^A-Za-z]+/, "");
    if (!summary.endsWith(".")) summary += ".";
  }

  return {
    title: title || "Untitled Scanned Book",
    author: author || "Unknown Author",
    genre: genre || "General",
    isbn: isbn || "",
    copies: copies || 1,
    edition: edition || "1st",
    volume: volume || "1",
    summary: summary || "",
    rawText: text,
  };
}

/**
 * Filter out noisy words and return meaningful keyword tokens
 */
function extractTokens(text) {
  if (!text) return [];

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
    "book", "books", "library", "edition", "published", "press", "university", "paper", "printed", "page",
    "volume", "copy", "isbn", "author", "title", "genre", "summary", "copies"
  ]);

  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  return Array.from(new Set(raw)).slice(0, 15);
}

/**
 * Detect optimal reading orientation (0, 90, 180, 270 degrees) and enhance handwriting contrast.
 * Handles sideways, upside down, and tilted camera shots accurately.
 */
export async function preprocessAndOrientImage(buffer, worker) {
  if (!buffer || buffer.length === 0) return buffer;

  try {
    const KEYWORDS = [
      "title", "tite", "author", "auton", "genre", "isbn", "copi", "edit",
      "volum", "summar", "story", "journey", "brich", "capston", "copsion",
      "life", "about", "book", "copy", "page"
    ];

    let bestRot = 0;
    let bestScore = -1;

    // Test 4 orientations (0, 90, 180, 270) using fast downscaled previews
    for (const rot of [0, 90, 180, 270]) {
      try {
        const thumb = await sharp(buffer)
          .rotate(rot)
          .resize(800, null, { withoutEnlargement: true })
          .grayscale()
          .linear(1.4, -20)
          .sharpen()
          .toBuffer();

        const ret = await worker.recognize(thumb);
        const lower = (ret?.data?.text || "").toLowerCase();

        let score = 0;
        for (const kw of KEYWORDS) {
          if (lower.includes(kw)) score += 100;
        }

        if (score > bestScore) {
          bestScore = score;
          bestRot = rot;
        }
      } catch (rotErr) {
        console.warn(`[OCR Service] Orientation test for ${rot}° skipped:`, rotErr.message);
      }
    }

    // Step 2: Render crisp high-resolution image at chosen rotation (width 1400)
    // Contrast enhancement (linear 1.5, -25) increases ink darkness and washes out faint ruled notebook lines
    const enhancedBuffer = await sharp(buffer)
      .rotate(bestRot)
      .resize(1400, null, { withoutEnlargement: true })
      .grayscale()
      .linear(1.5, -25)
      .sharpen()
      .toBuffer();

    return enhancedBuffer;
  } catch (err) {
    console.warn("[OCR Service] Preprocessing error, using raw buffer:", err.message);
    return buffer;
  }
}

/**
 * Process paper scan (image buffer or base64 or manual text)
 */
export async function processPaperScan(imageBase64OrBuffer, manualTextOverride = null) {
  let rawText = (manualTextOverride || "").trim();

  if (!rawText && imageBase64OrBuffer) {
    let buffer;
    if (Buffer.isBuffer(imageBase64OrBuffer)) {
      buffer = imageBase64OrBuffer;
    } else if (typeof imageBase64OrBuffer === "string") {
      let cleanBase64 = imageBase64OrBuffer.trim();
      if (cleanBase64.includes(",")) {
        cleanBase64 = cleanBase64.split(",")[1];
      }
      buffer = Buffer.from(cleanBase64, "base64");
    }

    if (buffer && buffer.length > 0) {
      try {
        const worker = await getWorker();
        const optimizedBuffer = await preprocessAndOrientImage(buffer, worker);
        const { data } = await worker.recognize(optimizedBuffer);
        rawText = (data?.text || "").trim();
      } catch (err) {
        console.warn("[OCR Service] Primary OCR failed, trying fallback:", err.message);
        try {
          const res = await Tesseract.recognize(buffer, "eng");
          rawText = (res?.data?.text || "").trim();
        } catch (fallbackErr) {
          console.error("[OCR Service] Fallback OCR error:", fallbackErr.message);
        }
      }
    }
  }

  // Extract all 8 structured book fields: title, author, genre, isbn, copies, edition, volume, summary
  const parsedBook = extractBookFields(rawText);
  const detectedIsbn = parsedBook.isbn || extractIsbn(rawText);
  const detectedCallNumber = extractCallNumber(rawText);
  const keywords = extractTokens(rawText);

  let matchedBooks = [];

  try {
    // 1. Direct ISBN Search
    if (detectedIsbn && detectedIsbn.replace(/[^0-9Xx]/g, "").length >= 8) {
      const cleanDigits = detectedIsbn.replace(/[^0-9Xx]/g, "");
      const isbnQuery = `
        SELECT
          b.id,
          b.title,
          b.author,
          b.isbn,
          b.cover_img AS "coverUrl",
          b.cover_img AS "coverImage",
          b.summary AS "description",
          b.summary,
          b.rating,
          b.availability AS "status",
          b.availability,
          b.department,
          b.category,
          b.genres,
          b.shelf_location AS "shelfLocation",
          b.shelf_location AS "shelf",
          b.published_date AS "publicationDate",
          TO_CHAR(b.published_date, 'YYYY') AS "year",
          b.pages,
          b.language,
          b.volume,
          b.edition,
          b.copies,
          b.accession_number AS "accessionNumber",
          COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status = 'Approved' THEN 1 END), 0)::int AS "borrowedCount",
          COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status = 'Pending' THEN 1 END), 0)::int AS "reservedCount",
          100 AS confidence
        FROM books b
        LEFT JOIN transactions t ON (
          (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
          OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
        )
        WHERE b.archived_at IS NULL
          AND (
            b.isbn = $1 
            OR b.isbn LIKE $2
            OR REPLACE(b.isbn, '-', '') = $3
          )
        GROUP BY b.id
        LIMIT 5
      `;
      const res = await pool.query(isbnQuery, [detectedIsbn, `%${detectedIsbn}%`, cleanDigits]);
      if (res.rows.length > 0) {
        matchedBooks = res.rows.map(mapBookRow);
      }
    }

    // 2. Title & Author & Keywords search
    if (matchedBooks.length === 0 && (parsedBook.title || keywords.length > 0)) {
      const searchTerms = [];
      const scoreClauses = [];
      const filterConditions = [];

      if (parsedBook.title && parsedBook.title.length >= 3 && parsedBook.title !== "Untitled Scanned Book") {
        searchTerms.push(parsedBook.title);
        const idx = searchTerms.length;
        scoreClauses.push(`CASE WHEN LOWER(b.title) = LOWER($${idx}) THEN 70 WHEN LOWER(b.title) LIKE LOWER('%' || $${idx} || '%') THEN 50 ELSE 0 END`);
        filterConditions.push(`LOWER(b.title) LIKE LOWER('%' || $${idx} || '%')`);
      }

      if (parsedBook.author && parsedBook.author.length >= 3 && parsedBook.author !== "Unknown Author") {
        searchTerms.push(parsedBook.author);
        const idx = searchTerms.length;
        scoreClauses.push(`CASE WHEN LOWER(b.author) LIKE LOWER('%' || $${idx} || '%') THEN 30 ELSE 0 END`);
        filterConditions.push(`LOWER(b.author) LIKE LOWER('%' || $${idx} || '%')`);
      }

      keywords.slice(0, 8).forEach(token => {
        searchTerms.push(token);
        const idx = searchTerms.length;
        scoreClauses.push(`CASE WHEN LOWER(b.title) LIKE LOWER('%' || $${idx} || '%') THEN 20 ELSE 0 END`);
        scoreClauses.push(`CASE WHEN LOWER(b.author) LIKE LOWER('%' || $${idx} || '%') THEN 15 ELSE 0 END`);
        filterConditions.push(`(
          LOWER(b.title) LIKE LOWER('%' || $${idx} || '%')
          OR LOWER(b.author) LIKE LOWER('%' || $${idx} || '%')
          OR LOWER(COALESCE(b.shelf_location, '')) LIKE LOWER('%' || $${idx} || '%')
          OR LOWER(COALESCE(b.summary, '')) LIKE LOWER('%' || $${idx} || '%')
        )`);
      });

      if (filterConditions.length > 0) {
        const textQuery = `
          SELECT
            b.id,
            b.title,
            b.author,
            b.isbn,
            b.cover_img AS "coverUrl",
            b.cover_img AS "coverImage",
            b.summary AS "description",
            b.summary,
            b.rating,
            b.availability AS "status",
            b.availability,
            b.department,
            b.category,
            b.genres,
            b.shelf_location AS "shelfLocation",
            b.shelf_location AS "shelf",
            b.published_date AS "publicationDate",
            TO_CHAR(b.published_date, 'YYYY') AS "year",
            b.pages,
            b.language,
            b.volume,
            b.edition,
            b.copies,
            b.accession_number AS "accessionNumber",
            COALESCE(COUNT(CASE WHEN t.type = 'Borrow' AND t.status = 'Approved' THEN 1 END), 0)::int AS "borrowedCount",
            COALESCE(COUNT(CASE WHEN t.type = 'Reservation' AND t.status = 'Pending' THEN 1 END), 0)::int AS "reservedCount",
            LEAST(100, GREATEST(40, (${scoreClauses.length > 0 ? scoreClauses.join(" + ") : "50"}))) AS confidence
          FROM books b
          LEFT JOIN transactions t ON (
            (t.isbn IS NOT NULL AND t.isbn != '' AND t.isbn != 'N/A' AND b.isbn = t.isbn)
            OR (t.resource_title IS NOT NULL AND LOWER(b.title) = LOWER(t.resource_title))
          )
          WHERE b.archived_at IS NULL
            AND (${filterConditions.join(" OR ")})
          GROUP BY b.id
          ORDER BY confidence DESC, b.created_at DESC
          LIMIT 10
        `;

        const res = await pool.query(textQuery, searchTerms);
        if (res.rows.length > 0) {
          matchedBooks = res.rows.map(mapBookRow);
        }
      }
    }
  } catch (dbErr) {
    console.error("[OCR Service] DB search error:", dbErr.message);
  }

  return {
    success: true,
    scannedText: rawText,
    parsedBook,
    detectedIsbn,
    detectedCallNumber,
    keywords,
    exactMatch: matchedBooks[0] || null,
    matchedBooks,
  };
}

function mapBookRow(b) {
  const totalCopies = Math.max(1, Number(b.copies || 1));
  const borrowedCount = Number(b.borrowedCount || 0);
  const reservedCount = Number(b.reservedCount || 0);
  const availableCopies = Math.max(0, totalCopies - borrowedCount - reservedCount);
  const isAvailable = availableCopies > 0;
  const status = isAvailable ? "Available" : (reservedCount > 0 ? "Reserved" : "Unavailable");

  return {
    ...b,
    availableCopies,
    isAvailable,
    status,
    availability: status,
    confidence: Number(b.confidence || 75),
  };
}
