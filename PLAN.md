# Sage&Saim V1.0 — Implementation Plan

> Status: Planned. Stack confirmed with owner.
> Target: a real, maintainable V1.0 marketing & social media management SaaS.

## 1. Stack (confirmed)

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Auth | Clerk (`@clerk/nextjs`) |
| DB | PostgreSQL on Supabase, via Prisma ORM |
| Media storage | Supabase Storage (S3-compatible buckets) |
| Styling | Tailwind CSS + CSS-variable design tokens |
| Icons | lucide-react (restrained) |
| Validation | Zod (server-side authoritative) |
| Data fetching | Server Components + Server Actions + SWR for client mutations |
| Queue/worker | DB-polling Node worker (no Redis) |
| Tests | Vitest + Testing Library (+ mocked Prisma / connectors) |
| Package manager | pnpm |
| Logo | `public/logoUpdated.png` |

## 2. Repository structure (single repo, not over-engineered)

```
sagesaim_platform/
  app/                      # Next.js App Router
    (auth)/                 # splash + login + signup + forgot
    (app)/                  # authenticated shell + pages
    api/                    # Route Handlers (REST)
  components/               # reusable UI (presentational)
    ui/                     # primitives: Button, Input, Card, Stat, Empty, Spinner, Toast
    nav/                    # sidebar, mobile nav
  lib/
    db/                     # Prisma client + repository layer (org-scoped access)
    auth/                   # Clerk session -> Organization resolution, guards
    connectors/            # Social provider abstraction
      instagram.ts tiktok.ts whatsapp.ts mock.ts index.ts types.ts
    trending/               # hashtag trend provider abstraction (static/mock for dev)
    storage/                # Supabase storage upload abstraction
    billing/                # invoice/price-at-purchase helpers
    validation/             # zod schemas
  worker/                   # separate Node entry: scheduled publishing poller
  prisma/                   # schema.prisma + migrations + seed
  tests/                    # vitest specs
  public/                   # logos (existing)
  docs/                     # architecture, social-integrations, development
  .env.example
  requirements.md
```

The worker shares `prisma/`, `lib/connectors/`, `lib/db/` with the web app. One `package.json`, one `node_modules`. Run via `pnpm worker`.

## 3. Multi-tenancy model

- Clerk is the identity provider. Clerk `userId` = app user; Clerk `organizationId` = tenant.
- Our `Organization` row mirrors a Clerk organization (stores `clerkOrganizationId`).
- On first authenticated request, we lazily create/match an `Organization` + `OrganizationMember` for the Clerk user/org.
- Every tenant-owned record carries `organizationId` (our DB PK).
- **All data access goes through a repository layer** that injects `organizationId` into every query. Cross-org access is prevented at the data layer + API guards, not just the UI.
- Sensitive OAuth tokens stored in `SocialAccount` **encrypted at rest** (AES-256-GCM, key in `TOKEN_ENCRYPTION_KEY`).

## 4. Core data model (Prisma)

```
User (mirrors Clerk user)
Organization (tenant) ─┬─ OrganizationMember
                       ├─ SocialAccount (platform, handle, encrypted tokens, status)
                       ├─ Post ─┬─ PostMedia (storageKey, mime, size, url)
                       │        └─ PostPlatform (platform, status, scheduledAt, publishedAt, error)
                       ├─ Hashtag (saved, per org)
                       ├─ Template (free/premium, price)
                       ├─ TemplatePurchase (price captured at purchase)
                       ├─ CreativeRequest ─ CreativeRequestFile
                       ├─ Subscription (plan, interval, nextBillingDate)
                       ├─ Invoice ─ InvoiceItem (description, qty, unitPrice, total, currency, productId)
                       ├─ Purchase
                       ├─ Notification
                       └─ AuditLog
```

Post statuses: `DRAFT | SCHEDULED | PROCESSING | PUBLISHED | FAILED | CANCELLED`.
Per-platform status lives on `PostPlatform`.

## 5. API surface (resource-oriented REST)

