# BookHive Production Architecture

## Overview

BookHive is implemented as a modular monolith with clear seams for future service extraction. The current codebase keeps feature modules isolated:

- Dashboard
- Records
- Transactions
- Reports
- History
- Settings and Accounts
- Auth and Session

This layout is intended to support a gradual move toward separate services without rewriting the frontend shell.

## Frontend

- Next.js App Router renders the protected admin experience
- Client modules fetch data through route handlers instead of reaching directly into storage
- Virtualized lists are used for log-style and record-heavy surfaces
- `useDeferredValue` and `startTransition` reduce UI blocking during filters and updates
- Framer Motion provides subtle animation without compromising layout stability

## API Layer

Current route handlers:

- `GET /api/dashboard`
- `POST /api/search`
- CRUD endpoints for records and users
- Transaction creation and status updates
- Reports, history, settings, and session endpoints
- `GET /api/activity/stream` for live terminal events

## Real-Time Design

Current implementation:

- Server-Sent Events stream recent activity into the live terminal
- Mutations publish new activity into the stream

Production recommendation:

- Move event delivery to Redis Pub/Sub, NATS, Ably, or Socket.IO with horizontal fan-out support
- Publish transaction approvals, reservation changes, and alert states through a queue-backed event pipeline

## Data and Scale Strategy

Target requirements from the brief:

- 1,000,000+ books
- 100,000+ active users
- High concurrent search and circulation traffic

Current local stack:

- SQLite for the catalog at `data/bookhive.sqlite`
- Full-text search with SQLite FTS for title, author, ISBN, summary, genres, publisher, and department
- Imported Goodreads dataset plus curated BookHive titles

Recommended production stack:

- PostgreSQL for transactional records and strict relationships
- Redis for metrics, trending records, and AI result caching
- Elasticsearch or Meilisearch for indexed title, author, ISBN, and full-text lookups
- Object storage for uploaded files and extracted search artifacts

Recommended indexes:

- `books(isbn)`
- `books(title gin_trgm_ops)` or search-engine equivalent
- `books(author gin_trgm_ops)` or search-engine equivalent
- `transactions(student_id, status)`
- `transactions(requested_at desc)`
- `history(timestamp desc, module)`

## AI Prompt Search

Current implementation:

- Indexed SQLite FTS retrieval with heuristic semantic ranking
- Goodreads dataset import command: `npm run db:import:goodreads` or `npm run db:import:kaggle` for a locally downloaded Kaggle CSV
- Curated BookHive titles kept in the catalog alongside imported data
- File upload text context for text files, DOCX, and PPTX

Production recommendation:

- Use Gemini for embeddings and answer re-ranking
- Store embeddings in a vector index
- Use RAG over catalog metadata, abstract text, and uploaded file extracts
- Cache prompt responses and semantic search results in Redis keyed by normalized query

## Security

- Middleware enforces authenticated access to protected routes
- Route handlers enforce role-based permissions
- Settings and account management are admin-only
- Librarians can manage records and transactions
- Sessions use HTTP-only cookies

Production hardening:

- Integrate STI school SSO or OAuth
- Rotate signing keys and move to signed/encrypted tokens
- Add request throttling, audit-grade immutable logging, and CSRF protection where needed
- Add input sanitization and rate limits on AI search endpoints

## Deployment Path

Recommended production deployment:

1. Put Next.js behind a load balancer or reverse proxy
2. Use a managed PostgreSQL instance with backups
3. Add Redis for cache and event fan-out
4. Add search and vector infrastructure
5. Send metrics, traces, and logs to a monitoring stack

## Demo Caveat

The catalog is now persisted locally, but the rest of the operational modules still use an in-memory store for zero-setup local runs. Swapping the remaining modules in `src/lib/data/store.ts` for database-backed repositories is the main step required for full persistent production deployment.
