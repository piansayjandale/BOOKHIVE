/**
 * Curated Unique Book Cover Image Resolver
 * Provides unique, high-resolution aesthetic book covers for all library books.
 */

// Specific high-resolution covers for well-known and system books
const KNOWN_BOOK_COVERS: Record<string, string> = {
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

// Curated library of 48 diverse, unique, high-resolution aesthetic book covers
const UNIQUE_COVER_POOL: string[] = [
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
    trimmed.startsWith("file://") ||
    trimmed.startsWith("content://") ||
    trimmed.startsWith("blob:")
  );
}

// In-memory runtime map of uploaded covers keyed by normalized title & ISBN
const uploadedCoverRegistry = new Map<string, string>();

export function registerUploadedBookCover(
  book: { id?: string; isbn?: string; title?: string; coverUri?: string | null }
) {
  const uri = book.coverUri?.trim();
  if (!uri || uri.length <= 5) return;
  if (book.id) uploadedCoverRegistry.set(`id:${String(book.id).trim().toLowerCase()}`, uri);
  if (book.isbn) uploadedCoverRegistry.set(`isbn:${String(book.isbn).trim().toLowerCase()}`, uri);
  if (book.title) uploadedCoverRegistry.set(`title:${String(book.title).trim().toLowerCase()}`, uri);
}

export function getRegisteredBookCover(
  book: { id?: string; isbn?: string; title?: string }
): string | null {
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
 * Deterministically generates a unique cover photo for any book.
 * If the book already has an uploaded or database cover, that is preserved.
 * Otherwise, resolves an exact or uniquely hashed aesthetic cover that syncs across Mobile and Web.
 */
export function getUniqueBookCover(
  bookOrTitle?:
    | string
    | {
        title?: string;
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
    title = bookOrTitle.title || "";
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

  // 1. If book already has an authentic valid image URL or uploaded cover, preserve it
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

  // 1b. Check in-memory uploaded cover registry (for books scanned/uploaded in current session)
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

  // 3. Deterministic hash mapping from normalized title (with author/isbn fallback)
  // Using normTitle as primary seed guarantees the exact same cover across all Mobile & Web screens
  const seedString = normTitle || `${author.trim().toLowerCase()}_${isbn.trim().toLowerCase()}_${bookId.trim().toLowerCase()}` || "bookhive_default";
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const poolIndex = Math.abs(hash) % UNIQUE_COVER_POOL.length;
  return UNIQUE_COVER_POOL[poolIndex];
}
