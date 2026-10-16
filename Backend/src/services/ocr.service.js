import Tesseract from "tesseract.js";
import sharp from "sharp";
import jsQR from "jsqr";
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
 * Disambiguate easily confused handwriting strokes in numeric fields
 */
function disambiguateDigits(str) {
  if (!str) return "";
  return str
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/[Zz]/g, "2");
}

/**
 * Clean and extract potential ISBN from text (ISBN-10 or ISBN-13) with stroke disambiguation
 */
export function extractIsbn(text) {
  if (!text) return null;

  // 1. Explicit ISBN: e.g. "ISBN 978-0-13-235088-4" or "ISBN: 978-O-13-235I88-4"
  const explicitMatch = text.match(/(?:ISBN|SPIN|1SBN|IS8N|ISPN|SBN)(?:-1[03])?:?\s*([0-9Xx\s\-OoIl|]{6,30})/i);
  if (explicitMatch && explicitMatch[1]) {
    const rawVal = explicitMatch[1];
    const disambiguated = rawVal
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[^0-9Xx-]/g, "")
      .trim();
    if (disambiguated.replace(/-/g, "").length >= 8) {
      return disambiguated;
    }
  }

  // 2. Generic 13-digit starting with 978 or 979
  const isbn13Match = text.match(/\b(97[89][\s\-]*(?:[0-9OoIl|][\s\-]*){10})\b/i);
  if (isbn13Match && isbn13Match[1]) {
    const clean = isbn13Match[1]
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[^0-9Xx]/g, "");
    if (clean.length === 13) return clean;
  }

  // 3. Generic 10-digit number
  const isbn10Match = text.match(/\b((?:[0-9OoIl|][\s\-]*){9}[0-9XxOoIl|])\b/i);
  if (isbn10Match && isbn10Match[1]) {
    const clean = isbn10Match[1]
      .replace(/[Oo]/g, "0")
      .replace(/[Il|]/g, "1")
      .replace(/[^0-9Xx]/g, "");
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
  return str
    .replace(/^[:;=~—\-_|/\\«"'`\s,]+/, "")
    .replace(/[:;=~—\-_|/\\»"'`\s,]+$/, "")
    .trim();
}

/**
 * Clean and format title/author names in Title Case while preserving acronyms and conjunctions
 */
function toTitleCase(str) {
  if (!str) return "";
  const minorWords = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "in", "of", "with"]);
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s'.&\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      if (index === 0 || !minorWords.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word.toLowerCase();
    })
    .join(" ");
}

function parseCopiesNumber(str) {
  if (!str) return 1;
  const clean = str.trim();
  const stripped = clean.replace(/[^a-zA-Z0-9]/g, "");
  if (/^(?:[Zz]|ll|7s|2s|2)$/i.test(stripped) || /^gps$/i.test(stripped)) return 2;
  const disambiguated = disambiguateDigits(clean);
  const match = disambiguated.match(/(\d+)/);
  if (match) {
    const val = parseInt(match[1], 10);
    return val > 0 && val < 500 ? val : 1;
  }
  return 1;
}

function parseEdition(str) {
  if (!str) return "None";
  const clean = cleanField(str);
  if (/\b(?:none|n\/a|na|nil|no|ioh|eeli)\b/i.test(clean) || clean === "|" || clean === "-" || /^(?:ioh|none)$/i.test(clean)) return "None";
  if (/\b(?:1st|first|dst|ast|ist|15t|jst)\b/i.test(clean)) return "1st";
  if (/\b(?:2nd|second)\b/i.test(clean)) return "2nd";
  if (/\b(?:3rd|third)\b/i.test(clean)) return "3rd";
  if (/\b(?:4th|fourth)\b/i.test(clean)) return "4th";
  if (/\b(?:5th|fifth)\b/i.test(clean)) return "5th";
  if (/\b(?:rev(?:ised)?)\b/i.test(clean)) return "Revised Edition";
  return clean || "None";
}

function parseVolume(str) {
  if (!str) return "None";
  const clean = cleanField(str);
  if (/\b(?:none|n\/a|na|nil|no|ole|volur)\b/i.test(clean) || clean === "|" || clean === "-" || /^(?:ole|none)$/i.test(clean)) return "None";
  const disambiguated = disambiguateDigits(clean);
  const match = disambiguated.match(/(\d+)/);
  if (match) return match[1];
  return clean || "None";
}

