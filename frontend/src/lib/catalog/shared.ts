import type { BookAvailability, BookRecord, Department } from "@/lib/types";
import { slugify } from "@/lib/utils";

export interface CatalogBookInput {
  id: string;
  source?: string;
  sourceBookId?: string;
  title: string;
  author: string;
  isbn: string;
  publicationDate: string;
  department: Department;
  shelfLocation: string;
  summary: string;
  series?: string;
  genres?: string;
  language?: string;
  publisher?: string;
  pages?: number;
  rating?: number;
  numRatings?: number;
  likedPercent?: number;
  coverImg?: string;
  bbeScore?: number;
  bbeVotes?: number;
  borrowCount?: number;
  availability?: BookAvailability;
  aiScore?: number;
}

const departmentKeywordMap: Record<Department, string[]> = {
  "Computer Science": [
    "computer",
    "software",
    "programming",
    "algorithm",
    "data",
    "ai",
    "machine learning",
    "cyber",
    "network",
    "cloud",
    "code",
    "developer",
  ],
  Engineering: [
    "engineering",
    "electrical",
    "mechanical",
    "structural",
    "civil",
    "circuit",
    "thermodynamics",
    "robotics",
    "material",
    "renewable",
    "energy",
    "design",
  ],
  Education: [
    "education",
    "teaching",
    "learning",
    "curriculum",
    "classroom",
    "assessment",
    "pedagogy",
    "instruction",
    "teacher",
    "inclusive",
    "student learning",
  ],
  "Business & Accountancy": [
    "business",
    "accounting",
    "finance",
    "marketing",
    "entrepreneur",
    "managerial",
    "economics",
    "audit",
    "corporate",
    "management",
    "startup",
  ],
  "Arts & Sciences": [
    "literature",
    "history",
    "research",
    "social",
    "science",
    "philosophy",
    "psychology",
    "arts",
    "culture",
    "humanities",
    "sociology",
  ],
};

const stopwords = new Set([
  "a",
  "about",
  "across",
  "after",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "book",
  "books",
  "by",
  "can",
  "describe",
  "find",
  "for",
  "from",
  "how",
  "i",
  "in",
  "into",
  "is",
  "it",
  "library",
  "me",
  "need",
  "of",
  "on",
  "or",
  "please",
  "prompt",
  "recommend",
  "related",
  "show",
  "something",
  "that",
  "the",
  "to",
  "with",
]);

const departmentShelfPrefix: Record<Department, string> = {
  "Computer Science": "CS",
  Engineering: "ENG",
  Education: "EDU",
  "Business & Accountancy": "BUS",
  "Arts & Sciences": "ART",
};

function normalizeText(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function matchesKeyword(normalizedText: string, tokenSet: Set<string>, keyword: string) {
  const normalizedKeyword = keyword.toLowerCase();

  if (normalizedKeyword.includes(" ")) {
    return normalizedText.includes(normalizedKeyword);
  }

  if (normalizedKeyword.length <= 2) {
    return tokenSet.has(normalizedKeyword);
  }

  if (tokenSet.has(normalizedKeyword)) {
    return true;
  }

  return Array.from(tokenSet).some((token) => token.startsWith(normalizedKeyword));
}

function hashValue(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash << 5) - hash + character.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function parseNumber(value: string | number | undefined | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = normalizeText(value).replace(/[^0-9.\-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveInteger(value: string | number | undefined | null) {
  return Math.max(0, Math.round(parseNumber(value)));
}

function normalizeDate(value: string | undefined | null) {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }

  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, "$1").replace(/,/g, "");
  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString().slice(0, 10);
  }

  const year = cleaned.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  if (year) {
    return `${year[1]}-01-01`;
  }

  return "";
}

function normalizeIsbn(value: string | undefined | null, fallback: string) {
  const normalized = normalizeText(value).replace(/[^0-9Xx]/g, "").toUpperCase();
  if (normalized.length === 10 || normalized.length === 13) {
    return normalized;
  }

  return fallback;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function deriveDepartment(text: string) {
  const normalized = normalizeText(text).toLowerCase();
  const tokenSet = new Set(tokenize(text));
  let winningDepartment: Department = "Arts & Sciences";
  let winningScore = 0;

  for (const [department, keywords] of Object.entries(departmentKeywordMap) as Array<
    [Department, string[]]
  >) {
    const score = keywords.reduce((total, keyword) => {
      if (!matchesKeyword(normalized, tokenSet, keyword)) {
        return total;
      }

      return total + (keyword.includes(" ") ? 4 : 2);
    }, 0);

    if (score > winningScore) {
      winningDepartment = department;
      winningScore = score;
    }
  }

  return winningDepartment;
}

export function createShelfLocation(department: Department, seed: string | number) {
  const hash = typeof seed === "number" ? seed : hashValue(String(seed));
  const aisle = String((hash % 24) + 1).padStart(2, "0");
  const slot = String((Math.floor(hash / 24) % 18) + 1).padStart(2, "0");
  return `${departmentShelfPrefix[department]}-${aisle}-${slot}`;
}

export function deriveAvailability(
  seed: string,
  numRatings: number,
  bbeVotes: number,
): BookAvailability {
  const demandScore = Math.log10(numRatings + 10) + Math.log10(bbeVotes + 10);
  const hash = hashValue(seed) % 10;

  if (demandScore > 7.2 || hash === 0) {
    return "Reserved";
  }

  if (demandScore > 6.2 || hash <= 3) {
    return "Limited";
  }

  return "Available";
}

export function deriveBorrowCount(numRatings: number, bbeVotes: number) {
  const weighted = Math.log10(numRatings + 10) * 26 + Math.log10(bbeVotes + 10) * 34;
  return Math.max(12, Math.round(weighted));
}

export function deriveAiScore(
  rating: number,
  likedPercent: number,
  bbeScore: number,
  summary: string,
  genres: string,
) {
  const ratingScore = clamp(rating * 12, 0, 52);
  const likedScore = clamp(likedPercent * 0.24, 0, 24);
  const popularityScore = clamp(Math.log10(bbeScore + 10) * 7, 0, 12);
  const metadataScore = (summary ? 6 : 0) + (genres ? 5 : 0);

  return clamp(Math.round(ratingScore + likedScore + popularityScore + metadataScore), 62, 99);
}

export function extractSearchTokens(text: string, limit = 16) {
  const tokens = normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) {
        return false;
      }

      if (/^\d{10,13}$/.test(token)) {
        return true;
      }

      return token.length > 2 && !stopwords.has(token);
    });

  return Array.from(new Set(tokens)).slice(0, limit);
}

