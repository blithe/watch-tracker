# ⌚ Watch Tracker

A personal watch collection and wear-tracking app. Log which watch you're wearing each day, manage your collection with purchase/sale tracking, maintain a wishlist with price monitoring, and view stats about your rotation.

Built with Next.js 16, TypeScript, SQLite (local) / Vercel Postgres (production), and Tailwind CSS.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![SQLite](https://img.shields.io/badge/SQLite-3-003B57) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Features

- **Calendar view** — See which watch you wore on any given day
- **Day detail** — Tap a day to see the full entry with wrist shot
- **Log a wear** — Record today's watch with optional photo and notes
- **Collection management** — Track your watches with purchase date, price, and sale history
- **Wishlist & price monitoring** — Track watches you want, log prices from different sources, mark as purchased
- **Stats dashboard** — Most-worn watches, streak tracking, collection overview
- **Image uploads** — Vercel Blob in production, local file storage in development
- **Password auth** — Optional single-password protection via `AUTH_PASSWORD` env var
- **Dark mode** — Tailwind dark theme throughout

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) locally, [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) in production |
| Image storage | Local `public/uploads/` in dev, [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) in production |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Testing | [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/) |
| Runtime | Node.js 18+ |

## Getting Started

### Prerequisites

- **Node.js** 18 or later
- **npm** (comes with Node)

### Install & Run

```bash
git clone https://github.com/blithe/watch-tracker.git
cd watch-tracker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database (`watch-tracker.db`) is created automatically on first run with a seed entry.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_PASSWORD` | No | If set, enables password protection. Leave unset for open access. |
| `POSTGRES_URL` | Production | Vercel Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | Production | Vercel Blob token for image uploads |

### Build for Production

```bash
npm run build
npm start
```

### Running Tests

```bash
npm test
```

Tests use an isolated SQLite database — they won't touch your production data. The suite covers:

- **API routes** — watches, wear log, wishlist, price history, uploads, auth
- **Database** — schema validation, foreign keys, constraints
- **Auth** — token generation, verification, middleware
- **Date handling** — local time formatting (no UTC drift)
- **Page rendering** — date parameter parsing
- **Integration** — end-to-end flows for calendar, collection, wishlist, image uploads

To run tests in watch mode during development:

```bash
npx jest --watch
```

## Project Structure

```
watch-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Calendar view (home)
│   │   ├── layout.tsx                # Root layout + nav
│   │   ├── globals.css               # Tailwind base styles
│   │   ├── login/page.tsx            # Login page
│   │   ├── log/page.tsx              # Log a new wear entry
│   │   ├── day/[date]/page.tsx       # Day detail view
│   │   ├── stats/page.tsx            # Stats dashboard
│   │   ├── collection/              # Collection pages
│   │   ├── wishlist/                # Wishlist pages
│   │   │   ├── page.tsx             # Wishlist overview
│   │   │   ├── add/page.tsx         # Add to wishlist
│   │   │   └── [id]/page.tsx        # Price history detail
│   │   └── api/
│   │       ├── auth/login/route.ts  # Login endpoint
│   │       ├── watches/route.ts     # CRUD for watch collection
│   │       ├── wear-log/route.ts    # CRUD for wear log entries
│   │       ├── upload/route.ts      # Image upload (Vercel Blob)
│   │       ├── collection/route.ts  # Collection endpoints
│   │       ├── db-init/route.ts     # First-deploy schema init (Postgres)
│   │       └── wishlist/            # Wishlist + price history endpoints
│   ├── lib/
│   │   ├── auth.ts                  # Auth token generation + verification
│   │   ├── db.ts                    # Dual-mode DB (SQLite local / Postgres prod)
│   │   └── test-db.ts               # Isolated SQLite for tests
│   ├── middleware.ts                 # Auth middleware (session cookie check)
│   └── __tests__/
│       ├── api/                     # API route tests
│       ├── integration/             # End-to-end flow tests
│       ├── lib/                     # Database + auth tests
│       ├── pages/                   # Page rendering tests
│       └── utils/                   # Date formatting tests
├── public/
│   └── uploads/                     # Uploaded images in dev (gitignored)
├── script/
│   ├── test                         # Pre-commit test runner
│   └── test_fast                    # Fast test runner
├── jest.config.*                    # Jest configuration
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── package.json
```

## Database Schema

```sql
-- Your watch collection
CREATE TABLE watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  reference TEXT,
  image_url TEXT,
  purchase_date TEXT,
  purchase_price REAL,
  sold_date TEXT,
  sold_price REAL,
  status TEXT DEFAULT 'owned',       -- 'owned' or 'sold'
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- One entry per day — which watch you wore
CREATE TABLE wear_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL,
  date TEXT NOT NULL UNIQUE,
  image_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (watch_id) REFERENCES watches(id)
);

-- Watches you want
CREATE TABLE wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  reference TEXT,
  image_url TEXT,
  target_price REAL,
  notes TEXT,
  status TEXT DEFAULT 'watching',    -- 'watching', 'purchased', 'removed'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Price tracking for wishlist items
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wishlist_id INTEGER NOT NULL,
  price REAL NOT NULL,
  source TEXT,                       -- 'chrono24', 'ebay', 'manual', etc.
  url TEXT,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wishlist_id) REFERENCES wishlist(id) ON DELETE CASCADE
);
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate with password, sets session cookie |
| `GET` | `/api/watches` | List all watches |
| `POST` | `/api/watches` | Add a new watch |
| `GET` | `/api/watches/[id]` | Get single watch with wear count |
| `PATCH` | `/api/watches/[id]` | Update a watch (details, mark as sold) |
| `GET` | `/api/collection` | List watches split by owned/sold |
| `GET` | `/api/wear-log` | Get wear log (supports `?month=YYYY-MM`) |
| `POST` | `/api/wear-log` | Log a wear entry |
| `POST` | `/api/upload` | Upload an image, returns `{ url }` |
| `GET` | `/api/wishlist` | List wishlist items with latest prices |
| `POST` | `/api/wishlist` | Add a wishlist item |
| `PATCH` | `/api/wishlist` | Update a wishlist item |
| `DELETE` | `/api/wishlist` | Remove a wishlist item |
| `GET` | `/api/wishlist/[id]/prices` | Get price history |
| `POST` | `/api/wishlist/[id]/prices` | Add a price entry |
| `GET` | `/api/db-init` | Initialize Postgres schema on first deploy |

## Deployment (Vercel)

1. Push to GitHub and import the repo in Vercel
2. Add environment variables: `AUTH_PASSWORD`, `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`
3. After first deploy, hit `/api/db-init` once to create the Postgres schema

## Roadmap

- [x] **Phase 1** — Core app: calendar, logging, stats, image uploads
- [x] **Phase 2** — Wishlist & price monitoring
- [x] **Phase 3** — Auth & Vercel deployment support
- [ ] **Phase 4** — Instagram integration

## License

MIT
