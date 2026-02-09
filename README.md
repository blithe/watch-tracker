# ⌚ Watch Tracker

A personal watch collection and wear-tracking app. Log which watch you're wearing each day, browse your history on a calendar, and see stats about your rotation.

Built with Next.js 14, TypeScript, SQLite, and Tailwind CSS.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![SQLite](https://img.shields.io/badge/SQLite-3-003B57) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8)

## Features

- **Calendar view** — See which watch you wore on any given day
- **Day detail** — Tap a day to see the full entry with wrist shot
- **Log a wear** — Record today's watch with optional photo and notes
- **Stats dashboard** — Most-worn watches, streak tracking, collection overview
- **Image uploads** — Upload wrist shots stored locally in `public/uploads/`
- **Dark mode** — Tailwind dark theme throughout

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
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

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
watch-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Calendar view (home)
│   │   ├── layout.tsx            # Root layout + nav
│   │   ├── globals.css           # Tailwind base styles
│   │   ├── log/page.tsx          # Log a new wear entry
│   │   ├── day/[date]/page.tsx   # Day detail view
│   │   ├── stats/page.tsx        # Stats dashboard
│   │   └── api/
│   │       ├── watches/route.ts  # CRUD for watch collection
│   │       ├── wear-log/route.ts # CRUD for wear log entries
│   │       └── upload/route.ts   # Image upload handler
│   └── lib/
│       └── db.ts                 # SQLite connection + schema + types
├── public/
│   └── uploads/                  # Uploaded wrist shots (gitignored)
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
  created_at TEXT DEFAULT (datetime('now'))
);

-- One entry per day — which watch you wore
CREATE TABLE wear_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL,
  date TEXT NOT NULL UNIQUE,
  image_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (watch_id) REFERENCES watches(id)
);
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/watches` | List all watches |
| `POST` | `/api/watches` | Add a new watch |
| `GET` | `/api/wear-log` | Get wear log (supports `?month=YYYY-MM`) |
| `POST` | `/api/wear-log` | Log a wear entry |
| `POST` | `/api/upload` | Upload an image, returns `{ url }` |

## Roadmap

- [x] **Phase 1** — Core app: calendar, logging, stats, image uploads
- [ ] **Phase 2** — Wishlist & price monitoring
- [ ] **Phase 3** — Multi-user auth & deployment
- [ ] **Phase 4** — Instagram integration

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/cool-thing`)
3. Commit your changes
4. Push and open a PR

## License

MIT
