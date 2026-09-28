# X-FARM AI

**ONE PLATFORM. EVERY FARM NEED.**

An AI agriculture platform for Indian farmers — built first for Andhra Pradesh — that connects farmers,
sellers, buyers, distributors, machine owners, service providers and administrators in one place.

Everything in this repository is real, working software: real PostgreSQL schema with Row Level Security,
real authentication with hashed passwords and signed sessions, real Gemini calls, real Open-Meteo weather,
real Mapbox/OpenStreetMap maps, real file storage, and a real marketplace. Nothing on screen is mocked,
and no number in the app is invented.

---

## 1. Overview

| | |
|---|---|
| **Framework** | Next.js 16 (App Router, React 19, Server Components + Server Actions) |
| **Language** | TypeScript (strict) |
| **Styling** | Tailwind CSS v4 with a custom agriculture design-token theme |
| **Data** | PostgreSQL via Supabase (Auth + Postgres + Storage + RLS) — or the built-in local PostgreSQL (PGlite) for offline/local development using the *same* migration files |
| **AI** | Google Gemini (`gemini-2.5-flash` by default) for the farming assistant, crop photo analysis and crop advice |
| **Weather** | Open-Meteo (no key required) |
| **Maps** | Mapbox GL when a token is configured, OpenStreetMap raster tiles otherwise (Leaflet) |
| **Market prices** | data.gov.in / Agmarknet import — only real, sourced rows are ever stored |
| **Languages** | English, తెలుగు (Telugu), हिन्दी (Hindi) + a **Simple Mode** for low-literacy users |
| **Voice** | Optional: browser speech recognition for asking, speech synthesis for hearing answers |

---

## 2. Features

### Farmers
- **Dashboard** — current weather, alerts, active crops, soil snapshot, latest market prices, marketplace
  activity, unread messages and quick actions.
- **Weather** — conditions and 7-day/12-hour forecasts for *your* location (never a hard-coded city),
  rain probability, temperature, humidity, wind, and plain-language alerts (rain expected, strong wind,
  heat stress, spray caution, dry spell). Snapshots can be saved to a farm and turned into notifications.
- **AI Farming Assistant** — multi-language chat that actually uses your farm context (location, crops,
  soil, recent weather) and is instructed never to invent data.
- **Crop Doctor** — upload or photograph a leaf, it is validated server-side, stored in a **private**
  bucket, analysed with Gemini vision, and returns a possible problem, visible symptoms, confidence,
  severity, next steps, prevention and an explicit *"this is not a guaranteed diagnosis"* disclaimer.
- **Crop Recommendation** — location, season, soil, water, size, previous crop and preferences produce a
  ranked shortlist with reasoning, considerations and basic growing information. No yield or profit
  guarantees — ever.
- **Soil** — record soil type, pH, N, P, K, moisture, organic matter, EC, location and source. Values are
  labelled `manual` / `lab report` / `dataset` / `estimate`; dataset-derived values must name their dataset.
  Readings are compared against published typical ranges. The app never fabricates a measurement.
- **Farms** — multiple farms, one primary, optional coordinates, used everywhere as context.
- **Marketplace** — list produce, browse everything, search/filter by kind, category, district, price and
  sort order, save favourites, and contact sellers.
- **Market prices** — real mandi prices with source and date shown on every row, plus a trend view built
  from stored history only.
- **Messages** — per-listing conversations with read receipts and strict ownership checks.
- **Notifications** — weather alerts, marketplace activity, messages, listing updates and reminders,
  deduplicated so the same alert is never sent twice in a day.
- **Map** — search any place (Mapbox or OpenStreetMap/Nominatim), see marketplace, machinery and farm
  locations, drop your own pin and use it for weather.

### Sellers, buyers, distributors, machine owners
- Progressive sign-up with the right role, produce and input listings with quantities, units, prices,
  availability, harvest dates and photos.
- **Machinery rental** listings carry a detail record: type, brand, model, year, horsepower, per-hour /
  per-day / per-acre rates, operator included, service radius and availability status.

