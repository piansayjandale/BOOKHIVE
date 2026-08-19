import booksCatalog from "./imports/books.catalog.json";

export type Book = {
  isbn: string;
  title: string;
  author: string;
  department: string;
  description?: string;
  year?: string | number;
  pages?: string | number;
  available?: boolean;
};

let liveBooksCatalog: Book[] = booksCatalog.map((item) => ({
  isbn: item.isbn,
  title: item.title,
  author: item.author,
  department: item.department,
  description: item.summary,
  year: item.publicationDate,
  pages: 320,
  available: item.availability === "Available",
}));

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
    isbn: newBook.isbn || `LIVE-${Date.now().toString().slice(-6)}`,
    title: newBook.title || "New Library Record",
    author: newBook.author || "Technical Section",
    department: newBook.department || "Technical Section",
    description: newBook.description || newBook.summary || "Recently added to STI Library collection.",
    year: newBook.year || newBook.publicationDate || new Date().getFullYear().toString(),
    pages: newBook.pages || 320,
    available: newBook.available !== false && newBook.availability !== "Unavailable",
  };

  // Prepend new book item to catalog feed
  liveBooksCatalog = [formattedBook, ...liveBooksCatalog];
  notifyCatalogListeners();
  return formattedBook;
};

export const getLiveBooks = (): Book[] => liveBooksCatalog;

export default liveBooksCatalog;

