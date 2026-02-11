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

Personal watch tracker built with Next.js 16 (App Router), TypeScript, Vercel Postgres, and Tailwind CSS. Deployed on Vercel.

### Data Layer

- **Production database**: Vercel Postgres via `@vercel/postgres` in `src/lib/db.ts`
- **db.ts adapter**: Wraps `@vercel/postgres` with a `db.prepare(sql).all/get/run()` interface (converts `?` params to `$1,$2,...`)
- **Schema init**: `/api/db-init` route creates tables on first deploy
- **Tables**: `watches` (collection), `wear_log` (daily wear entries, unique date constraint), `wishlist`, `price_history` (tracks wishlist item prices over time)
- **Image uploads**: Vercel Blob via `@vercel/blob`

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
- Test database: isolated SQLite via `src/lib/test-db.ts` (better-sqlite3, devDependency) — each test file gets its own DB instance
- `jest.setup.js` mocks `next/navigation` and `fs/promises`