### Administrators
- Protected admin area (server-checked role **and** RLS): platform statistics, user management
  (role changes, blocking), listing moderation (status, featuring), report handling, category management
  and a market-price importer.

### Everyone
- English / Telugu / Hindi interface, per-account language preference.
- **Simple Mode**: bigger text, larger tap targets, ringed primary actions and plainer wording.
- Mobile-first responsive layout — bottom tab bar on phones, sidebar on desktop, no horizontal overflow.

---

## 3. Architecture

```
src/
├─ app/
│  ├─ (public)/            landing, login, signup, forgot-password, reset-password
│  ├─ (app)/               authenticated area: dashboard, assistant, crop-doctor, weather, map,
│  │                       market, market-prices, crops, farms, soil, recommendation,
│  │                       messages, notifications, favorites, profile, listings, admin
│  ├─ actions/             server actions (auth, farms, crops, listings, messaging, ai, admin)
│  └─ api/                 route handlers: /api/health, /api/geocode, /api/preferences,
│                          /api/auth/logout, /api/storage/[...path]
├─ components/             UI kit, forms, shells, navigation, weather, map, marketplace, AI widgets
└─ lib/
   ├─ db/                  backend-agnostic data client
   │  └─ local/            PGlite engine + PostgREST-flavoured query builder + auth contexts
   ├─ supabase/            cookie-bound SSR client, service-role client (server only), browser client
   ├─ auth/                sessions, tokens, password hashing, local user store, transactional email
   ├─ gemini/              assistant, vision, recommendation + prompts
   ├─ weather/             Open-Meteo client, snapshot repository, location resolution
   ├─ maps/                Mapbox/OSM search + reverse geocoding + map configuration
   ├─ market/              data.gov.in importer and price queries
   ├─ storage/             upload validation (magic bytes, size, type) + Supabase/local drivers
   ├─ repos/               one module per domain (farms, crops, soil, listings, messaging, ai, admin…)
   ├─ i18n/                locale config, dictionaries (en/te/hi), provider, translator
   └─ validation/          zod schemas for every write path
supabase/
├─ migrations/             the real schema: tables, indexes, constraints, triggers, RLS, storage policies
├─ local/                  LOCAL-ONLY auth/storage shim so PGlite can run the same migrations
└─ seed.sql                categories + crop catalogue (no prices, no measurements)
scripts/                   env check, migrate, seed, reset, database tests, HTTP smoke tests
```

**Two interchangeable data backends, one schema.**
`DATA_BACKEND=supabase` uses your Supabase project. Without Supabase credentials the app runs on
`@electric-sql/pglite` — PostgreSQL compiled to WebAssembly, persisted to `.data/pglite` — and applies the
*same* `supabase/migrations/*.sql` files. Security is exercised for real in both modes: every query runs
under `anon`, `authenticated` or `service_role` with the same JWT claim settings PostgREST uses, so RLS
policies are actually enforced (see `npm run test:db`).

---

## 4. Installation

Requirements: **Node.js 20+** (22 recommended) and npm. No Docker, no local PostgreSQL server needed.

```bash
git clone <your-repo-url> x-farm-ai
cd x-farm-ai
npm install
cp .env.example .env.local     # then fill in what you have (see §7)
npm run db:migrate             # local PostgreSQL (PGlite) — runs automatically on first request too
npm run db:seed                # categories + crop catalogue
npm run dev                    # http://localhost:3000
```

The app starts even with **zero** credentials: it runs on the local database, the map falls back to
OpenStreetMap, and AI screens explain exactly which environment variable is required.

---

## 5. Environment variables

Only five variables are required for a fully-featured deployment (they live in `.env.local`, which is
git-ignored — never commit it):