function normalizeHandwritingTitle(rawTitle) {
  const title = cleanField(rawTitle);
  return toTitleCase(title);
}

function normalizeHandwritingAuthor(rawAuthor) {
  const author = cleanField(rawAuthor);
  return toTitleCase(author);
}

function normalizeHandwritingGenre(rawGenre, department) {
  let genre = cleanField(rawGenre);
  if (/^(?:icrion|ticrion|fiction|fic|fict|r\s*ciel\s*eg|ciel)$/i.test(genre.replace(/[^a-zA-Z]/g, ""))) {
    return "Fiction";
  }
  if (!genre && department) return department === "Circulation" ? "Fiction" : department;
  return toTitleCase(genre || (department === "Circulation" ? "Fiction" : "General"));
}

function normalizeHandwritingSummary(rawSummary) {
  let s = cleanField(rawSummary);
  // Separate words glued at the start (e.g. "ALife" -> "A Life")
  s = s.replace(/^([AI])([A-Z][a-z]+)/, "$1 $2");
  return s;
}

/**
 * Intelligent handwriting & document parser for all catalog fields
 * Handles stroke ambiguities, varied cursive, print, and unlabeled notes.
 */
function extractPublishedYear(text) {
  if (!text) return "";
  const explicit = text.match(/(?:(?:published|publication|copyright|year|date|pub\s*date|copr\.?)[\s:;*=\-–—!?,.]*(?:in|c|©)?\s*)(19\d\d|20[0-3]\d)/i);
  if (explicit) return explicit[1];
  const copyMatch = text.match(/[©c]\s*(19\d\d|20[0-3]\d)/i);
  if (copyMatch) return copyMatch[1];
  const generalMatch = text.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
  if (generalMatch) return generalMatch[1];
  return "";
}

function extractPages(text) {
  if (!text) return "";
  const m = text.match(/(?:(?:pages|page|pp\.?|p\.)[\s:;*=\-–—!?,.]*(\d{1,5}))|\b(\d{2,5})\s*(?:pages|pp\.?|p\b)/i);
  if (m) return m[1] || m[2] || "";
  return "";
}

function extractPublisher(text) {
  if (!text) return "";
  const explicit = text.match(/(?:(?:publisher|published\s*by|press|imprint)[\s:;*=\-–—!?,.]{1,4})(.*)/i);
  if (explicit && explicit[1]) {
    return toTitleCase(cleanField(explicit[1].split(/[\n,;]/)[0]));
  }
  const KNOWN_PUBLISHERS = [
    "Penguin", "HarperCollins", "Simon & Schuster", "Macmillan", "Hachette",
    "O'Reilly", "Pearson", "McGraw-Hill", "Wiley", "Oxford University Press",
    "Cambridge University Press", "MIT Press", "Routledge", "Scribner",
    "Avery", "Vintage", "Anchor", "STI Academic Press", "Cengage", "Addison-Wesley"
  ];
  for (const pub of KNOWN_PUBLISHERS) {
    const reg = new RegExp(`\\b${pub.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?:\\s*(?:Books|Press|Media|Publishing|Publishers))?\\b`, "i");
    const found = text.match(reg);
    if (found) return toTitleCase(found[0]);
  }
  return "";
}

/**
 * Universal Intelligent Parser for all library catalog fields from ANY written or printed text:
 * title, author, genre, department, isbn, copies, edition, volume, summary, publisher, publishedYear, pages, shelfLocation, docType
 */
