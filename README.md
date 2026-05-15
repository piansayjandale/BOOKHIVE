# BookHive Monitor

BookHive Monitor is a full-stack admin dashboard for the STI West Negros University Library. It includes:

- A dark blue dashboard shell with fixed sidebar, top header, centered AI prompt search, metric cards, and a split monitor layout
- Full CRUD flows for records and account management
- Transaction approvals for borrowing, returns, and reservations
- Descriptive analytics with export and print actions
- Audit trail history and real-time activity streaming
- Role-based session protection for `Admin`, `Librarian`, and `Student`
- A SQLite-backed book catalog with Goodreads import tooling

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Framer Motion
- Recharts
- Zod

## Run Locally

```bash
npm install
npm run db:import:goodreads
npm run dev
```

If you have the Kaggle dataset from `https://tinyurl.com/kaggledsets`, place the CSV at `data/imports/books_1.Best_Books_Ever.csv` and run:

```bash
npm run db:import:kaggle
```

Open `http://localhost:3000`.

Use the included demo login identities or enter your own STI-style email and pick a role.

## Key Routes

- `/` Home dashboard
- `/records` Book metadata CRUD
- `/transactions` Borrowing, return, and reservation workflows
- `/reports` Descriptive analytics
- `/history` Audit trail
- `/settings` System preferences and account management

## Current Architecture

The implementation is a modular full-stack Next.js app using route handlers for API surfaces. The book catalog is persisted in a local SQLite database at `data/bookhive.sqlite`, while transactions, activity, settings, and users remain in the demo in-memory layer.

Production upgrade path:

- Replace the in-memory store with PostgreSQL plus read replicas
- Add Redis for cached metrics, trending records, and AI result caching
- Add Elasticsearch or Meilisearch for large-scale indexed discovery
- Replace SSE with WebSockets or a broker-backed event stream for multi-instance real-time delivery
- Connect Gemini embeddings and a RAG retrieval service through environment-backed secrets

## Production Notes

- Session protection is enforced with middleware and role checks on protected APIs
- The book catalog is imported from the Goodreads Best Books Ever dataset plus the original BookHive curated library seed records
- The UI is optimized for large data handling through deferred filtering, pagination, virtualized lists, and modular page loading
- Real-time terminal activity uses Server-Sent Events
- Prompt search now uses SQLite FTS plus heuristic ranking, with uploaded file text context for supported text, DOCX, and PPTX inputs

## Verification

```bash
npm run db:import:goodreads
npm run lint
npm run build
```

The import, lint, and build commands pass in the current workspace.

## Documentation

- [Architecture notes](./docs/architecture.md)
- [Environment template](./.env.example)
