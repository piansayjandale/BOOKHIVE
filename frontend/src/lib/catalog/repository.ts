import type { Pool } from "pg";

import { getCatalogDb } from "@/lib/catalog/db";
import { readCatalogImportSnapshot } from "@/lib/catalog/import-snapshot";
import {
  CatalogBookInput,
  createShelfLocation,
  deriveAiScore,
  deriveAvailability,
  deriveBorrowCount,
  extractSearchTokens,
  inferDepartmentsFromQuery,
  previewSummary,
  toCatalogBookRecord,
} from "@/lib/catalog/shared";
import { seedBooks } from "@/lib/data/seed";
import { hasExplicitDatabaseUrl } from "@/lib/db";
import type { BookRecord, Department, SearchResult } from "@/lib/types";

type BookRow = {
  catalog_id: number;
  id: string;
  source: string;
  source_book_id: string | null;
  title: string;
  author: string;
  isbn: string;
  publication_date: string;
  department: Department;
  shelf_location: string;
  summary: string;
  series: string;
  genres: string;
  language: string;
  publisher: string;
  pages: number;
  rating: number;
  num_ratings: number;
  liked_percent: number;
  cover_img: string;
  bbe_score: number;
  bbe_votes: number;
  borrow_count: number;
  availability: BookRecord["availability"];
  ai_score: number;
};

function mapBookRow(row: BookRow): BookRecord {
  return toCatalogBookRecord({
    id: row.id,
    source: row.source,
    sourceBookId: row.source_book_id ?? undefined,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    publicationDate: row.publication_date,
    department: row.department,
    shelfLocation: row.shelf_location,
    summary: row.summary,
    series: row.series,
    genres: row.genres,
    language: row.language,
    publisher: row.publisher,
    pages: row.pages,
    rating: row.rating,
    numRatings: row.num_ratings,
    likedPercent: row.liked_percent,
    coverImg: row.cover_img,
    bbeScore: row.bbe_score,
    bbeVotes: row.bbe_votes,
    borrowCount: row.borrow_count,
    availability: row.availability,
    aiScore: row.ai_score,
  });
}

