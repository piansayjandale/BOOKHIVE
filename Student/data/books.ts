import booksCatalog from "./imports/books.catalog.json";

export type Book = {
  id?: string;
  isbn: string;
  title: string;
  author: string;
  department: string;
  description?: string;
  summary?: string;
  year?: string | number;
  publicationDate?: string;
  pages?: string | number;
  available?: boolean;
  status?: string;
  shelf?: string;
  shelf_location?: string;
  shelfLocation?: string;
  copies?: number | string;
  availableCopies?: number;
  confidence?: number;
  genre?: string;
  category?: string;
  edition?: string;
  volume?: string;
  accession_number?: string;
  accessionNumber?: string;
  cover_img?: string;
  coverUrl?: string;
  rating?: number | string;
};

let liveBooksCatalog: Book[] = (booksCatalog as any[]).map((item, idx) => ({
  id: item.id || item.isbn || `cat-book-${idx}`,
  isbn: item.isbn || "",
  title: item.title || "Untitled Book",
  author: item.author || "Unknown Author",
  department: item.department || "Circulation Section",
  category: item.category || item.department || "General",
  genre: item.category || item.department || "General",
  description: item.summary || item.description || "Library catalog resource.",
  summary: item.summary || item.description || "Library catalog resource.",
  year: item.publicationDate ? String(item.publicationDate).slice(0, 4) : "2024",
  publicationDate: item.publicationDate || "2024-01-01",
  pages: item.pages || 320,
  available: item.availability === "Available" || item.availability !== false,
  status: item.availability || "Available",
  shelf: item.shelfLocation || item.shelf || "CIR-01A.1",
  shelf_location: item.shelfLocation || item.shelf || "CIR-01A.1",
  shelfLocation: item.shelfLocation || item.shelf || "CIR-01A.1",
  copies: item.copies !== undefined ? Number(item.copies) : 1,
  availableCopies: item.copies !== undefined ? Number(item.copies) : 1,
  rating: item.rating || 4.5,
}));

// Fast title prefix bucket index for 48,000+ books
let prefixIndex: Map<string, Book[]> | null = null;

export const getPrefixIndex = (): Map<string, Book[]> => {
  if (!prefixIndex) {
    prefixIndex = new Map<string, Book[]>();
    for (let i = 0; i < liveBooksCatalog.length; i++) {
      const b = liveBooksCatalog[i];
      const titleLower = (b.title || "").toLowerCase().trim();
      const noArticle = titleLower.replace(/^(the|a|an)\s+/i, "");
      const cleanPrimary = titleLower.replace(/[^a-z0-9]/g, "");
      const cleanNoArticle = noArticle.replace(/[^a-z0-9]/g, "");

      const primaryChar = cleanPrimary[0] || titleLower[0] || "#";
      if (!prefixIndex.has(primaryChar)) prefixIndex.set(primaryChar, []);
      prefixIndex.get(primaryChar)!.push(b);

      const altChar = cleanNoArticle[0] || noArticle[0];
      if (altChar && altChar !== primaryChar) {
        if (!prefixIndex.has(altChar)) prefixIndex.set(altChar, []);
        prefixIndex.get(altChar)!.push(b);
      }
    }
  }
  return prefixIndex;
};

/**
 * Searches the 48,000+ local books by title prefix instantly (in 1-2 ms)
 */
export const searchBooksByPrefix = (prefix: string, limit = 200): Book[] => {
  if (!prefix) return [];
  const normalizedQuery = prefix.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cleanQuery = normalizedQuery.replace(/[^a-z0-9]/g, "");
  const searchQ = cleanQuery.length > 0 ? cleanQuery : normalizedQuery;
  const firstChar = searchQ[0];
  if (!firstChar) return [];

  const index = getPrefixIndex();
  const candidates = index.get(firstChar) || [];
  const results: Book[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const book = candidates[i];
    const normTitle = (book.title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const cleanTitle = normTitle.replace(/[^a-z0-9]/g, "");
    const titleNoArt = normTitle.replace(/^(the|a|an)\s+/i, "").replace(/[^a-z0-9]/g, "");

    if (cleanTitle.startsWith(searchQ) || (titleNoArt.length > 0 && titleNoArt.startsWith(searchQ))) {
      results.push(book);
      if (results.length >= limit) break;
    }
  }

  return results;
};

const STOP_WORDS_SET = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at", 
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "did", "do", 
  "does", "doing", "don", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have", 
  "having", "he", "her", "here", "hers", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", 
  "its", "itself", "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", 
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", 
  "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they", 
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "were", "what", "when", 
  "where", "which", "while", "who", "whom", "why", "with", "you", "your", "yours", "yourself", "yourselves",
  "find", "me", "book", "books", "show", "search", "get", "read", "want", "please", "library", "recommend"
]);

