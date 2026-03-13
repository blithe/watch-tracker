# ⌚ Watch Tracker

A personal watch collection and wear-tracking app. Log which watch you're wearing each day, manage your collection with purchase/sale tracking, maintain a wishlist with price monitoring, view stats about your rotation, and share wrist shots with other collectors via a social feed.

Built with Next.js 16, TypeScript, SQLite (local) / Vercel Postgres (production), and Tailwind CSS.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![SQLite](https://img.shields.io/badge/SQLite-3-003B57) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Features

- **Calendar view** — See which watches you wore on any given day (multiple per day supported)
- **Day detail** — Tap a day to see all entries with wrist shots
- **Log a wear** — Record today's watch(es) with optional photo and notes
- **Collection management** — Track your watches with purchase date, price, and sale history
- **CSV import** — Bulk-import watches from CSV with smart column matching and alias support
- **Wishlist & price monitoring** — Track watches you want, log prices from different sources, mark as purchased
- **Stats dashboard** — Most-worn watches, streak tracking, collection overview
- **Image uploads** — Vercel Blob in production, local file storage in development
- **Multi-user auth** — Email/password login, registration, password reset via email
- **Feedback** — Public submission form; admin-only feedback review
- **Social feed** — Follow other collectors, see their wrist shots, manage follow requests
- **User profiles** — Discoverable profiles with display name, username, and bio
- **Follow system** — Send/accept/reject follow requests, block users (bidirectional)
- **User search** — Find discoverable collectors by username or display name
- **Data isolation** — Each user sees only their own watches, wear logs, and wishlist
- **Dark mode** — Tailwind dark theme throughout

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) locally, [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) in production |
| Image storage | Local `public/uploads/` in dev, [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) in production |
| Auth | HMAC-SHA256 signed session tokens, bcryptjs password hashing |
| Email | [Resend](https://resend.com/) for password reset emails |
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

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`. Register a new account to get started.

The SQLite database (`watch-tracker.db`) is created automatically on first run.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Recommended | Secret for HMAC session token signing. Defaults to `dev-secret-change-in-production`. |
| `POSTGRES_URL` | Production | Vercel Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | Production | Vercel Blob token for image uploads |
| `RESEND_API_KEY` | Optional | Resend API key for password reset emails |

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

- **API routes** — watches, wear log, wishlist, price history, uploads, auth, social (profile, follow, block, feed, search)
- **Database** — schema validation, foreign keys, constraints (including social tables)
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
│   │   ├── page.tsx                      # Calendar view (home)
│   │   ├── layout.tsx                    # Root layout + nav
│   │   ├── globals.css                   # Tailwind base styles
│   │   ├── login/page.tsx                # Login page
│   │   ├── register/page.tsx             # Registration page
│   │   ├── forgot-password/page.tsx      # Password reset request
│   │   ├── reset-password/page.tsx       # Password reset form
│   │   ├── feedback/page.tsx             # Feedback submission (public)
│   │   ├── admin/feedback/page.tsx       # Admin feedback viewer
│   │   ├── log/page.tsx                  # Log a new wear entry
│   │   ├── day/[date]/page.tsx           # Day detail view
│   │   ├── stats/page.tsx                # Stats dashboard
│   │   ├── collection/                   # Collection pages
│   │   ├── wishlist/                     # Wishlist pages
│   │   │   ├── page.tsx                  # Wishlist overview
│   │   │   ├── add/page.tsx              # Add to wishlist
│   │   │   └── [id]/page.tsx             # Price history detail
│   │   ├── feed/page.tsx                 # Social wrist shot feed
│   │   ├── profile/setup/page.tsx        # First-time profile setup
│   │   ├── settings/profile/page.tsx     # Edit profile
│   │   ├── settings/followers/page.tsx   # Manage followers, requests, blocks
│   │   ├── user/[username]/page.tsx      # Public user profile
│   │   └── api/
│   │       ├── auth/login/route.ts       # Email/password login
│   │       ├── auth/logout/route.ts      # Clear session cookie
│   │       ├── auth/register/route.ts    # New account registration
│   │       ├── auth/forgot-password/     # Send reset email
│   │       ├── auth/reset-password/      # Reset with token
│   │       ├── admin/feedback/route.ts   # Admin feedback CRUD
│   │       ├── feedback/route.ts         # Submit feedback
│   │       ├── watches/route.ts          # CRUD for watch collection
│   │       ├── wear-log/route.ts         # CRUD for wear log entries
│   │       ├── upload/route.ts           # Image upload (Vercel Blob)
│   │       ├── collection/route.ts       # Collection endpoints
│   │       ├── db-init/route.ts          # First-deploy schema init (Postgres)
│   │       ├── wishlist/                 # Wishlist + price history endpoints
│   │       ├── profile/route.ts          # Own profile (GET/PATCH, auto-creates)
│   │       ├── profile/[username]/       # Public profile lookup
│   │       ├── follow/route.ts           # Send/cancel follow request
│   │       ├── follow-requests/route.ts  # List/accept/reject pending requests
│   │       ├── followers/route.ts        # List/remove accepted followers
│   │       ├── following/route.ts        # List users you follow
│   │       ├── block/route.ts            # Block/unblock users
│   │       ├── blocks/route.ts           # List blocked users
│   │       ├── feed/route.ts             # Paginated wrist shot feed
│   │       └── search/users/route.ts     # Search discoverable users
│   ├── lib/
│   │   ├── auth.ts                       # HMAC session tokens + cookie helpers
│   │   ├── db.ts                         # Dual-mode DB (SQLite local / Postgres prod)
│   │   └── test-db.ts                    # Isolated SQLite for tests
│   ├── middleware.ts                      # Auth middleware (session check)
│   └── __tests__/
│       ├── api/                          # API route tests
│       ├── integration/                  # End-to-end flow tests
│       ├── lib/                          # Database + auth tests
│       ├── pages/                        # Page rendering tests
│       └── utils/                        # Date formatting tests
├── public/
│   └── uploads/                          # Uploaded images in dev (gitignored)
├── script/
│   ├── test                              # Pre-commit test runner
│   └── test_fast                         # Fast test runner
├── jest.config.*                         # Jest configuration
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── package.json
```

## Database Schema

```sql
-- User accounts
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reset_token TEXT,
  reset_token_expires TEXT
);

-- Your watch collection
CREATE TABLE watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
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

-- Daily wear entries — multiple watches per day allowed
CREATE TABLE wear_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  watch_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  image_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (watch_id) REFERENCES watches(id)
);

-- Watches you want
CREATE TABLE wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  reference TEXT,
  image_url TEXT,
  source_url TEXT,
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
  source TEXT,
  url TEXT,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wishlist_id) REFERENCES wishlist(id) ON DELETE CASCADE
);

-- User feedback
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  email TEXT,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Social profiles (separate from auth users)
CREATE TABLE user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  is_discoverable INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Follow relationships with approval
CREATE TABLE follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id INTEGER NOT NULL REFERENCES users(id),
  following_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT DEFAULT 'pending',  -- 'pending' or 'accepted'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);

-- Block relationships (bidirectional visibility)
CREATE TABLE blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_id INTEGER NOT NULL REFERENCES users(id),
  blocked_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id)
);
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate with email + password, sets session cookie |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `POST` | `/api/auth/register` | Create a new account |
| `POST` | `/api/auth/forgot-password` | Send password reset email |
| `POST` | `/api/auth/reset-password` | Reset password with token |
| `POST` | `/api/feedback` | Submit feedback (public) |
| `GET` | `/api/admin/feedback` | List all feedback (admin only) |
| `DELETE` | `/api/admin/feedback` | Delete a feedback entry (admin only) |
| `GET` | `/api/watches` | List user's watches |
| `POST` | `/api/watches` | Add a new watch |
| `GET` | `/api/watches/[id]` | Get single watch with wear count |
| `PATCH` | `/api/watches/[id]` | Update a watch |
| `DELETE` | `/api/watches/[id]` | Delete a watch |
| `POST` | `/api/watches/import` | Import watches from CSV file |
| `GET` | `/api/collection` | List watches split by owned/sold with stats |
| `GET` | `/api/wear-log` | Get wear log (`?date=YYYY-MM-DD` or `?month=YYYY-MM`) |
| `POST` | `/api/wear-log` | Log a wear entry |
| `GET` | `/api/wear-log/[id]` | Get a single wear log entry |
| `PATCH` | `/api/wear-log/[id]` | Update a wear log entry |
| `DELETE` | `/api/wear-log/[id]` | Delete a wear log entry |
| `POST` | `/api/upload` | Upload an image, returns `{ url }` |
| `GET` | `/api/wishlist` | List wishlist items with latest prices |
| `POST` | `/api/wishlist` | Add a wishlist item |
| `PATCH` | `/api/wishlist` | Update a wishlist item |
| `DELETE` | `/api/wishlist` | Remove a wishlist item |
| `GET` | `/api/wishlist/[id]/prices` | Get price history |
| `POST` | `/api/wishlist/[id]/prices` | Add a price entry |
| `GET` | `/api/profile` | Get own profile (auto-creates on first call) |
| `PATCH` | `/api/profile` | Update display name, username, bio, discoverable |
| `GET` | `/api/profile/[username]` | Get public profile (404 if blocked/not discoverable) |
| `POST` | `/api/follow` | Send follow request `{ userId }` |
| `DELETE` | `/api/follow` | Unfollow / cancel pending request `{ userId }` |
| `GET` | `/api/follow-requests` | List pending follow requests to you |
| `PATCH` | `/api/follow-requests` | Accept or reject `{ userId, action }` |
| `GET` | `/api/followers` | List accepted followers |
| `DELETE` | `/api/followers` | Remove a follower `{ userId }` |
| `GET` | `/api/following` | List users you follow (accepted) |
| `POST` | `/api/block` | Block user `{ userId }`, removes all follows |
| `DELETE` | `/api/block` | Unblock user `{ userId }` |
| `GET` | `/api/blocks` | List blocked users |
| `GET` | `/api/feed` | Paginated wrist shot feed (`?cursor=&limit=20`) |
| `GET` | `/api/search/users` | Search discoverable users (`?q=term`) |
| `GET` | `/api/db-init` | Initialize Postgres schema on first deploy |

## Deployment (Vercel)

1. Push to GitHub and import the repo in Vercel
2. Add environment variables:
   - `SESSION_SECRET` — random secret for session token signing
   - `POSTGRES_URL` — Vercel Postgres connection string
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob token
   - `RESEND_API_KEY` — (optional) Resend API key for password reset emails
3. After first deploy, hit `/api/db-init` once to create the Postgres schema
4. Register your admin account via `/register`, then set `is_admin = 1` in the database for admin access

## Roadmap

- [x] **Phase 1** — Core app: calendar, logging, stats, image uploads
- [x] **Phase 2** — Wishlist & price monitoring
- [x] **Phase 3** — Multi-user auth, registration, password reset, feedback
- [x] **Phase 4** — Social feed: profiles, follow/block, wrist shot feed, user search
- [ ] **Phase 5** — Instagram integration

## License

MIT
