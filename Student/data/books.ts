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

const books: Book[] = booksCatalog.map((item) => ({
  isbn: item.isbn,
  title: item.title,
  author: item.author,
  department: item.department,
  description: item.summary,
  year: item.publicationDate,
  pages: 320, // fallback pages count
  available: item.availability === "Available",
}));

export default books;
