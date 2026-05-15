# BookHive Express API

This folder contains the production deployment shape for a dedicated Node.js + Express + PostgreSQL backend that mirrors the new `/api/admin/*` surface implemented in the Next app.

## Start

1. Install dependencies from the repo root.
2. Copy `.env.example` to `.env.local` or `.env`.
3. Run the schema in `backend/db/schema.sql`.
4. Start the API with `npm run api:dev`.

## Current scope

- JWT-based admin authentication
- Dashboard summary queries
- User management CRUD
- PostgreSQL schema for users, books, transactions, reservations, AI logs, activity logs, and settings

The Next app currently runs its admin pages against in-app route handlers for zero-setup local use, while this backend folder provides the production-oriented Express/PostgreSQL structure requested for deployment and future extraction.