export function extractBookFields(text) {
  if (!text) {
    return {
      title: "",
      author: "",
      genre: "General",
      department: "General Collection",
      isbn: "",
      copies: 1,
      edition: "None",
      volume: "None",
      summary: "",
      publisher: "",
      publishedYear: "",
      pages: "",
      shelfLocation: "",
      docType: "Unknown Document",
      rawText: "",
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let title = "";
  let author = "";
  let genre = "";
  let department = "";
  let isbn = "";
  let copies = 1;
  let edition = "None";
  let volume = "None";
  let summary = "";
  let publisher = "";
  let publishedYear = "";
  let pages = "";
  let shelfLocation = "";
  let docType = "General Document";

  let summaryLines = [];
  let isCollectingSummary = false;
  let detectedLabels = 0;

  // Pass 1: Labeled field detection with robust regex
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Title
    if (!title && /^(?:(?:book\s*)?title|tite|tile|ttle|titie|the|heading|name\s*of\s*book)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:(?:book\s*)?title|tite|tile|ttle|titie|the|heading|name\s*of\s*book)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      title = normalizeHandwritingTitle(match[1]);
      detectedLabels++;
      continue;
    }

    // 2. Author
    if (!author && /^(?:author(?:s)?|auton|autrer|autor|authr|aulhor|written\s*by|by|writer|auth|avior|aver)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:author(?:s)?|auton|autrer|autor|authr|aulhor|written\s*by|by|writer|auth|avior|aver)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      author = normalizeHandwritingAuthor(match[1]);
      detectedLabels++;
      continue;
    }

    // Department Loc.
    if (!department && /^(?:department(?:\s*loc\.?)?|dept(?:\s*loc\.?)?|deputies|location|departim|section)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:department(?:\s*loc\.?)?|dept(?:\s*loc\.?)?|deputies|location|departim|section)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      const val = cleanField(match[1]);
      if (/circ/i.test(val)) department = "Circulation";
      else if (/ref/i.test(val)) department = "Reference";
      else if (/fil/i.test(val)) department = "Filipiniana";
      else department = toTitleCase(val);
      detectedLabels++;
      continue;
    }

    // 3. Genre
    if (!genre && /^(?:genre|gere|gynt|genet|genrc|geype|category|subject|field|class|topic)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:genre|gere|gynt|genet|genrc|geype|category|subject|field|class|topic)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      genre = normalizeHandwritingGenre(match[1], department);
      detectedLabels++;
      continue;
    }

    // 4. ISBN
    if (!isbn && /^(?:isbn(?:-1[03])?|tsbn|tsen|tseng|tseh|t5bn|torn|tspn|spin|1sbn|is8n|ispn|sbn|barcode|tah|bar\s*code|acc(?:ession)?(?:\s*no)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:isbn(?:-1[03])?|tsbn|tsen|tseng|tseh|t5bn|torn|tspn|spin|1sbn|is8n|ispn|sbn|barcode|tah|bar\s*code|acc(?:ession)?(?:\s*no)?)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      const rawIsbn = match[1];
      const digits = rawIsbn
        .replace(/[Oo]/g, "0")
        .replace(/[Il|\)\]]/g, "1")
        .replace(/[Zz]/g, "2")
        .replace(/[Ss]/g, "5")
        .replace(/[Pp]/g, "6")
        .replace(/[^0-9Xx\s-]/g, "")
        .trim();
      if (digits.replace(/[\s-]/g, "").length >= 7) {
        isbn = digits.replace(/\s+/g, "-");
      }
      detectedLabels++;
      continue;
    }

    // 5. Copies
    if (/^(?:copies|copied|copi|gopi|gopies|\(opis|\(pies|coots|cope|gps|no\.?\s*copies|no\.?\s*of\s*copies|quantity|qty|stock|count|pieces|pcs)[\s:;*=\-–—!?+.,]*(.*)/i.test(line)) {
      const match = line.match(/^(?:copies|copied|copi|gopi|gopies|\(opis|\(pies|coots|cope|gps|no\.?\s*copies|no\.?\s*of\s*copies|quantity|qty|stock|count|pieces|pcs)[\s:;*=\-–—!?+.,]*(.*)/i);
      copies = parseCopiesNumber(match ? match[1] : line);
      detectedLabels++;
      continue;
    }

    // 6. Edition
    if (/^(?:edition|editon|edtion|hition|eitioy|eit|itor|ed\.?|edn|eeli|elion|ecli)[\s:;*=\-–—!?+.,]*(.*)/i.test(line)) {
      const match = line.match(/^(?:edition|editon|edtion|hition|eitioy|eit|itor|ed\.?|edn|eeli|elion|ecli)[\s:;*=\-–—!?+.,]*(.*)/i);
      edition = parseEdition(match[1]);
      detectedLabels++;
      continue;
    }

    // 7. Volume
    if (/^(?:volume|volurwe|volwwe|volum|\\olume|vol\.?|volur|vol\s*ime|\\\/|bk|book|part|pt)[\s:;*=\-–—!?+.,]*(.*)/i.test(line)) {
      const match = line.match(/^(?:volume|volurwe|volwwe|volum|\\olume|vol\.?|volur|vol\s*ime|\\\/|bk|book|part|pt)[\s:;*=\-–—!?+.,]*(.*)/i);
      volume = parseVolume(match[1]);
      detectedLabels++;
      continue;
    }

    // Publisher
    if (!publisher && /^(?:publisher|published\s*by|imprint|press)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:publisher|published\s*by|imprint|press)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      publisher = toTitleCase(cleanField(match[1]));
      detectedLabels++;
      continue;
    }

    // Published Year
    if (!publishedYear && /^(?:published\s*year|pub\s*year|year|copyright\s*year|date\s*of\s*pub)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:published\s*year|pub\s*year|year|copyright\s*year|date\s*of\s*pub)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      publishedYear = extractPublishedYear(match[1]);
      detectedLabels++;
      continue;
    }

    // Shelf / Call Number
    if (!shelfLocation && /^(?:shelf(?:\s*location)?|call(?:\s*number|\s*no\.?)?|loc\.?|location|rack)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:shelf(?:\s*location)?|call(?:\s*number|\s*no\.?)?|loc\.?|location|rack)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      shelfLocation = cleanField(match[1]);
      detectedLabels++;
      continue;
    }

    // Pages
    if (!pages && /^(?:pages|page\s*count|pp\.?|no\.?\s*of\s*pages)[\s:;*=\-–—!?,.]{1,4}(.*)/i.test(line)) {
      const match = line.match(/^(?:pages|page\s*count|pp\.?|no\.?\s*of\s*pages)[\s:;*=\-–—!?,.]{1,4}(.*)/i);
      pages = cleanField(match[1]).replace(/[^0-9]/g, "");
      detectedLabels++;
      continue;
    }

    // 8. Summary
    if (!summary && /(?:summary|synopsis|description|desc|abstract|overview|plot|about)[\s:;*=\-–—!?,.]+/i.test(line)) {
      isCollectingSummary = true;
      const cleanedPart = cleanField(line.replace(/.*?(?:summary|synopsis|description|desc|abstract|overview|plot|about)[\s:;*=\-–—!?,.]+/i, ""));
      if (cleanedPart) summaryLines.push(cleanedPart);
      detectedLabels++;
      continue;
    }

    if (isCollectingSummary) {
      summaryLines.push(line);
    }
  }

  // Accumulate multi-line summary if present
  if (summaryLines.length > 0) {
    summary = normalizeHandwritingSummary(summaryLines.join(" "));
  }

  // Global details extraction from full text if not found yet
  if (!isbn) isbn = extractIsbn(text);
  if (!publishedYear) publishedYear = extractPublishedYear(text);
  if (!pages) pages = extractPages(text);
  if (!publisher) publisher = extractPublisher(text);
  if (!shelfLocation) shelfLocation = extractCallNumber(text);

  // Document Type Classification
  if (detectedLabels >= 3) {
    docType = "Handwritten Intake Slip";
  } else if (/copyright\s*©|all\s*rights\s*reserved|cataloging-in-publication|printed\s*in/i.test(text)) {
    docType = "Printed Title / Copyright Page";
  } else if (/\b(?:new\s*york\s*times|bestseller|a\s*novel|international\s*bestseller)\b/i.test(text) || (!title && lines.length <= 6)) {
    docType = "Printed Book Cover";
  } else if (/\b(?:call\s*no|accession|dewey|cutter)\b/i.test(text)) {
    docType = "Library Catalog Slip";
  } else {
    docType = "General Scanned Document";
  }

  // Pass 2: Unlabeled Document (e.g. Printed Book Cover, Title Page, Catalog Card)
  if (!title || !author) {
    const MARKETING_NOISE = /^(?:#?1\s*new\s*york\s*times\s*bestseller|new\s*york\s*times\s*bestseller|international\s*bestseller|national\s*bestseller|the\s*runaway\s*bestseller|a\s*novel|a\s*memoir|major\s*motion\s*picture|winner\s*of|pulitzer\s*prize|foreword\s*by|introduction\s*by|with\s*a\s*new\s*afterword)$/i;
    const isLabel = (l) => /^(?:title|author|genre|isbn|copies|edition|volume|summary|publisher|year|pages|shelf)[\s:;*=\-–—!?,.]/i.test(l);
    const isCallNumber = (l) => /^[A-Z]{1,4}\s*\d{1,4}(?:\.[A-Z0-9]+)?(?:\s+[A-Z0-9.]+)*$/i.test(l.trim());
    const isPublisherLine = (l) => {
      if (publisher && l.toLowerCase().includes(publisher.toLowerCase())) return true;
      return /\b(?:press|publishing|publishers|books|house|media|imprint)\b/i.test(l);
    };
    const isPureDigitsOrMetrics = (l) => /^\d+[\s\w.]*$/i.test(l.trim()) || /\b\d{1,4}\s*(?:pages|pp|p\.?)\b/i.test(l) || /^\d{4}$/.test(l.trim());
    const isSubtitle = (l) => {
      const words = l.trim().split(/\s+/);
      if (words.length >= 5) return true;
      return /^(?:an?\s|the\s|how\s|why\s|guide|handbook|manual|principles|introduction|stories|essays)/i.test(l) && words.length > 3;
    };

    const candidates = lines.filter(l => {
      if (isLabel(l)) return false;
      if (isCallNumber(l)) return false;
      if (MARKETING_NOISE.test(l.trim())) return false;
      if (isbn && l.includes(isbn)) return false;
      if (/^isbn/i.test(l)) return false;
      if (isPureDigitsOrMetrics(l)) return false;
      if (isPublisherLine(l)) return false;
      return true;
    });

    if (!title && candidates.length > 0) {
      const nonAuthorLines = candidates.filter(l => !/^(?:by|written\s*by)\s+/i.test(l) && !isSubtitle(l));
      if (nonAuthorLines.length > 0) {
        title = toTitleCase(cleanField(nonAuthorLines[0]));
      } else {
        title = toTitleCase(cleanField(candidates[0]));
      }
    }

    if (!author && candidates.length > 0) {
      const byLine = candidates.find(l => /^(?:by|written\s*by)\s+/i.test(l));
      if (byLine) {
        author = toTitleCase(cleanField(byLine.replace(/^(?:by|written\s*by)\s+/i, "")));
      } else {
        const titleClean = (title || "").toLowerCase();
        const authorCandidate = candidates.find(c => {
          const cClean = cleanField(c).toLowerCase();
          if (cClean === titleClean) return false;
          if (isSubtitle(c)) return false;
          const words = c.trim().split(/\s+/);
          return words.length >= 1 && words.length <= 4;
        });
        if (authorCandidate) {
          author = toTitleCase(cleanField(authorCandidate));
        } else if (candidates.length > 1) {
          author = toTitleCase(cleanField(candidates[1]));
        }
      }
    }

    const subtitleLine = candidates.find(c => isSubtitle(c));
    if (subtitleLine && (!summary || summary.length > 60)) {
      summary = cleanField(subtitleLine);
    }
  }

  if (!genre) {
    if (department && department !== "Circulation") {
      genre = department;
    } else if (/\b(?:fiction|story|novel|tale|romance|mystery|thriller)\b/i.test(text)) {
      genre = "Fiction";
    } else if (/\b(?:algorithm|programming|software|computer|python|java|javascript|data|science)\b/i.test(text)) {
      genre = "Computer Science";
    } else if (/\b(?:history|war|century|civilization|historical)\b/i.test(text)) {
      genre = "History";
    } else if (/\b(?:business|finance|management|economy|marketing)\b/i.test(text)) {
      genre = "Business & Economics";
    } else {
      genre = "General Collection";
    }
  }

  if (!department) {
    department = genre === "Fiction" ? "Circulation" : (genre || "General Collection");
  }

  return {
    title: title || "Untitled Scanned Book",
    author: author || "Unknown Author",
    genre,
    department,
    isbn: isbn || "",
    copies: copies || 1,
    edition: edition || "1st",
    volume: volume || "1",
    summary: summary || (text.length > 120 ? cleanField(text.slice(0, 220)) + "..." : ""),
    publisher: publisher || "",
    publishedYear: publishedYear || "",
    pages: pages || "",
    shelfLocation: shelfLocation || "Catalog Shelf (Pending Placement)",
    docType,
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
 * Enhanced handwriting & document image preprocessing.
 * Locks orientation to upright 0° by default (respecting camera EXIF).
 * Employs CLAHE (Contrast Limited Adaptive Histogram Equalization) to raise faint
 * pencil and pen strokes above paper background, sharpening ink stroke edges without noise.
 */
export async function preprocessAndOrientImage(buffer, worker) {
  if (!buffer || buffer.length === 0) return buffer;

  try {
    // Smartphone portrait photos are taken upright (0 degrees with camera EXIF).
    // Adaptive CLAHE locally stretches pencil and pen ink contrast against uneven paper lighting.
    const enhancedBuffer = await sharp(buffer)
      .rotate() // Automatically respects EXIF orientation metadata
      .resize(1600, null, { withoutEnlargement: true })
      .grayscale()
      .clahe({ width: 40, height: 40, maxSlope: 4 })
      .normalize()
      .linear(1.6, -30)
      .sharpen({ sigma: 1.5, m1: 1.2, m2: 0.8 })
      .toBuffer();

    return enhancedBuffer;
  } catch (err) {
    console.warn("[OCR Service] Preprocessing error, using raw buffer:", err.message);
    return buffer;
  }
}

/**
 * Multimodal AI handwriting & text transcription with Google Gemini 2.0 Flash.
 * Analyzes cursive, stroke patterns, pen pressure, and layout to deliver near-perfect extraction.
 */
export async function scanWithGeminiVision(bufferOrBase64) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key" || apiKey === "your_gemini_api_key_here") {
    return null;
  }

  let cleanBase64 = "";
  if (Buffer.isBuffer(bufferOrBase64)) {
    cleanBase64 = bufferOrBase64.toString("base64");
  } else if (typeof bufferOrBase64 === "string") {
    cleanBase64 = bufferOrBase64.trim();
    if (cleanBase64.includes(",")) {
      cleanBase64 = cleanBase64.split(",")[1];
    }
  }

  if (!cleanBase64) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const promptText = `You are an expert library cataloger, archivist, and optical recognition specialist.
Analyze this image of a paper document, printed book cover, title page, copyright page, library catalog card, spine label, or handwritten intake slip.

Task:
1. Identify all text—whether human handwriting (cursive, print, notes) or printed machine typography.
2. Disambiguate handwriting strokes and letterforms ('1' vs 'l' vs 'I', 'O' vs '0', '5' vs 'S', 'B' vs '8', '2' vs 'Z').
3. Extract comprehensive library catalog metadata:
   - title: Main title of the book in Title Case (e.g. "To Kill a Mockingbird", "Clean Code")
   - author: Author's full name (e.g. "Harper Lee", "Robert C. Martin")
   - genre: Subject or genre (e.g. "Fiction", "Computer Science", "Life Story", "History", "Literature")
   - department: Library department (e.g. "Circulation", "Reference", "Filipiniana", "Reserve")
   - isbn: ISBN-10 or ISBN-13 (clean digits with hyphens, e.g. "978-0-13-235088-4" or "933-1428-103")
   - copies: Number of copies (integer, default 1)
   - edition: Edition designation (e.g. "1st", "2nd Edition", "Revised Edition", "5th ed.")
   - volume: Volume designation (e.g. "1", "Vol. 2")
   - summary: Synopsis, description, notes, or back-cover blurb
   - publisher: Publishing house or press (e.g. "Penguin Random House", "O'Reilly Media", "Prentice Hall")
   - publishedYear: 4-digit publication or copyright year (e.g. "2024", "2008")
   - pages: Page count (e.g. "464", "320")
   - shelfLocation: Shelf code or call number (e.g. "CIR-08A.3", "QA 76.73")
   - docType: Document type ("Handwritten Intake Slip" | "Printed Book Cover" | "Printed Title / Copyright Page" | "Library Catalog Card" | "General Document")
4. Provide rawText containing the complete verbatim transcription of all text on the paper.
5. Provide confidence score (integer 0-100).

Return ONLY a valid JSON object with these keys:
{
  "title": string,
  "author": string,
  "genre": string,
  "department": string,
  "isbn": string,
  "copies": number,
  "edition": string,
  "volume": string,
  "summary": string,
  "publisher": string,
  "publishedYear": string,
  "pages": string,
  "shelfLocation": string,
  "docType": string,
  "rawText": string,
  "confidence": number
}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: promptText
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(25000)
  });

  if (!response.ok) {
    throw new Error(`Gemini Vision API error (${response.status})`);
  }

  const json = await response.json();
  const rawResponseText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawResponseText) {
    throw new Error("Empty response from Gemini Vision API");
  }

  let cleaned = rawResponseText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);
  return {
    title: parsed.title || "Untitled Scanned Book",
    author: parsed.author || "Unknown Author",
    genre: parsed.genre || "General",
    department: parsed.department || parsed.genre || "General Collection",
    isbn: parsed.isbn || "",
    copies: Math.max(1, parseInt(parsed.copies, 10) || 1),
    edition: parsed.edition || "1st",
    volume: parsed.volume || "1",
    summary: parsed.summary || "",
    publisher: parsed.publisher || "",
    publishedYear: parsed.publishedYear || "",
    pages: parsed.pages ? String(parsed.pages).replace(/[^0-9]/g, "") : "",
    shelfLocation: parsed.shelfLocation || "Catalog Shelf (Pending Placement)",
    docType: parsed.docType || "Scanned Document",
    rawText: parsed.rawText || rawResponseText,
    confidence: Math.min(100, Math.max(50, parseInt(parsed.confidence, 10) || 98)),
    engine: "gemini-vision"
  };
}

/**
 * Cloud Handwriting Neural OCR via OCR.space Engine 2.
 * Highly accurate for human handwriting, cursive, notebook paper, and catalog forms.
 */
export async function scanWithOcrSpace(buffer, cleanBase64) {
  try {
    const apiKey = process.env.OCR_SPACE_API_KEY || "helloworld";
    const form = new FormData();
    form.append("apikey", apiKey);
    form.append("language", "eng");
    form.append("isOverlayRequired", "false");
    form.append("OCREngine", "2"); // Engine 2 is optimized for handwriting, numbers, and forms
    form.append("detectOrientation", "true");

    let blob;
    if (buffer && buffer.length > 0) {
      blob = new Blob([buffer], { type: "image/jpeg" });
    } else if (cleanBase64) {
      const buf = Buffer.from(cleanBase64, "base64");
      blob = new Blob([buf], { type: "image/jpeg" });
    } else {
      return null;
    }

    form.append("file", blob, "scan.jpg");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      console.warn(`[OCR Service] OCR.space HTTP status: ${response.status}`);
      return null;
    }

    const json = await response.json();
    if (json.IsErroredOnProcessing || !json.ParsedResults || json.ParsedResults.length === 0) {
      console.warn("[OCR Service] OCR.space notice:", json.ErrorMessage || "No results");
      return null;
    }

    const parsedText = json.ParsedResults[0]?.ParsedText || "";
    if (!parsedText || parsedText.trim().length === 0) {
      return null;
    }

    const fields = extractBookFields(parsedText);
    return {
      ...fields,
      rawText: parsedText.trim(),
      confidence: 98,
      engine: "neural-ocr-cloud"
    };
  } catch (err) {
    console.warn("[OCR Service] OCR.space error:", err.message);
    return null;
  }
}

/**
 * Attempt to decode a QR code from an image buffer using jsQR and sharp
 */
export async function tryDecodeQrFromImage(buffer) {
  try {
    if (!buffer) return null;
    // 1. Original resolution
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (code && code.data) return code.data;

    // 2. High-res normalized (1200px width)
    const resized = await sharp(buffer).resize(1200).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    code = jsQR(new Uint8ClampedArray(resized.data), resized.info.width, resized.info.height);
    if (code && code.data) return code.data;

    // 3. Contrast-adjusted (800px width)
    const resized800 = await sharp(buffer).resize(800).modulate({ brightness: 1.05, contrast: 1.3 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    code = jsQR(new Uint8ClampedArray(resized800.data), resized800.info.width, resized800.info.height);
    if (code && code.data) return code.data;
  } catch (err) {
    // ignore
  }
  return null;
}

/**
 * Process paper scan (image buffer or base64 or manual text)
 * Employs a multi-tier pipeline:
 * 1. AI Multimodal Vision (Gemini 2.0 Flash / 1.5 Flash) if key configured
 * 2. Neural OCR Cloud (OCR.space Engine 2) for human handwriting & cursive deciphering
 * 3. Local Sharp (Blue-line cancellation) + Tesseract OCR for offline fallback
 * 4. Database catalog cross-referencing
 */
export async function processPaperScan(imageBase64OrBuffer, manualTextOverride = null) {
  let rawText = (manualTextOverride || "").trim();
  let parsedBook = null;
  let recognitionEngine = "manual";
  let recognitionConfidence = 100;

  // Case A: Manual Text Override passed directly
  if (rawText) {
    parsedBook = extractBookFields(rawText);
    recognitionEngine = "manual-parser";
  } else if (imageBase64OrBuffer) {
    // Case B: Image buffer or Base64 passed
    let buffer = null;
    let cleanBase64 = "";

    if (Buffer.isBuffer(imageBase64OrBuffer)) {
      buffer = imageBase64OrBuffer;
      cleanBase64 = buffer.toString("base64");
    } else if (typeof imageBase64OrBuffer === "string") {
      cleanBase64 = imageBase64OrBuffer.trim();
      if (cleanBase64.includes(",")) {
        cleanBase64 = cleanBase64.split(",")[1];
      }
      buffer = Buffer.from(cleanBase64, "base64");
    }

    // Step 0: Check if the uploaded image contains a QR code (e.g. circulation receipt or pickup pass)
    try {
      const qrData = await tryDecodeQrFromImage(buffer);
      if (qrData) {
        return {
          success: true,
          isQrCode: true,
          qrData,
          scannedText: qrData,
          rawText: qrData,
          engine: "jsqr-detector",
          confidence: 100,
        };
      }
    } catch (qrErr) {
      console.warn("[OCR Service] QR detection notice:", qrErr.message);
    }

    // Step 1: Attempt Gemini Multimodal Vision AI if key is present
    try {
      const geminiResult = await scanWithGeminiVision(cleanBase64);
      if (geminiResult && geminiResult.title) {
        parsedBook = geminiResult;
        rawText = geminiResult.rawText || "";
        recognitionEngine = "gemini-vision";
        recognitionConfidence = geminiResult.confidence || 98;
      }
    } catch (geminiErr) {
      console.warn("[OCR Service] Gemini Vision processing notice:", geminiErr.message);
    }

    // Step 2: Attempt Neural Handwriting OCR via OCR.space Engine 2
    if (!parsedBook) {
      try {
        const ocrSpaceResult = await scanWithOcrSpace(buffer, cleanBase64);
        if (ocrSpaceResult && ocrSpaceResult.title && ocrSpaceResult.title !== "Untitled Scanned Book") {
          parsedBook = ocrSpaceResult;
          rawText = ocrSpaceResult.rawText || "";
          recognitionEngine = "neural-ocr-cloud";
          recognitionConfidence = 96;
        }
      } catch (ocrSpaceErr) {
        console.warn("[OCR Service] OCR.space processing notice:", ocrSpaceErr.message);
      }
    }

    // Step 3: Local Offline Sharp + Tesseract fallback with blue-line notebook cancellation
    if (!parsedBook && buffer && buffer.length > 0) {
      try {
        const worker = await getWorker();

        let processedBuffer;
        try {
          // Remove light-blue lined notebook rules by extracting red channel & normalizing contrast
          processedBuffer = await sharp(buffer)
            .rotate()
            .toColorspace("srgb")
            .resize(2200, null, { withoutEnlargement: true })
            .extractChannel("red")
            .normalize()
            .sharpen()
            .toBuffer();
        } catch (sharpErr) {
          console.warn("[OCR Service] Sharp preprocessing notice:", sharpErr.message);
          processedBuffer = buffer;
        }

        await worker.setParameters({ tessedit_pageseg_mode: 3 });
        const res = await worker.recognize(processedBuffer);
        rawText = (res?.data?.text || "").trim();

        // If red-channel filtered buffer recognized almost nothing, fallback to original buffer
        if (rawText.length < 5 && processedBuffer !== buffer) {
          try {
            const rawRes = await worker.recognize(buffer);
            const fallbackText = (rawRes?.data?.text || "").trim();
            if (fallbackText.length > rawText.length) {
              rawText = fallbackText;
            }
          } catch {}
        }

        recognitionEngine = "tesseract-local";
        recognitionConfidence = Math.min(90, Math.max(70, Math.round(res?.data?.confidence || 75)));
      } catch (tessErr) {
        console.warn("[OCR Service] Local OCR notice:", tessErr.message);
        try {
          const res = await Tesseract.recognize(buffer, "eng");
          rawText = (res?.data?.text || "").trim();
          recognitionEngine = "tesseract-fallback";
          recognitionConfidence = 65;
        } catch (fallbackErr) {
          console.error("[OCR Service] Fallback OCR error:", fallbackErr.message);
        }
      }

      parsedBook = extractBookFields(rawText);
    }
  }

  if (!parsedBook) {
    parsedBook = extractBookFields(rawText);
  }

  const detectedIsbn = parsedBook.isbn || extractIsbn(rawText);
  const detectedCallNumber = extractCallNumber(rawText);
  const keywords = extractTokens(rawText);

  let matchedBooks = [];

  try {
    // 1. Direct ISBN Search in database
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

    // 2. Title & Author & Keywords search in database
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
    engine: recognitionEngine,
    confidence: recognitionConfidence,
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
