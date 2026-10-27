/**
 * Curated Unique Book Cover Image Resolver (Web & Mobile Synced)
 * Provides unique, high-resolution aesthetic book covers for all library books
 * and preserves custom cover photos uploaded via the Librarian Mobile Scanner.
 */

export const KNOWN_BOOK_COVERS: Record<string, string> = {
  "wayward son": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
  "his life": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
  "dale": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
  "letters home from the crimes": "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80",
  "the survivors club": "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=80",
  "diana: a princess for the world": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
  "the sartorialist": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
  "ibong adarna": "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80",
  "yana brich daily life": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
  "brichoox gaming experience": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
  "charmed": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
  "gio": "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80",
  "imperial life in the emerald city": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
  "the culture of sensibility": "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80",
};

export const UNIQUE_COVER_POOL: string[] = [
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1507842229458-57790b9b399d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1513475382585-d06e58bcb0d0?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1510172951991-856a654063f9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1474366521946-c3d4b507abf2?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1528747045269-390fe33c19f2?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1529148482759-b35b2825750f?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1516972810927-80185027ca84?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1535905557558-afc4849a66d9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1495640388908-05fa85288e61?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1463320726281-696a485928c7?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1492052722242-2554d0e99e3a?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1519791883288-dc8bd696e667?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&fit=crop&w=600&q=80",
];

const COVER_URI_TAG_REGEX = /\[\[BOOKHIVE_COVER_URI:([\s\S]+?)\]\]/;
const STORAGE_KEY = "BOOKHIVE_UPLOADED_COVERS_V1";

// Runtime memory cache for uploaded covers
const uploadedCoverRegistry = new Map<string, string>();
let storageHydrated = false;

function hydrateFromStorage() {
  if (storageHydrated || typeof window === "undefined") return;
  storageHydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "string" && v.length > 5) {
            uploadedCoverRegistry.set(k, v);
          }
        }
      }
    }
  } catch {
    // ignore storage errors
  }
}

function persistToStorage() {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, string> = {};
    // Keep most recent 60 entries to stay well within localStorage quota
    const entries = Array.from(uploadedCoverRegistry.entries()).slice(-60);
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

export function embedCoverUriInRawText(rawText?: string | null, coverUri?: string | null): string {
  const cleanText = stripEmbeddedCoverUri(rawText);
  if (!coverUri || !coverUri.trim()) return cleanText;
  return cleanText
    ? `${cleanText}\n[[BOOKHIVE_COVER_URI:${coverUri.trim()}]]`
    : `[[BOOKHIVE_COVER_URI:${coverUri.trim()}]]`;
}

export function extractEmbeddedCoverUri(rawText?: string | null): string | null {
  if (!rawText || typeof rawText !== "string") return null;
  const match = rawText.match(COVER_URI_TAG_REGEX);
  return match && match[1] ? match[1].trim() : null;
}

export function stripEmbeddedCoverUri(rawText?: string | null): string {
  if (!rawText || typeof rawText !== "string") return "";
  return rawText.replace(/\n*\[\[BOOKHIVE_COVER_URI:[\s\S]+?\]\]/g, "").trim();
}

export function isCustomUploadedCover(uri?: string | null): boolean {
  if (!uri || typeof uri !== "string") return false;
  const trimmed = uri.trim();
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("file://")
  );
}

export function registerUploadedBookCover(book: {
  id?: string | null;
  isbn?: string | null;
  title?: string | null;
  coverUri?: string | null;
}) {
  hydrateFromStorage();
  const uri = book.coverUri?.trim();
  if (!uri || uri.length <= 5 || uri.includes("null") || uri.includes("undefined")) return;

  let changed = false;
  if (book.id) {
    const key = `id:${String(book.id).trim().toLowerCase()}`;
    if (uploadedCoverRegistry.get(key) !== uri) {
      uploadedCoverRegistry.set(key, uri);
      changed = true;
    }
  }
  if (book.isbn) {
    const key = `isbn:${String(book.isbn).trim().toLowerCase()}`;
    if (uploadedCoverRegistry.get(key) !== uri) {
      uploadedCoverRegistry.set(key, uri);
      changed = true;
    }
  }
  if (book.title) {
    const key = `title:${String(book.title).trim().toLowerCase()}`;
    if (uploadedCoverRegistry.get(key) !== uri) {
      uploadedCoverRegistry.set(key, uri);
      changed = true;
    }
  }
  if (changed) {
    persistToStorage();
  }
}

