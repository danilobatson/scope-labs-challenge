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

## Project Structure

```text
src/
├── lib/
│   ├── normalize.ts     # Title normalization for fuzzy matching
│   ├── reconcile.ts     # Core reconciliation algorithm (add/update/archive)
│   ├── types.ts         # Shared TypeScript interfaces
│   └── prisma.ts        # Prisma client singleton
├── app/
│   ├── page.tsx         # Main dashboard UI (table, actions, polling)
│   ├── PreviewModal.tsx # Preview modal for reviewing changes before apply
│   └── api/showtimes/
│       ├── route.ts     # GET — list active showtimes (sort/filter)
│       ├── upload/      # POST — parse CSV and return reconciliation preview
│       ├── apply/       # POST — apply preview changes in a transaction
│       ├── clear/       # POST — hard-delete all showtimes
│       └── seed/        # POST — populate demo data
```

## Architecture Decisions

- **Next.js App Router** — Full-stack framework with API routes co-located alongside the UI. Server-side API routes handle all database operations.
- **Prisma v6 + Neon PostgreSQL** — Type-safe ORM with serverless-friendly PostgreSQL. Schema-first approach makes the data model explicit.
- **Reconciliation algorithm** — The core business logic normalizes movie titles (replace punctuation with spaces, lowercase, collapse whitespace, convert number words to digits) and matches on `normalizedTitle + startTime` as the composite key. This handles messy real-world data like "DUNE PART 2" vs "Dune: Part Two" vs "Spider-Man: Homecoming" vs "Spider Man - Homecoming". Normalization is only used for matching — original titles are preserved in the database and UI.
- **Preview before apply** — Upload returns a preview (adds/updates/archives) without modifying the database. Changes are only applied when the user explicitly confirms. All mutations happen in a single Prisma transaction for atomicity.
- **Polling for freshness** — The table auto-refreshes every 5 seconds via polling, so changes made externally (e.g., via API calls or another session) appear without manual refresh. Polling pauses while the preview modal is open to avoid stale-state conflicts.
- **Deduplication** — Duplicate CSV rows (same normalized title + start time) are deduped before reconciliation. First occurrence wins.
- **Soft delete for archives** — Archived showtimes have `status: "archived"` rather than being deleted, preserving history. The "Clear Schedule" action hard-deletes all records for a full reset.

## Additional Features

Beyond the core requirements, the following UX improvements were added:

- **Seed Demo Data button** — One-click database population with sample showtimes matching the project spec, for quick setup and testing.
- **Auto-refresh via polling** — The showtimes table refreshes every 5 seconds so external changes (e.g., via `curl` or another session) appear without a manual page reload. Polling pauses while the preview modal is open.
- **Debounced filter input** — Title filter waits 300ms after the user stops typing before querying the API, reducing unnecessary network requests.
- **Per-button loading states** — Each action button (Upload, Seed, Clear, Apply) has its own loading indicator so the user knows exactly which operation is in progress.
- **Auto-dismissing toast messages** — Success/error messages disappear after 5 seconds or can be manually dismissed.
- **Resilient CSV parsing** — Non-fatal Papa Parse warnings (e.g., trailing delimiters) are tolerated; only structural errors (delimiter/field mismatch) reject the upload. The `formData()` call is also wrapped in its own try-catch to handle non-multipart requests gracefully.

## What I'd Improve With More Time

- Add pagination to the showtimes table for large datasets
- Add unit tests for the `normalizeTitle` and `reconcile` functions
- Add a history/audit log of past CSV imports with rollback support
- Add a database-level unique constraint (would require storing a `normalizedTitle` column since the composite key involves a computed field)
- Add row-level CSV validation with detailed error reporting
- Replace polling with server-sent events or WebSockets for real-time updates
- Implement role-based access control for admin actions
