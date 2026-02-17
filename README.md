# Theater Showtimes Admin

Admin tool for ingesting a partner's CSV of showtimes and reconciling it against the current schedule for a single theater.

## Running Locally

```bash
# Install dependencies
yarn install

# Set your Neon PostgreSQL connection string in .env
# DATABASE_URL="postgresql://..."

# Push the schema to your database
npx prisma db push

# Start the dev server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Seed Demo Data** to populate the database with sample showtimes, then upload a CSV to test the reconciliation flow.

## Architecture Decisions

- **Next.js App Router** — Full-stack framework with API routes co-located alongside the UI. Server-side API routes handle all database operations.
- **Prisma v6 + Neon PostgreSQL** — Type-safe ORM with serverless-friendly PostgreSQL. Schema-first approach makes the data model explicit.
- **Reconciliation algorithm** — The core business logic normalizes movie titles (replace punctuation with spaces, lowercase, collapse whitespace, convert number words to digits) and matches on `normalizedTitle + startTime` as the composite key. This handles messy real-world data like "DUNE PART 2" vs "Dune: Part Two" vs "Spider-Man: Homecoming" vs "Spider Man - Homecoming". Normalization is only used for matching — original titles are preserved in the database and UI.
- **Preview before apply** — Upload returns a preview (adds/updates/archives) without modifying the database. Changes are only applied when the user explicitly confirms. All mutations happen in a single Prisma transaction for atomicity.
- **Polling for freshness** — The table auto-refreshes every 5 seconds via polling, so changes made externally (e.g., via API calls or another session) appear without manual refresh. Polling pauses while the preview modal is open to avoid stale-state conflicts.
- **Deduplication** — Duplicate CSV rows (same normalized title + start time) are deduped before reconciliation. First occurrence wins.
- **Soft delete for archives** — Archived showtimes have `status: "archived"` rather than being deleted, preserving history. The "Clear Schedule" action hard-deletes all records for a full reset.

## What I'd Improve With More Time

- Add pagination to the showtimes table for large datasets
- Add unit tests for the `normalizeTitle` and `reconcile` functions
- Add a history/audit log of past CSV imports with rollback support
- Add a database-level unique constraint (would require storing a `normalizedTitle` column since the composite key involves a computed field)
- Add row-level CSV validation with detailed error reporting
- Replace polling with server-sent events or WebSockets for real-time updates
- Implement role-based access control for admin actions