export function getRegisteredBookCover(book: {
  id?: string | null;
  isbn?: string | null;
  title?: string | null;
}): string | null {
  hydrateFromStorage();
  if (book.id) {
    const byId = uploadedCoverRegistry.get(`id:${String(book.id).trim().toLowerCase()}`);
    if (byId) return byId;
  }
  if (book.isbn) {
    const byIsbn = uploadedCoverRegistry.get(`isbn:${String(book.isbn).trim().toLowerCase()}`);
    if (byIsbn) return byIsbn;
  }
  if (book.title) {
    const byTitle = uploadedCoverRegistry.get(`title:${String(book.title).trim().toLowerCase()}`);
    if (byTitle) return byTitle;
  }
  return null;
}

/**
 * Deterministically resolves the unique cover photo for any book.
 * Syncs 100% with Student Mobile & Librarian Mobile (`Student/data/bookCovers.ts`).
 */
export function getUniqueBookCover(
  bookOrTitle?:
    | string
    | {
        title?: string;
        resourceTitle?: string;
        author?: string;
        isbn?: string;
        coverImage?: string | null;
        coverUrl?: string | null;
        coverImg?: string | null;
        cover_img?: string | null;
        rawText?: string | null;
        raw_text?: string | null;
        id?: string;
        category?: string;
      },
  authorParam?: string,
  isbnParam?: string
): string {
  let title = "";
  let author = authorParam || "";
  let isbn = isbnParam || "";
  let existingCover: string | null = null;
  let bookId = "";

  if (typeof bookOrTitle === "object" && bookOrTitle !== null) {
    title = bookOrTitle.title || bookOrTitle.resourceTitle || "";
    author = bookOrTitle.author || author;
    isbn = bookOrTitle.isbn || isbn;
    bookId = bookOrTitle.id || "";
    existingCover =
      bookOrTitle.coverImage ||
      bookOrTitle.coverUrl ||
      bookOrTitle.coverImg ||
      bookOrTitle.cover_img ||
      extractEmbeddedCoverUri(bookOrTitle.rawText || bookOrTitle.raw_text) ||
      null;
  } else if (typeof bookOrTitle === "string") {
    title = bookOrTitle;
  }

  // 1. If book already has an uploaded cover or valid image URL, preserve & register it
  if (
    existingCover &&
    existingCover.trim().length > 5 &&
    !existingCover.includes("null") &&
    !existingCover.includes("undefined")
  ) {
    const cleanCover = existingCover.trim();
    registerUploadedBookCover({ id: bookId, isbn, title, coverUri: cleanCover });
    return cleanCover;
  }

  // 1b. Check uploaded cover registry (for covers uploaded via Librarian Mobile or Web)
  const registered = getRegisteredBookCover({ id: bookId, isbn, title });
  if (registered) {
    return registered;
  }

  // 2. Normalize title for known titles dictionary
  const normTitle = title.trim().toLowerCase();
  if (normTitle.length > 0) {
    for (const [knownKey, coverUrl] of Object.entries(KNOWN_BOOK_COVERS)) {
      if (normTitle === knownKey || normTitle.includes(knownKey) || knownKey.includes(normTitle)) {
        return coverUrl;
      }
    }
  }

  // 3. Deterministic hash mapping from normalized title (matches Mobile 100%)
  const seedString =
    normTitle ||
    `${author.trim().toLowerCase()}_${isbn.trim().toLowerCase()}_${bookId.trim().toLowerCase()}` ||
    "bookhive_default";
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const poolIndex = Math.abs(hash) % UNIQUE_COVER_POOL.length;
  return UNIQUE_COVER_POOL[poolIndex];
}