/**
 * Searches the 48,000+ local books by keyword tokens across title, author, category, and summary
 */
export const searchBooksByKeyword = (query: string, limit = 100): Book[] => {
  if (!query) return [];
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS_SET.has(w));
  if (words.length === 0) return [];

  const results: Book[] = [];
  for (let i = 0; i < liveBooksCatalog.length; i++) {
    const b = liveBooksCatalog[i];
    const text = `${b.title} ${b.author} ${b.category || ""} ${b.department} ${b.summary || ""}`.toLowerCase();
    let matchesAll = true;
    for (const w of words) {
      if (!text.includes(w)) {
        matchesAll = false;
        break;
      }
    }
    if (matchesAll) {
      results.push(b);
      if (results.length >= limit) break;
    }
  }

  if (results.length < 10) {
    const existing = new Set(results.map((r) => r.isbn));
    for (let i = 0; i < liveBooksCatalog.length; i++) {
      const b = liveBooksCatalog[i];
      if (existing.has(b.isbn)) continue;
      const text = `${b.title} ${b.author} ${b.category || ""}`.toLowerCase();
      let matchCount = 0;
      for (const w of words) {
        if (text.includes(w)) matchCount++;
      }
      if (matchCount > 0) {
        results.push(b);
        if (results.length >= limit) break;
      }
    }
  }

  return results;
};

/**
 * Filters the 48,000+ local books by library department
 */
export const getBooksByDepartment = (department: string, limit = 100): Book[] => {
  if (!department) return [];
  const deptLower = department.toLowerCase().trim();
  const results: Book[] = [];
  for (let i = 0; i < liveBooksCatalog.length; i++) {
    const b = liveBooksCatalog[i];
    if (
      (b.department || "").toLowerCase().includes(deptLower) ||
      deptLower.includes((b.department || "").toLowerCase())
    ) {
      results.push(b);
      if (results.length >= limit) break;
    }
  }
  return results;
};

const catalogListeners = new Set<() => void>();

export const subscribeToBookCatalog = (listener: () => void) => {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
};

const notifyCatalogListeners = () => {
  catalogListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("Catalog listener error:", e);
    }
  });
};

export const addDynamicBook = (newBook: any) => {
  const formattedBook: Book = {
    id: newBook.id || newBook.isbn || `LIVE-${Date.now().toString().slice(-6)}`,
    isbn: newBook.isbn || `LIVE-${Date.now().toString().slice(-6)}`,
    title: newBook.title || "New Library Record",
    author: newBook.author || "Technical Section",
    department: newBook.department || newBook.genre || "General Collection",
    genre: newBook.genre || newBook.department || "General",
    category: newBook.category || newBook.genre || "General",
    description: newBook.description || newBook.summary || "Recently added to STI Library collection.",
    summary: newBook.summary || newBook.description || "Recently added to STI Library collection.",
    edition: newBook.edition || "1st",
    volume: newBook.volume || "1",
    copies: newBook.copies || 1,
    availableCopies: Number(newBook.copies || 1),
    shelf: newBook.shelf || newBook.shelf_location || "CIR-General",
    shelf_location: newBook.shelf_location || newBook.shelf || "CIR-General",
    shelfLocation: newBook.shelfLocation || newBook.shelf || "CIR-General",
    year: newBook.year || newBook.publicationDate || new Date().getFullYear().toString(),
    publicationDate: newBook.publicationDate || new Date().toISOString().split("T")[0],
    pages: newBook.pages || 320,
    available: newBook.available !== false && newBook.availability !== "Unavailable",
    status: newBook.status || "Available",
    rating: newBook.rating || 4.5,
  };

  // Prepend new book item to catalog feed & invalidate prefix index
  prefixIndex = null;
  liveBooksCatalog = [formattedBook, ...liveBooksCatalog];
  notifyCatalogListeners();
  return formattedBook;
};

export const getLiveBooks = (): Book[] => liveBooksCatalog;

export default liveBooksCatalog;