export function inferDepartmentsFromQuery(query: string) {
  const normalized = normalizeText(query).toLowerCase();
  const tokenSet = new Set(tokenize(query));
  return (Object.entries(departmentKeywordMap) as Array<[Department, string[]]>)
    .filter(([, keywords]) => keywords.some((keyword) => matchesKeyword(normalized, tokenSet, keyword)))
    .map(([department]) => department);
}

export function buildFtsQuery(tokens: string[]) {
  const sanitizedTokens = tokens
    .map((token) => token.replace(/"/g, '""'))
    .filter(Boolean)
    .slice(0, 12);

  if (sanitizedTokens.length === 0) {
    return "";
  }

  return sanitizedTokens.map((token) => `"${token}"*`).join(" OR ");
}

export function previewSummary(text: string) {
  const summary = normalizeText(text);
  if (summary.length <= 260) {
    return summary;
  }

  return `${summary.slice(0, 257)}...`;
}

export function toCatalogBookRecord(
  row: CatalogBookInput & {
    availability: BookAvailability;
    aiScore: number;
    borrowCount: number;
  },
): BookRecord {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    publicationDate: row.publicationDate,
    department: row.department,
    shelfLocation: row.shelfLocation,
    summary: row.summary,
    borrowCount: row.borrowCount,
    availability: row.availability,
    aiScore: row.aiScore,
    genres: row.genres,
    language: row.language,
    publisher: row.publisher,
    rating: row.rating,
    coverImg: row.coverImg,
    source: row.source,
  };
}

export function transformGoodreadsRow(
  row: Record<string, string>,
  index: number,
): CatalogBookInput {
  const title = normalizeText(row.title) || `Untitled Book ${index}`;
  const author = normalizeText(row.author) || "Unknown Author";
  const description = previewSummary(normalizeText(row.description));
  const genres = normalizeText(row.genres);
  const publicationDate =
    normalizeDate(row.publishDate) || normalizeDate(row.firstPublishDate) || "";
  const numericRatings = parsePositiveInteger(row.numRatings);
  const votes = parsePositiveInteger(row.bbeVotes);
  const rating = parseNumber(row.rating);
  const likedPercent = parseNumber(row.likedPercent);
  const bbeScore = parsePositiveInteger(row.bbeScore);
  const department = deriveDepartment(`${title} ${genres} ${description}`);
  const sourceBookId = normalizeText(row.bookId) || String(index);
  const generatedId = `gr-${slugify(sourceBookId || `${title}-${author}`) || "book"}-${index}`;
  const isbn = normalizeIsbn(row.isbn, `NOISBN-${sourceBookId}`);
  const borrowCount = deriveBorrowCount(numericRatings, votes);
  const availability = deriveAvailability(generatedId, numericRatings, votes);
  const aiScore = deriveAiScore(rating, likedPercent, bbeScore, description, genres);

  return {
    id: generatedId,
    source: "goodreads-best-books",
    sourceBookId,
    title,
    author,
    isbn,
    publicationDate,
    department,
    shelfLocation: createShelfLocation(department, sourceBookId),
    summary: description || "No description available.",
    series: normalizeText(row.series),
    genres,
    language: normalizeText(row.language),
    publisher: normalizeText(row.publisher),
    pages: parsePositiveInteger(row.pages),
    rating,
    numRatings: numericRatings,
    likedPercent,
    coverImg: normalizeText(row.coverImg),
    bbeScore,
    bbeVotes: votes,
    borrowCount,
    availability,
    aiScore,
  };
}
