# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run all tests
npm run test:watch   # Jest watch mode
npm test -- path/to/file.test.ts              # Run single test file
npm test -- --testNamePattern="test name"      # Run tests matching name
```

## Architecture

Personal watch tracker built with Next.js 16 (App Router), TypeScript, and Tailwind CSS.

### Data Layer

- **Dual-mode database** in `src/lib/db.ts`: SQLite (better-sqlite3) locally, Vercel Postgres in production
  - Switches based on `POSTGRES_URL` env var presence
  - Unified `db.prepare(sql).all/get/run()` interface
  - SQL uses `?` params (converted to `$1,$2,...` for Postgres)
  - Use `CURRENT_TIMESTAMP` (not `NOW()` or `datetime('now')`) for cross-DB compatibility
- **Local schema**: Auto-created on import of `db.ts` (SQLite)
- **Production schema**: `/api/db-init` route creates tables on first deploy (Postgres)
- **Tables**: `watches` (collection), `wear_log` (daily wear entries, unique date constraint), `wishlist`, `price_history` (tracks wishlist item prices over time, ON DELETE CASCADE)
- **Image uploads**: Vercel Blob via `@vercel/blob` in production; local file storage in dev

### API Pattern

REST endpoints in `src/app/api/`. All routes export `dynamic = 'force-dynamic'` and return `NextResponse.json()`. Handler signature: `export async function GET/POST/PATCH/DELETE(req)`.

### Component Pattern

- Pages are server components that fetch data via `await db.prepare().all/get()`
- Interactive forms/views use `'use client'` with `fetch('/api/...')` calls
- Dynamic route params are accessed via `async (props)` with `await props.params` (Next.js 16 pattern)
- No state management library — React hooks only (useState/useEffect)
- Path alias: `@/*` maps to `./src/*`

### Key Pages

- `/` — Calendar view showing daily watch wear
- `/log` — Log a new wear entry
- `/day/[date]` — Day detail view
- `/stats` — Statistics dashboard
- `/collection` — Watch collection management (purchase/sale tracking)
- `/wishlist` — Wishlist with price history tracking

### Testing

- Jest 30 with ts-jest and React Testing Library
- Tests in `src/__tests__/` (subdirs: `api/`, `integration/`, `lib/`, `utils/`)
- Test database: isolated SQLite via `src/lib/test-db.ts` — each test file gets its own DB instance
- `jest.setup.js` mocks `next/navigation` and `fs/promises`