export function getGenreTheme(category?: string, title?: string, isDarkMode = true) {
  const norm = ((category || "") + " " + (title || "")).toLowerCase();

  if (norm.includes("fiction") || norm.includes("novel") || norm.includes("literature") || norm.includes("story")) {
    return {
      bg: isDarkMode ? "#0F172A" : "#1E293B",
      accent: "#FCD34D",
      authorColor: "#FEF08A",
      ribbon: "#EF4444",
      tag: "FICTION",
      stamp: "BOOKHIVE FICTION",
    };
  }
  if (norm.includes("filipiniana") || norm.includes("history") || norm.includes("philippine") || norm.includes("adarna")) {
    return {
      bg: isDarkMode ? "#451A03" : "#7C2D12",
      accent: "#FBBF24",
      authorColor: "#FEF08A",
      ribbon: "#2563EB",
      tag: "FILIPINIANA",
      stamp: "HERITAGE EDITION",
    };
  }
  if (norm.includes("special") || norm.includes("archive") || norm.includes("rare") || norm.includes("gaming") || norm.includes("brichoox")) {
    return {
      bg: isDarkMode ? "#3B0764" : "#581C87",
      accent: "#F0ABFC",
      authorColor: "#F5D0FE",
      ribbon: "#EC4899",
      tag: "SPECIAL",
      stamp: "SPECIAL COLLECTION",
    };
  }
  if (norm.includes("reference") || norm.includes("encyclopedia") || norm.includes("dictionary") || norm.includes("academic") || norm.includes("study")) {
    return {
      bg: isDarkMode ? "#0C2340" : "#1E3A8A",
      accent: "#38BDF8",
      authorColor: "#E0F2FE",
      ribbon: "#F59E0B",
      tag: "REFERENCE",
      stamp: "ACADEMIC REFERENCE",
    };
  }
  if (norm.includes("account") || norm.includes("finance") || norm.includes("business") || norm.includes("economic")) {
    return {
      bg: isDarkMode ? "#064E3B" : "#065F46",
      accent: "#6EE7B7",
      authorColor: "#D1FAE5",
      ribbon: "#10B981",
      tag: "BUSINESS",
      stamp: "BUSINESS & FINANCE",
    };
  }
  if (norm.includes("tech") || norm.includes("computer") || norm.includes("code") || norm.includes("program") || norm.includes("matrix") || norm.includes("dale")) {
    return {
      bg: isDarkMode ? "#091E2F" : "#0F2942",
      accent: "#22D3EE",
      authorColor: "#CFFAFE",
      ribbon: "#6366F1",
      tag: "TECHNOLOGY",
      stamp: "DIGITAL EDITION",
    };
  }

  return {
    bg: isDarkMode ? "#0E1E38" : "#1E3050",
    accent: "#FCD34D",
    authorColor: "#FEF08A",
    ribbon: "#EAB308",
    tag: "CIRCULATION",
    stamp: "BOOKHIVE EDITIONS",
  };
}

export function cleanAuthorName(authorStr?: string): string {
  if (!authorStr || !authorStr.trim()) return "by STI Library";
  let cleaned = authorStr
    .replace(/\s*\([^)]*Goodreads[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Author[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Illustrator[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Editor[^)]*\)/gi, "")
    .replace(/\s*\([^)]*Translator[^)]*\)/gi, "")
    .trim();

  if (cleaned.includes(",")) {
    cleaned = cleaned.split(",")[0].trim();
  }
  if (cleaned.includes(";")) {
    cleaned = cleaned.split(";")[0].trim();
  }
  if (!cleaned) return "by STI Library";

  if (cleaned.toLowerCase().startsWith("by ")) {
    return cleaned;
  }
  return `by ${cleaned}`;
}