```
POST   /auth/onboard            # ensure org + membership exist (called after Clerk login)
GET    /organizations/current
GET/POST/PATCH/DELETE  /posts
POST   /posts/:id/schedule
POST   /posts/:id/publish
GET    /calendar?month=&year=
GET/POST/DELETE /hashtags
GET    /hashtags/trending?category=
GET    /social-accounts
POST   /social-accounts/connect/:platform      # start OAuth
GET    /social-accounts/callback/:platform     # OAuth callback
POST   /social-accounts/:id/disconnect
GET    /templates
POST   /template-purchases
GET/POST /creative-requests
PATCH  /creative-requests/:id/status
GET    /billing/subscription
GET    /billing/invoices
GET/POST/PATCH /settings (account, business, notifications, security)
```

All endpoints validate with Zod, resolve org from Clerk session, and never expose tokens.

## 6. Social connector abstraction

```ts
interface SocialProvider {
  connect(userId, code): Promise<AccountInfo>
  disconnect(account): Promise<void>
  getAccount(account): Promise<AccountInfo>
  validateMedia(files, platform): ValidationResult
  publish(account, post): Promise<PublishResult>
  getPostStatus(account, remoteId): Promise<StatusResult>
  getAnalytics(account): Promise<Analytics>
}
```

- `lib/connectors/{instagram,tiktok,whatsapp}.ts` — real official-API implementations.
- `mock.ts` — dev provider (canned responses).
- `index.ts` factory selects by `SOCIAL_MOCK_MODE`. Mock mode clearly labelled in UI (dev only).

## 7. Scheduled publishing

- Posts with `PostPlatform.status = SCHEDULED` and `scheduledAt <= now` are picked up by the worker.
- Worker loop: every 60s → claim due rows (atomic update to PROCESSING) → call provider.publish → write result + error → retry with backoff up to N times → FAILED after exhaustion.
- Runs as `pnpm worker` (separate process, same repo). Production: run on a separate small host or as a cron-triggered serverless function (documented).

## 8. Screen plan (mapping spec → app)

- `/` splash → `Tap to continue` → `/login`
- `/login` `/signup` `/forgot-password` (Clerk-hosted look, themed)
- `/app` shell with sidebar (desktop) + bottom nav (mobile)
  - `/app/home` — empty state + stats + platform trends (empty states until data exists)
  - `/app/posts/new` — composer
  - `/app/calendar` — month grid
  - `/app/apps` — social connections
  - `/app/creative` — templates + request a creative
  - `/app/settings` — account/business/notifications/subscription/security (billing reachable here)
- `/app/billing` — subscription + invoices

## 9. Design tokens (Tailwind + CSS vars)

From the reference doc: bg `#fafafa`, surface `#fff`, border `#e0e0e0`, text `#1a1a1a`/`#666`/`#999`, brand `#667eea`, brand-2 `#764ba2`, success/warning/error standard. 8px card radius, 6px input radius, 44px button height. Minimal, light, spacious.

## 10. Build order (matches spec Steps 4–17)

1. Foundation (Next.js + TS + Tailwind + Clerk + Prisma + Supabase client) + design tokens + UI primitives
2. Auth (Clerk routes, protected layout, org onboarding)
3. Splash + shell + nav
4. Home (empty + stats + trends)
5. Build Post (composer, media, caption, platforms, hashtags saved+trending, schedule)
6. Apps (connect/disconnect, OAuth)
7. Calendar
8. Templates + Creative Requests
9. Billing (model + invoices)
10. Settings
11. Worker
12. Tests
13. Lint/typecheck/test pass
14. UX/UI pass
15. Docs + final report

## 11. What is explicitly NOT in V1

POS, hospital CRM, inventory, AI generation, full accounting, enterprise SSO, ad buying, influencer mgmt, recommendation engine, microservices, Kubernetes, real payment processing, event-driven infra. Billing stores records only — no Stripe charges.

## 12. Known dependencies the owner must provide (see requirements.md)

Clerk keys, Supabase project (DB + Storage), social platform developer credentials (Meta/IG, TikTok, WhatsApp), token encryption key. All via `.env` — never committed.