function exactIncludes(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function createInsertedBookInput(
  input: Omit<BookRecord, "id" | "borrowCount" | "aiScore">,
): CatalogBookInput {
  const timestampSeed = `${Date.now()}-${input.title}-${input.author}`;
  const borrowCount = deriveBorrowCount(500, 80);
  const aiScore = deriveAiScore(4.2, 88, 9000, input.summary, input.genres ?? "");

  return {
    id: `manual-${timestampSeed.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    source: "bookhive-manual",
    sourceBookId: "",
    title: input.title.trim(),
    author: input.author.trim(),
    isbn: input.isbn.trim(),
    publicationDate: input.publicationDate,
    department: input.department,
    shelfLocation: input.shelfLocation || createShelfLocation(input.department, timestampSeed),
    summary: previewSummary(input.summary),
    genres: input.genres ?? "",
    language: input.language ?? "English",
    publisher: input.publisher ?? "",
    rating: input.rating ?? 4.2,
    numRatings: 500,
    likedPercent: 88,
    bbeScore: 9000,
    bbeVotes: 80,
    borrowCount,
    availability: input.availability ?? deriveAvailability(timestampSeed, 500, 80),
    aiScore,
    coverImg: input.coverImg ?? "",
  };
}

async function insertBookRow(database: Pool, book: CatalogBookInput) {
  const result = await database.query(insertBookSql, [
    book.id,
    book.source ?? "bookhive",
    book.sourceBookId ?? "",
    book.title,
    book.author,
    book.isbn,
    book.publicationDate,
    book.department,
    book.shelfLocation,
    book.summary,
    book.series ?? "",
    book.genres ?? "",
    book.language,
    book.publisher ?? "",
    book.pages ?? 0,
    book.rating ?? 0,
    book.numRatings ?? 0,
    book.likedPercent ?? 0,
    book.coverImg ?? "",
    book.bbeScore ?? 0,
    book.bbeVotes ?? 0,
    book.borrowCount ?? 0,
    book.availability ?? "Available",
    book.aiScore ?? 70,
    new Date().toISOString(),
    new Date().toISOString(),
  ]);
  return result.rows[0] as BookRow;
}

let curatedSeedLoaded = false;

function toCuratedSeedInput(book: BookRecord): CatalogBookInput {
  return {
    id: book.id,
    source: "bookhive-curated",
    sourceBookId: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publicationDate: book.publicationDate,
    department: book.department,
    shelfLocation: book.shelfLocation,
    summary: previewSummary(book.summary),
    genres: book.genres ?? "",
    language: book.language ?? "English",
    publisher: book.publisher ?? "STI WNU Library",
    rating: book.rating ?? Number((book.aiScore / 22).toFixed(2)),
    coverImg: book.coverImg ?? "",
    bbeScore: 0,
    bbeVotes: 0,
    numRatings: 0,
    likedPercent: 0,
    borrowCount: book.borrowCount,
    availability: book.availability,
    aiScore: book.aiScore,
  };
}

async function ensureCuratedSeedBooks() {
  if (!hasExplicitDatabaseUrl) {
    return;
  }

  if (curatedSeedLoaded) {
    return;
  }

  const database = await getCatalogDb();
  const existing = await database.query<{ total: string }>(
    "SELECT COUNT(*) as total FROM books WHERE source = $1",
    ["bookhive-curated"],
  );

  if (parseInt(existing.rows[0].total, 10) > 0) {
    curatedSeedLoaded = true;
    return;
  }

  for (const seedBook of seedBooks) {
    await insertBookRow(database, toCuratedSeedInput(seedBook));
  }

  curatedSeedLoaded = true;
}

const insertBookSql = `
  INSERT INTO books (
    id,
    source,
    source_book_id,
    title,
    author,
    isbn,
    publication_date,
    department,
    shelf_location,
    summary,
    series,
    genres,
    language,
    publisher,
    pages,
    rating,
    num_ratings,
    liked_percent,
    cover_img,
    bbe_score,
    bbe_votes,
    borrow_count,
    availability,
    ai_score,
    created_at,
    updated_at
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
`;

function getSeedCatalogBooks() {
  const importedBooks = readCatalogImportSnapshot();
  if (importedBooks.length === 0) {
    return seedBooks.slice();
  }

  const dedupedBooks = new Map<string, BookRecord>();

  for (const book of importedBooks) {
    dedupedBooks.set(book.id, book);
  }

  for (const book of seedBooks) {
    if (!dedupedBooks.has(book.id)) {
      dedupedBooks.set(book.id, book);
    }
  }

  return Array.from(dedupedBooks.values());
}

function sortCatalogBooks(left: BookRecord, right: BookRecord) {
  return right.borrowCount - left.borrowCount || left.title.localeCompare(right.title);
}

function listSeedCatalogBooks(options: {
  search?: string;
  department?: string;
  limit?: number;
  offset?: number;
}) {
  const search = options.search?.trim().toLowerCase() ?? "";
  const department = options.department ?? "All";
  const limit = options.limit ?? 120;
  const offset = options.offset ?? 0;

  const filtered = getSeedCatalogBooks()
    .filter((book) => department === "All" || book.department === department)
    .filter((book) => {
      if (!search) {
        return true;
      }

      return `${book.title} ${book.author} ${book.isbn} ${book.summary} ${book.genres ?? ""}`
        .toLowerCase()
        .includes(search);
    })
    .sort(sortCatalogBooks);

  return {
    total: filtered.length,
    books: filtered.slice(offset, offset + limit),
  };
}

function searchSeedCatalogBooks(options: {
  query: string;
  department?: string;
  uploadedContext?: string;
  uploadedFileNames?: string[];
  limit?: number;
}) {
  const limit = options.limit ?? 6;
  const department = options.department ?? "All";
  const combinedContext = [options.query, options.uploadedContext].filter(Boolean).join(" ");
  const tokens = extractSearchTokens(combinedContext, 18);

  if (tokens.length === 0) {
    return [] satisfies SearchResult[];
  }

  const queryValue = options.query.trim().toLowerCase();
  const inferredDepartments = inferDepartmentsFromQuery(combinedContext);
  const uploadedTokens = extractSearchTokens(options.uploadedContext ?? "", 10);
  const uploadedDescriptors = (options.uploadedFileNames ?? []).map((name) => name.toLowerCase());

  return getSeedCatalogBooks()
    .filter((book) => department === "All" || book.department === department)
    .filter((book) => {
      if (!queryValue) {
        return true;
      }

      const haystack = `${book.title} ${book.author} ${book.isbn} ${book.summary} ${book.genres ?? ""}`
        .toLowerCase();

      if (haystack.includes(queryValue)) {
        return true;
      }

      return tokens.some((token) => haystack.includes(token));
    })
    .sort(sortCatalogBooks)
    .map((book, index) => {
      const matchedBy = new Set<string>(["semantic"]);
      let relevance = Math.max(24, 82 - index * 2);
      const haystack =
        `${book.title} ${book.author} ${book.summary} ${book.genres ?? ""} ${book.publisher ?? ""}`.toLowerCase();

      if (queryValue && exactIncludes(book.title, queryValue)) {
        relevance += 24;
        matchedBy.add("title");
      }

      if (queryValue && exactIncludes(book.author, queryValue)) {
        relevance += 18;
        matchedBy.add("author");
      }

      if (queryValue && book.isbn.toLowerCase() === queryValue.replace(/[^0-9x]/g, "")) {
        relevance += 34;
        matchedBy.add("isbn");
      } else if (tokens.some((token) => book.isbn.toLowerCase().includes(token))) {
        relevance += 20;
        matchedBy.add("isbn");
      }

      const titleTokenMatches = tokens.filter((token) => book.title.toLowerCase().includes(token)).length;
      if (titleTokenMatches > 0) {
        relevance += titleTokenMatches * 6;
        matchedBy.add("title");
      }

      const authorTokenMatches = tokens.filter((token) => book.author.toLowerCase().includes(token)).length;
      if (authorTokenMatches > 0) {
        relevance += authorTokenMatches * 4;
        matchedBy.add("author");
      }

      const summaryTokenMatches = tokens.filter((token) => haystack.includes(token)).length;
      if (summaryTokenMatches > 0) {
        relevance += Math.min(summaryTokenMatches * 3, 18);
        matchedBy.add("summary");
      }

      if (department !== "All" && book.department === department) {
        relevance += 8;
        matchedBy.add("department");
      } else if (inferredDepartments.includes(book.department)) {
        relevance += 10;
        matchedBy.add("department");
      }

      if (
        uploadedTokens.some((token) => haystack.includes(token)) ||
        uploadedDescriptors.some((name) => haystack.includes(name.replace(/\.[a-z0-9]+$/i, "")))
      ) {
        relevance += 8;
        matchedBy.add("file context");
      }

      relevance += Math.round(book.aiScore / 14);

      return {
        id: book.id,
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        department: book.department,
        availability: book.availability,
        relevance: Math.min(99, relevance),
        summary: book.summary,
        matchedBy: Array.from(matchedBy),
        genres: book.genres,
        language: book.language,
        rating: book.rating,
        coverImg: book.coverImg,
      } satisfies SearchResult;
    })
    .filter((result) => result.relevance >= 48)
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, limit);
}

function getSeedDepartmentDistribution() {
  const counts = new Map<Department, number>();

  for (const book of getSeedCatalogBooks()) {
    counts.set(book.department, (counts.get(book.department) ?? 0) + 1);
  }

  const totalBooks = getSeedCatalogBooks().length || 1;

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([department, count]) => ({
      department,
      usage: Math.round((count / totalBooks) * 100),
    }));
}

export const catalogRepository = {
  async getBookById(id: string) {
    if (!hasExplicitDatabaseUrl) {
      return getSeedCatalogBooks().find((book) => book.id === id) ?? null;
    }

    try {
      await ensureCuratedSeedBooks();
      const database = await getCatalogDb();
      const result = await database.query<BookRow>("SELECT * FROM books WHERE id = $1", [id]);
      const row = result.rows[0];
      return row ? mapBookRow(row) : null;
    } catch (error) {
      console.error("Catalog getBookById failed:", error);
      return getSeedCatalogBooks().find((book) => book.id === id) ?? null;
    }
  },

  async countBooks() {
    if (!hasExplicitDatabaseUrl) {
      return getSeedCatalogBooks().length;
    }

    try {
      await ensureCuratedSeedBooks();
      const database = await getCatalogDb();
      const result = await database.query<{ total: string }>("SELECT COUNT(*) as total FROM books");
      return parseInt(result.rows[0].total, 10) ?? 0;
    } catch (error) {
      console.error("Catalog countBooks failed:", error);
      return getSeedCatalogBooks().length;
    }
  },

  async listBooks(options: {
    search?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!hasExplicitDatabaseUrl) {
      return listSeedCatalogBooks(options);
    }

    try {
      await ensureCuratedSeedBooks();
      const database = await getCatalogDb();
      const search = options.search?.trim() ?? "";
      const department = options.department ?? "All";
      const limit = options.limit ?? 120;
      const offset = options.offset ?? 0;

      if (!search) {
        const filters: unknown[] = [];
        const whereClause = department === "All" ? "" : "WHERE department = $1";
        if (department !== "All") {
          filters.push(department);
        }

        const total = await database.query<{ total: string }>(
          `SELECT COUNT(*) as total FROM books ${whereClause}`,
          filters,
        );
        const rows = await database.query<BookRow>(
          `SELECT * FROM books ${whereClause} ORDER BY borrow_count DESC, title ASC LIMIT $${filters.length + 1} OFFSET $${filters.length + 2}`,
          [...filters, limit, offset],
        );

        return {
          total: parseInt(total.rows[0]?.total ?? "0", 10),
          books: rows.rows.map(mapBookRow),
        };
      }

    const likeSearch = `%${search.toLowerCase()}%`;
    const totalFilters: unknown[] = [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch];
    const listFilters: unknown[] = [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch];
    let departmentClause = "";

    if (department !== "All") {
      departmentClause = "AND department = $6";
      totalFilters.push(department);
      listFilters.push(department);
    }

    const total = await database.query<{ total: string }>(
      `
        SELECT COUNT(*) as total
        FROM books
        WHERE (
          lower(title) LIKE $1
          OR lower(author) LIKE $2
          OR lower(isbn) LIKE $3
          OR lower(summary) LIKE $4
          OR lower(genres) LIKE $5
        )
        ${departmentClause}
      `,
      totalFilters,
    );

    const rows = await database.query<BookRow>(
      `
        SELECT *
        FROM books
        WHERE (
          lower(title) LIKE $1
          OR lower(author) LIKE $2
          OR lower(isbn) LIKE $3
          OR lower(summary) LIKE $4
          OR lower(genres) LIKE $5
        )
        ${departmentClause}
        ORDER BY borrow_count DESC, title ASC
        LIMIT $${listFilters.length + 1} OFFSET $${listFilters.length + 2}
      `,
      [...listFilters, limit, offset],
    );

    return {
      total: parseInt(total.rows[0]?.total ?? "0", 10),
      books: rows.rows.map(mapBookRow),
    };
  } catch (error) {
    console.error("Catalog listBooks failed:", error);
    return listSeedCatalogBooks(options);
  }
  },

  async searchBooks(options: {
    query: string;
    department?: string;
    uploadedContext?: string;
    uploadedFileNames?: string[];
    limit?: number;
  }) {
    if (!hasExplicitDatabaseUrl) {
      return searchSeedCatalogBooks(options);
    }

    try {
      await ensureCuratedSeedBooks();
      const database = await getCatalogDb();
      const limit = options.limit ?? 6;
      const combinedContext = [options.query, options.uploadedContext].filter(Boolean).join(" ");
      const tokens = extractSearchTokens(combinedContext, 18);
      const department = options.department ?? "All";

      if (tokens.length === 0) {
        return [] satisfies SearchResult[];
      }

      const queryValue = options.query.trim().toLowerCase();
      const searchTerm = `%${queryValue}%`;
      const inferredDepartments = inferDepartmentsFromQuery(combinedContext);
      const uploadedTokens = extractSearchTokens(options.uploadedContext ?? "", 10);
      const uploadedDescriptors = (options.uploadedFileNames ?? []).map((name) => name.toLowerCase());
      const tokenPatterns = tokens.map((token) => `%${token}%`);

      const queryClauses = [
        `(
          lower(title) LIKE $1 OR
          lower(author) LIKE $1 OR
          lower(isbn) LIKE $1 OR
          lower(summary) LIKE $1 OR
          lower(genres) LIKE $1
        )`,
      ];

      if (tokenPatterns.length > 0) {
        queryClauses.push(`(
          lower(title) LIKE ANY($2) OR
          lower(author) LIKE ANY($2) OR
          lower(isbn) LIKE ANY($2) OR
          lower(summary) LIKE ANY($2) OR
          lower(genres) LIKE ANY($2)
        )`);
      }

      let departmentClause = "";
      const queryParams: unknown[] = [searchTerm];

      if (tokenPatterns.length > 0) {
        queryParams.push(tokenPatterns);
      }

      if (department !== "All") {
        departmentClause = `AND department = $${queryParams.length + 1}`;
        queryParams.push(department);
      }

      const results = await database.query<BookRow>(
        `
          SELECT *
          FROM books
          WHERE (
            ${queryClauses.join(" OR \n          ")}
          )
          ${departmentClause}
          ORDER BY borrow_count DESC, title ASC
          LIMIT $${queryParams.length + 1}
        `,
        [...queryParams, limit],
      );

      const rows = results.rows;

      return rows
        .map((row, index) => {
          const matchedBy = new Set<string>(["semantic"]);
          let relevance = Math.max(24, 82 - index * 2);
          const haystack = `${row.title} ${row.author} ${row.summary} ${row.genres} ${row.publisher}`.toLowerCase();

          if (queryValue && exactIncludes(row.title, queryValue)) {
            relevance += 24;
            matchedBy.add("title");
          }

          if (queryValue && exactIncludes(row.author, queryValue)) {
            relevance += 18;
            matchedBy.add("author");
          }

          if (queryValue && row.isbn.toLowerCase() === queryValue.replace(/[^0-9x]/g, "")) {
            relevance += 34;
            matchedBy.add("isbn");
          } else if (tokens.some((token) => row.isbn.toLowerCase().includes(token))) {
            relevance += 20;
            matchedBy.add("isbn");
          }

          const titleTokenMatches = tokens.filter((token) => row.title.toLowerCase().includes(token)).length;
          if (titleTokenMatches > 0) {
            relevance += titleTokenMatches * 6;
            matchedBy.add("title");
          }

          const authorTokenMatches = tokens.filter((token) => row.author.toLowerCase().includes(token)).length;
          if (authorTokenMatches > 0) {
            relevance += authorTokenMatches * 4;
            matchedBy.add("author");
          }

          const summaryTokenMatches = tokens.filter((token) => haystack.includes(token)).length;
          if (summaryTokenMatches > 0) {
            relevance += Math.min(summaryTokenMatches * 3, 18);
            matchedBy.add("summary");
          }

          if (department !== "All" && row.department === department) {
            relevance += 8;
            matchedBy.add("department");
          } else if (inferredDepartments.includes(row.department)) {
            relevance += 10;
            matchedBy.add("department");
          }

          if (
            uploadedTokens.some((token) => haystack.includes(token)) ||
            uploadedDescriptors.some((name) => haystack.includes(name.replace(/\.[a-z0-9]+$/i, "")))
          ) {
            relevance += 8;
            matchedBy.add("file context");
          }

          relevance += Math.round(row.ai_score / 14);

          return {
            id: row.id,
            title: row.title,
            author: row.author,
            isbn: row.isbn,
            department: row.department,
            availability: row.availability,
            relevance: Math.min(99, relevance),
            summary: row.summary,
            matchedBy: Array.from(matchedBy),
            genres: row.genres,
            language: row.language,
            rating: row.rating,
            coverImg: row.cover_img,
          } satisfies SearchResult;
        })
        .filter((result) => result.relevance >= 48)
        .sort((left, right) => right.relevance - left.relevance)
        .slice(0, limit);
    } catch (error) {
      console.error("Catalog searchBooks failed:", error);
      return searchSeedCatalogBooks(options);
    }
  },

  async getTrendingBooks(limit = 5) {
    if (!hasExplicitDatabaseUrl) {
      return getSeedCatalogBooks().sort(sortCatalogBooks).slice(0, limit);
    }

    try {
      await ensureCuratedSeedBooks();
      const database = await getCatalogDb();
      const result = await database.query<BookRow>(
        "SELECT * FROM books ORDER BY borrow_count DESC, rating DESC LIMIT $1",
        [limit]
      );
      return result.rows.map(mapBookRow);
    } catch (error) {
      console.error("Catalog getTrendingBooks failed:", error);
      return getSeedCatalogBooks().sort(sortCatalogBooks).slice(0, limit);
    }
  },

  async getDepartmentDistribution() {
    if (!hasExplicitDatabaseUrl) {
      return getSeedDepartmentDistribution();
    }

    try {
      await ensureCuratedSeedBooks();
      const database = await getCatalogDb();
      const result = await database.query<{ department: Department; total: number }>(
        `
          SELECT department, COUNT(*) as total
          FROM books
          GROUP BY department
          ORDER BY total DESC, department ASC
        `,
      );

      const rows = result.rows;
      const totalBooks = rows.reduce((sum, row) => sum + row.total, 0) || 1;

      return rows.map((row) => ({
        department: row.department,
        usage: Math.round((row.total / totalBooks) * 100),
      }));
    } catch (error) {
      console.error("Catalog getDepartmentDistribution failed:", error);
      return getSeedDepartmentDistribution();
    }
  },

  async addBook(input: Omit<BookRecord, "id" | "borrowCount" | "aiScore">) {
    await ensureCuratedSeedBooks();
    const database = await getCatalogDb();
    const book = createInsertedBookInput(input);
    const result = await database.query<BookRow>(insertBookSql, [
      book.id,
      book.source,
      book.sourceBookId,
      book.title,
      book.author,
      book.isbn,
      book.publicationDate,
      book.department,
      book.shelfLocation,
      book.summary,
      book.series,
      book.genres,
      book.language,
      book.publisher,
      book.pages,
      book.rating,
      book.numRatings,
      book.likedPercent,
      book.coverImg,
      book.bbeScore,
      book.bbeVotes,
      book.borrowCount,
      book.availability,
      book.aiScore,
      new Date().toISOString(),
      new Date().toISOString(),
    ]);

    return mapBookRow(result.rows[0]);
  },

  async updateBook(id: string, updates: Partial<BookRecord>) {
    await ensureCuratedSeedBooks();
    const database = await getCatalogDb();
    const existingResult = await database.query<BookRow>("SELECT * FROM books WHERE id = $1", [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return null;
    }

    const nextSummary = previewSummary(updates.summary ?? existing.summary);
    const nextGenres = updates.genres ?? existing.genres;
    const nextRating = updates.rating ?? existing.rating;
    const nextLikedPercent = existing.liked_percent;
    const nextBbeScore = existing.bbe_score;
    const nextBorrowCount = updates.borrowCount ?? existing.borrow_count;
    const nextAvailability =
      updates.availability ?? deriveAvailability(id, existing.num_ratings, existing.bbe_votes);
    const nextAiScore =
      updates.aiScore ??
      deriveAiScore(nextRating, nextLikedPercent, nextBbeScore, nextSummary, nextGenres ?? "");

    const updatedResult = await database.query<BookRow>(
      `
        UPDATE books
        SET
          title = $1,
          author = $2,
          isbn = $3,
          publication_date = $4,
          department = $5,
          shelf_location = $6,
          summary = $7,
          genres = $8,
          language = $9,
          publisher = $10,
          rating = $11,
          cover_img = $12,
          borrow_count = $13,
          availability = $14,
          ai_score = $15,
          updated_at = $16
        WHERE id = $17
        RETURNING *
      `,
      [
        updates.title ?? existing.title,
        updates.author ?? existing.author,
        updates.isbn ?? existing.isbn,
        updates.publicationDate ?? existing.publication_date,
        updates.department ?? existing.department,
        updates.shelfLocation ?? existing.shelf_location,
        nextSummary,
        nextGenres ?? "",
        updates.language ?? existing.language,
        updates.publisher ?? existing.publisher,
        nextRating,
        updates.coverImg ?? existing.cover_img,
        nextBorrowCount,
        nextAvailability,
        nextAiScore,
        new Date().toISOString(),
        id,
      ],
    );

    const row = updatedResult.rows[0];
    return row ? mapBookRow(row) : null;
  },

  async deleteBook(id: string) {
    await ensureCuratedSeedBooks();
    const database = await getCatalogDb();
    const existingResult = await database.query<{ id: string }>("SELECT id FROM books WHERE id = $1", [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return false;
    }

    const deleteResult = await database.query("DELETE FROM books WHERE id = $1", [id]);
    return (deleteResult.rowCount ?? 0) > 0;
  },
};
