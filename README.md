# Theater Showtimes Admin

Admin tool for ingesting a partner's CSV of showtimes and reconciling it against the current schedule for a single theater.

## Running Locally

```bash
# Install dependencies
yarn install

# Set your Neon PostgreSQL connection string
# Edit .env and set DATABASE_URL

# Push the schema to your database
npx prisma db push

# Start the dev server
yarn dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Seed Demo Data** to populate the database with sample showtimes, then upload a CSV to test the reconciliation flow.

## Architecture Decisions

- **Next.js App Router** — Full-stack framework with API routes co-located alongside the UI. Server-side API routes handle all database operations.
- **Prisma v6 + Neon PostgreSQL** — Type-safe ORM with serverless-friendly PostgreSQL. Schema-first approach makes the data model explicit.
- **Reconciliation algorithm** — The core business logic normalizes movie titles (strip punctuation, lowercase, convert number words to digits) and matches on `normalizedTitle + startTime` as the composite key. This handles messy real-world data like "DUNE PART 2" vs "Dune: Part Two".
- **Preview before apply** — Upload returns a preview (adds/updates/archives) without modifying the database. Changes are only applied when the user explicitly confirms. All mutations happen in a single Prisma transaction.
- **Client-side state** — The preview modal lives in client-side state rather than a separate page/route, keeping the UX simple and avoiding unnecessary navigation.

## What I'd Improve With More Time

- Add pagination to the showtimes table for large datasets
- Add unit tests for the `normalizeTitle` and `reconcile` functions
- Add a history/audit log of past CSV imports
- Support undo/rollback of applied changes
- Add loading states and optimistic updates for better UX
- Add CSV validation with more detailed error messages per row
- Implement role-based access control for the admin actions
