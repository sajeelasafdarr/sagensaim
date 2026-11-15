# Sage&Saim — Marketing & Social Media Management Platform (V1.0)

A multi-tenant SaaS for managing social media, scheduling posts, discovering hashtags, purchasing templates, and requesting custom creative work. Built to be a real, maintainable product — not a mockup.

> Brand: **Sage&Saim — Marketing and Development Agency**

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Auth | Clerk (with Organizations as tenants) |
| Database | PostgreSQL (Supabase), via Prisma ORM |
| Media storage | Supabase Storage (S3-compatible) — with a local-disk dev fallback |
| Styling | Tailwind CSS + CSS-variable design tokens (minimal, premium, light) |
| Icons | lucide-react |
| Validation | Zod (server-side authoritative) |
| Data fetching | Server Components + Server Actions + SWR for client mutations |
| Scheduled publishing | DB-polling Node worker (no Redis) |
| Tests | Vitest |
| Package manager | pnpm |

---

## Prerequisites

- Node.js 18+ (developed on Node 24)
- pnpm 9+ (`npm i -g pnpm`)
- A **Clerk** application (with Organizations enabled)
- A **Supabase** project (Postgres + Storage) — or use the local Docker fallback for offline dev

See **[requirements.md](./requirements.md)** for every key/account you need and where to get it.

---

## Quick start

```bash
# 1. Install
pnpm install

# 2. Configure environment
cp .env.example .env
#   fill in: Clerk keys, Supabase URL + DB + storage keys, TOKEN_ENCRYPTION_KEY
#   keep SOCIAL_MOCK_MODE=true to run without real social API credentials

# 3. Database
pnpm db:generate          # generate Prisma client
pnpm db:migrate           # create/apply migrations (needs DATABASE_URL)
pnpm db:seed              # seed sample templates (optional)

# 4. Run the app (terminal 1)
pnpm dev

# 5. Run the publishing worker (terminal 2) — only needed for scheduled posts
pnpm worker
```

Open http://localhost:3000 → splash → **Tap to continue** → sign in → `/app/home`.

---

## Local (offline) dev fallback

If you don't want to depend on a live Supabase project for local development:

```bash
docker compose up -d db                       # local Postgres
# in .env set:
#   LOCAL_DEV_MODE=true
#   LOCAL_DEV_DATABASE_URL=postgresql://sagesaim:sagesaim@localhost:5432/sagesaim
#   DATABASE_URL=$LOCAL_DEV_DATABASE_URL
#   DIRECT_URL=$LOCAL_DEV_DATABASE_URL
pnpm db:migrate
pnpm dev
```

In local mode, uploaded media is served from disk via `/api/storage/[...key]` instead of Supabase Storage.

---

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build (`prisma generate && next build`) |
| `pnpm start` | Start production server |
| `pnpm worker` | Run the scheduled-publishing worker |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (logic + tenant-isolation) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Create + apply migrations (dev) |
| `pnpm db:migrate:deploy` | Apply migrations (prod) |
| `pnpm db:push` | Push schema without migration history |
| `pnpm db:seed` | Seed sample templates |
| `pnpm db:studio` | Prisma Studio |

---

## Project structure

```
app/
  page.tsx                 # splash screen
  (auth)/                  # login / signup / forgot-password (Clerk)
  app/                     # authenticated shell + pages: home, posts/new, posts/[id],
                           #   calendar, apps, creative, settings, billing, account
  api/                     # REST route handlers (org-scoped)
components/
  ui/                      # design-system primitives (Button, Input, Card, Stat, …)
  nav/                     # sidebar, mobile nav, topbar, app shell
  brand/                   # logo
  post/  apps/  calendar/  creative/  settings/   # feature components
lib/
  db/        # Prisma client
  auth/      # Clerk session → Organization resolution + token crypto
  connectors/# Social provider abstraction (Instagram, TikTok, WhatsApp, Mock)
  services/  # org-scoped business logic (posts, social, hashtags, billing, …)
  storage/   # Supabase + local-disk storage drivers
  trending/  # hashtag trend provider (static/dev for V1)
  validation/# Zod schemas
  constants.ts, utils.ts, api.ts
worker/                    # scheduled publishing poller
prisma/                    # schema.prisma, migrations, seed
tests/                     # vitest specs
docs/                      # architecture, social-integrations, development
public/                    # logo assets
requirements.md            # every key/account you must provide
PLAN.md                    # implementation plan
```

---

## Authentication & multi-tenancy

- **Clerk** is the identity provider. Clerk **Organizations** are the tenant boundary.
- On first authenticated request, the app lazily upserts a matching `Organization` + `OrganizationMember` (see `lib/auth/session.ts`).
- Every tenant-owned record is scoped by `organizationId`. **All** data access goes through a repository/service layer that injects `organizationId`; cross-org access is rejected at the data layer (verified by `tests/tenant-isolation.test.ts`).
- OAuth tokens for connected social accounts are **encrypted at rest** (AES-256-GCM) using `TOKEN_ENCRYPTION_KEY`.

---

## Social integrations

V1 supports **Instagram** (Meta Graph API), **TikTok** (Content Posting API), and **WhatsApp** (Cloud API — messaging/status only, **not** a public feed). All sit behind a `SocialProvider` abstraction so new platforms can be added without touching the UI.

- `SOCIAL_MOCK_MODE=true` (default for dev) → a `MockProvider` returns canned data and performs no real API calls. The UI labels this clearly ("Demo data" / "Mock").
- Real OAuth flows activate once you add platform credentials (see `docs/social-integrations.md`).

> The app never claims unsupported capabilities. If a platform's official API doesn't expose a metric, the UI shows "Metric unavailable for this platform."

---

## Testing

```bash
pnpm test
```

Covers: token crypto, Zod validation, formatters, the mock connector (publish/capabilities/analytics), and tenant isolation (posts + hashtags) by asserting org-scoped queries. External API calls are mocked — tests never touch real social accounts.

---

## Deployment

- **Web:** deploy the Next.js app (Vercel or any Node host). Set the same env vars in the host dashboard.
- **Worker:** run `pnpm worker` on a separate small host (Render/Railway/Fly) or as a cron-triggered serverless function. It shares the same `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_*`, and social keys.
- Set `OAUTH_REDIRECT_BASE_URL` to your production domain when live.
- Run `pnpm db:migrate:deploy` as part of release.

---

## Known limitations (V1)

- Real social publishing requires platform developer credentials (Meta/TikTok/WhatsApp) — not included.
- Billing records purchases/invoices but does **not** process real payments (no Stripe in V1).
- Trending hashtags are static development data behind a provider abstraction (a real trend API can be plugged in later).
- TikTok content analytics are not exposed (public API restricted) — shown as unavailable.
- WhatsApp cannot post to a public feed (messaging/status only) — reflected honestly in the UI.

See `docs/` for architecture, integration setup, and development details.