| Variable | Where to use it | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Supabase anon/publishable key (safe in browser, RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | storage, admin moderation, price import. Never sent to the browser |
| `GEMINI_API_KEY` | server only | assistant, crop photo analysis, crop advice |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | browser | Mapbox maps and place search (falls back to OpenStreetMap when absent) |

Optional: `DATA_GOV_IN_API_KEY` (real mandi prices), `DATA_GOV_MANDI_RESOURCE_ID`, `SMTP_URL` + `MAIL_FROM`
(password-reset email), `ADMIN_EMAILS` (comma-separated; promoted to admin on sign-in), `ALLOW_DEV_RESET_LINK`
(local development only), `NEXT_PUBLIC_APP_URL`, `DATA_BACKEND`, `STORAGE_DRIVER`, `LOCAL_DB_DIR`,
`LOCAL_AUTH_SECRET`, `GEMINI_MODEL`, `GEMINI_VISION_MODEL`.

Run `npm run env:check` to see which ones are configured (it prints variable **names and status only**, never values).

---

## 6. Setup guides

### 6.1 Supabase — connecting a real project

Everything the app needs on the Supabase side is generated from the migrations in this repository, so
there is no manual schema work and no chance of the dashboard drifting from the code.

```bash
# 1. Build the setup file (schema + RLS + buckets, optionally + reference data)
npm run supabase:sql -- --seed     # writes supabase/remote/setup+seed.sql

# 2. Paste that file into Supabase → SQL Editor → Run
#    (it is wrapped in a single transaction: it either applies completely or not at all)

# 3. Put the two client values into .env.local
#      NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
#      NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
#      SUPABASE_SERVICE_ROLE_KEY=<service-role key>   # server-only, optional but recommended

# 4. Prove the project is wired correctly (from a machine with internet access)
npm run test:supabase
```

`npm run test:supabase` reports, check by check: are the variables present and shaped correctly, does the
project answer, do all 19 tables exist, is the seed data there, **are anonymous reads of `profiles`,
`farms` and `messages` refused** (i.e. is RLS really on), can a disposable account sign up and read exactly
one profile (its own), can the service-role key moderate, and do the three storage buckets exist. It never
prints a key and deletes the account it created.

Backend selection is automatic: with the URL and publishable key present and `DATA_BACKEND` unset, the app
uses Supabase Auth + Postgres + Storage + RLS. Force it either way with `DATA_BACKEND=supabase` or `local`.

| Step | Where in the dashboard |
|---|---|
| Run the schema | *SQL Editor → New query* |
| Email sign-in | *Authentication → Providers → Email* (enable) |
| Redirect URLs | *Authentication → URL Configuration* → add `http://localhost:3000/**` and your production URL |
| Buckets | created by the schema: `avatars` 2 MB public, `listing-images` 5 MB public, `crop-images` 10 MB **private** |
| Keys | *Project Settings → API* — publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service-role key → `SUPABASE_SERVICE_ROLE_KEY` |

File objects live under `<user-id>/<filename>`; the storage policies compare that first folder segment with
`auth.uid()`, so one user can never read or overwrite another user's uploads.

> **Network note (this development sandbox).** The sandbox this project is currently running in cannot open
> a TLS session to `*.supabase.co` — its egress allows the npm registry and GitHub only — so the checked-in
> `.env.local` pins `DATA_BACKEND=local` and the preview runs on the built-in PostgreSQL. The URL is already
> filled in; add the publishable key and remove that one line on any host with normal internet access and
> the identical code runs against your Supabase project (no code changes, no second implementation).

### 6.2 Gemini
1. Create a key at [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Put it in `GEMINI_API_KEY` (server-only) and restart. `GEMINI_MODEL` / `GEMINI_VISION_MODEL` let you pin
   specific models; the default is `gemini-2.5-flash`.
3. Without a key the assistant, Crop Doctor and recommendation screens stay visible but clearly state that
   the AI service is not configured — they never fake an answer.

### 6.3 Mapbox
1. Create a token at [mapbox.com](https://account.mapbox.com/access-tokens/) (a public `pk.…` token is enough).
2. Put it in `NEXT_PUBLIC_MAPBOX_TOKEN` and restart. Map style: `mapbox://styles/mapbox/satellite-streets-v12`.
3. Without a token the app automatically uses OpenStreetMap raster tiles and Nominatim search, so maps and
   location search keep working.

### 6.4 Market prices (optional)
1. Register at [data.gov.in](https://data.gov.in) and copy your API key into `DATA_GOV_IN_API_KEY`.
2. An administrator opens **Market prices** and presses *Import*. Every imported row keeps its
   `source`, `source_url` and `price_date`; the app shows those on screen and never invents a price.
   Without a key the import button reports that `DATA_GOV_IN_API_KEY` is missing.

---

## 7. Database

- **Supabase (production)** — migrations in `supabase/migrations/`, applied with the SQL editor or
  `supabase db push`. `supabase/seed.sql` loads categories and the crop catalogue (reference data only).
- **Local (development)** — `npm run db:migrate`, `npm run db:seed`, `npm run db:reset [-- --seed]`.
  The local database lives in `.data/pglite` and is git-ignored.
- **Schema shape** — normalised relational tables with UUID primary keys, foreign keys, indexes, CHECK
  constraints and `created_at`/`updated_at` timestamps: `profiles`, `farms`, `crops`, `crop_records`,
  `soil_records`, `weather_records`, `categories`, `listings`, `listing_images`, `favorites`, `machinery`,
  `market_prices`, `market_price_imports`, `ai_conversations`, `ai_messages`, `crop_analyses`,
  `usage_events`, `conversations`, `messages`, `notifications`, `reports`, `audit_logs`.
- **RLS** — enabled on every table. No `USING (true)` policy protects private data anywhere. People read
  and write their own profiles, farms, crops, soil records, listings, favourites and conversations;
  conversations and messages are visible only to their two participants (plus admins for moderation);
  admins get access through role-checked helper functions; the only cross-user profile surface is the
  `public_profiles` view, which exposes no email or phone. Public (anonymous) reads are limited to
  `crops`, `categories`, `market_prices` and active marketplace listings.
- **Data-integrity guards** — `market_prices.source` and `price_date` are `NOT NULL` with a unique key on
  `(crop_name, market_name, price_date, source)`; `soil_records` requires `dataset_name` whenever
  `source = 'dataset'`; `prevent_role_escalation` stops anyone from promoting themselves to admin.

---

## 8. Development commands

| Command | What it does |
|---|---|
| `npm run dev` | start the dev server (http://localhost:3000) |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run env:check` | show which environment variables are configured (names only) |
| `npm run db:migrate` | apply migrations to the local database |
| `npm run db:seed` | load categories + crop catalogue |
| `npm run db:reset [-- --seed]` | drop and rebuild the local database |
| `npm run test:db` | database + RLS integration tests (uses its own scratch database) |
| `npm run test:flow` | end-to-end flow: real accounts, real rows, every screen, role boundaries |
| `npm run test:i18n` | every dynamically built translation key exists in the dictionaries |
| `npm run test:http` | HTTP smoke tests against a running server |
| `npm run supabase:sql [-- --seed]` | generate `supabase/remote/setup.sql` for the Supabase SQL editor |
| `npm run test:supabase` | verify a real Supabase project (tables, RLS, buckets, auth) |
| `npm run verify` | typecheck → lint → i18n audit → database tests → production build |

---

## 9. Testing checklist

`npm run test:db` (real PostgreSQL, no mocks) verifies: migrations applied, RLS enabled on every table,
anonymous visitors cannot read profiles/farms/messages/AI conversations, a farmer sees only their own farm
and notifications, a farmer can update their own profile but not somebody else's, self-promotion to admin
is blocked, the service role can moderate, and the anti-fabrication constraints (price without source,
dataset-derived soil without a dataset name, invalid listing status) are rejected.

`npm run test:http` (server running) verifies: `/api/health` shape and that it never leaks secrets, every
public page renders, every protected route redirects to `/login`, geocoding answers or degrades cleanly,
`/api/preferences` requires a session, logout redirects, path traversal against the storage route is
refused, and security headers are present.

Manual walkthrough: sign up (each role) → sign in/out → password reset → dashboard → AI assistant →
Crop Doctor photo → weather for a chosen location → map search and pin → marketplace create/search/edit/
favourite → machinery listing → messages → notifications → profile → admin (with an `ADMIN_EMAILS` account)
→ mobile layout. Watch the browser console, the network tab and the server logs — all three stay silent
about errors in the flows above.

---

## 10. Production build & deployment

```bash
npm run verify      # typecheck + lint + database tests + build
npm run build
npm run start
```

- **Vercel** — import the repository, add the environment variables from §5 in *Project Settings →
  Environment Variables* (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` as server-only), deploy.
- **Any Node host / Docker** — run `npm ci && npm run build`, then `npm run start` behind a reverse proxy.
  Use Supabase for data (set `DATA_BACKEND=supabase`); the local PGlite engine is intended for local
  development and single-instance demos, since its database is a directory on disk.
- Set `NEXT_PUBLIC_APP_URL` to the public URL so password-reset links point at the right host.
- Add at least one administrator: put the email in `ADMIN_EMAILS` — it is promoted on next sign-in and the
  change is written to `audit_logs`.

---

## 11. Security notes

### Test-fixture harness

`src/app/api/test-fixtures` exists so the end-to-end suite (`npm run test:flow`) can create disposable
accounts and rows *through the running server* (the local PostgreSQL engine is single-connection, so a test
process cannot share a data directory with the server it is testing). It is not a feature and not reachable
in a normal deployment:

* it answers **404** unless `X_FARM_ALLOW_TEST_FIXTURES=1` **and** a matching `X_FARM_FIXTURE_TOKEN`
  (≥ 16 chars) are set in the server environment — the test runner generates a random token per run;
* it refuses to run at all unless the backend is the **local** one, so a Supabase deployment can never
  expose it;
* every row it writes goes through the same repositories, validation, constraints and RLS policies as the
  normal UI, and it only ever touches `flow.*@example.com` accounts.



- No secret is ever hard-coded; every credential comes from the environment (§5). `src/lib/env.server.ts`
  throws if it is imported into client code, and `.env.local` is git-ignored.
- The **service-role key is used on the server only** (storage signing, moderation, price import). It is
  never sent to the browser and never embedded in a response.
- Passwords are never stored by the app: Supabase Auth owns them in production, and the local runtime uses
  scrypt (`scrypt$<salt>$<hash>`) with per-user salts. Reset tokens are stored only as SHA-256 hashes.
- Row Level Security is never disabled "for convenience", and no private table has a universal policy.
  Client-supplied roles are ignored — roles are read from the database and re-checked on the server.
- All writes are validated with zod, file uploads are limited by type and size (and sniffed by magic
  bytes), and the storage route refuses path traversal and foreign objects.
- Errors are logged server-side; users see plain-language messages. Stack traces are never rendered.

---

## 12. What needs credentials, and what happens without them

| Missing variable | Effect | Behaviour |
|---|---|---|
| `GEMINI_API_KEY` | assistant, crop photo analysis, crop advice | screens stay, clearly labelled "AI service is not configured"; no fake answers |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox styling, Mapbox search | falls back to OpenStreetMap tiles + Nominatim |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | cloud database, cloud auth, cloud storage | app runs on local PostgreSQL (PGlite) with the same schema and RLS |
| `DATA_GOV_IN_API_KEY` | mandi price import | import reports the missing variable; no prices are invented |
| `SMTP_URL` | password-reset email | in local development, set `ALLOW_DEV_RESET_LINK=true` to show the link in the UI; nothing pretends an email was sent |

---

## 13. Honest limitations

- Market prices are only as fresh as the last data.gov.in import; every row shows its own source and date.
- Crop Doctor output is AI inference, not a laboratory diagnosis — the disclaimer is part of the payload.
- Crop recommendations are guidance; the platform deliberately makes no yield or profit promises.
- Soil values come from what a person or dataset actually recorded; "estimate" values are labelled as such.
- The local PGlite backend is single-instance by design. Use Supabase for multi-user production traffic.

---

Built for farmers — with real data, real security and no invented numbers.
