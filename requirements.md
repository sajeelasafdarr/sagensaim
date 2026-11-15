# Sage&Saim V1.0 — Requirements (keys & accounts you need to add)

This file lists **every secret, credential, and external account** you must provide to run Sage&Saim V1.0. Nothing here is committed to git. Copy `.env.example` to `.env` and fill in these values.

> The app runs in a **dev/mock mode** with only Clerk + Supabase configured; the social platform credentials are only required to enable *real* publishing. If `SOCIAL_MOCK_MODE=true`, you do not need any social API keys.

---

## 1. Clerk (Authentication) — REQUIRED

Create a Clerk app at https://dashboard.clerk.com

1. Create application → type "Next.js".
2. Enable **Organizations** (used as the tenant boundary).
3. Add redirect URLs for local + prod:
   - Sign-in: `http://localhost:3000/login`, `https://<prod-domain>/login`
   - Home: `http://localhost:3000/app/home`
4. Copy API keys from "API Keys" page.

| Key | Where in Clerk | Env var |
|---|---|---|
| Next.js publishable key | API Keys → "Next.js" | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| Secret key | API Keys → Backend | `CLERK_SECRET_KEY` |

Clerk-provided (set these too, but Clerk can supply defaults):
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/app/home`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/app/home`

> Optional: create a Clerk **JWT template** named `supabase` if you later want Supabase RLS via Clerk JWTs. Not required for V1 (we scope at the app layer).

---

## 2. Supabase (Database + Storage) — REQUIRED

Create a project at https://supabase.com

### Database
1. Project → Settings → Database → "Connection string" → **URI**.
2. Use the **Session pooler / Transaction pooler** connection for Prisma (recommended), or the **Direct connection** for migrations.

| Key | Where | Env var |
|---|---|---|
| Database URL (pooled) | Database → Connection string → URI | `DATABASE_URL` |
| Direct URL (migrations) | Database → Connection string → "Direct connection" | `DIRECT_URL` |

### Storage (media uploads)
1. Project → Storage → create a **public** bucket named `media` (post images/video previews).
   - You can keep it private and use signed URLs; V1 uses a public bucket for previews + a private bucket option later.
2. Project → Settings → API:
   - Project URL
   - `service_role` key (server only — never exposed to browser)
   - `anon` public key (safe for browser, used for direct uploads if you choose that path)

| Key | Where | Env var |
|---|---|---|
| Project URL | Settings → API → Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| Anon public key | Settings → API → Project API keys → `anon` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Service role key | Settings → API → Project API keys → `service_role` | `SUPABASE_SERVICE_ROLE_KEY` |
| Media bucket name | Storage (you create it) | `SUPABASE_MEDIA_BUCKET=media` |

> Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. It bypasses RLS and is used by the API routes/worker to read/write media.

---

## 3. Token encryption — REQUIRED (generate once)

OAuth tokens for connected social accounts are encrypted at rest with AES-256-GCM.

Generate a 32-byte key and base64-encode it. Run any of:

```bash
# Node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

| Key | Env var |
|---|---|
| Base64 32-byte key | `TOKEN_ENCRYPTION_KEY` |

> If you rotate it, existing connected accounts must be reconnected (tokens become undecryptable).

---

## 4. Social platform developer credentials — OPTIONAL unless you want real publishing

> Skip all of these if `SOCIAL_MOCK_MODE=true` (default in dev). They become required when you flip the flag to `false` for a given platform.

### 4a. Instagram (Meta Graph API)
1. https://developers.facebook.com → My Apps → Create App → type "Business".
2. Add products: **Instagram Graph API** + **Facebook Login**.
3. App Settings → Basic → get App ID / App Secret.
4. Instagram Graph API requires a **Facebook Page** linked to an **Instagram Business/Creator account**. Configure Graph API permissions: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`.

| Key | Env var |
|---|---|
| App ID | `META_APP_ID` |
| App secret | `META_APP_SECRET` |
| OAuth redirect URI | `OAUTH_REDIRECT_BASE_URL` + `/api/social-accounts/callback/instagram` |
| Graph API version | `META_GRAPH_API_VERSION=v21.0` |

### 4b. TikTok (Content Posting API)
1. https://developers.tiktok.com → Create app → enable **Content Posting API** + **Login Kit**.
2. Get Client Key + Client Secret.
3. Configure redirect URI to `OAUTH_REDIRECT_BASE_URL + /api/social-accounts/callback/tiktok`.
4. Scopes: `video.upload`, `video.publish`, `user.info.basic`.

| Key | Env var |
|---|---|
| Client key | `TIKTOK_CLIENT_KEY` |
| Client secret | `TIKTOK_CLIENT_SECRET` |

### 4c. WhatsApp (WhatsApp Cloud API via Meta)
1. https://developers.facebook.com → use the same Meta app or create one → add **WhatsApp** product.
2. Get Phone Number ID + WhatsApp Business Account ID + permanent access token.
3. Note: WhatsApp Cloud API supports **text + media messaging**, not "posting to a public feed". The UI will reflect this accurately (no fake feed capability).

| Key | Env var |
|---|---|
| Meta/WhatsApp access token | `WHATSAPP_TOKEN` |
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` |

---

## 5. App behavior flags — REQUIRED (set defaults)

| Key | Env var | Default |
|---|---|---|
| Mock social integrations (no real API calls) | `SOCIAL_MOCK_MODE` | `true` |
| Mock hashtag trending data | `TRENDING_MOCK_MODE` | `true` |
| Base URL of the running app (for OAuth redirects) | `OAUTH_REDIRECT_BASE_URL` | `http://localhost:3000` |
| Node env | `NODE_ENV` | `development` |

---

## 6. Worker (scheduled publishing) — REQUIRED to run the worker

No external service needed. The worker reads `DATABASE_URL` + `TOKEN_ENCRYPTION_KEY` + `SOCIAL_MOCK_MODE`. It shares `.env` with the web app.

Run: `pnpm worker` (separate terminal from `pnpm dev`).

---

## 7. Deployment (later) — not required for local dev

- Frontend: Vercel (or any Node host). Set the same env vars in the host dashboard.
- Worker: a separate small host (Render/Railway/Fly cron worker) or a cron-triggered serverless function. Must share the same `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_*`, and social keys.
- Set `OAUTH_REDIRECT_BASE_URL` to your production domain when you go live.

---

## Quick start checklist

- [ ] Clerk app created; publishable + secret keys set
- [ ] Clerk Organizations enabled
- [ ] Supabase project created; `DATABASE_URL` + `DIRECT_URL` set
- [ ] Supabase `media` storage bucket created; URL + anon + service-role keys set
- [ ] `TOKEN_ENCRYPTION_KEY` generated (32-byte, base64)
- [ ] `.env` copied from `.env.example` and filled in
- [ ] `SOCIAL_MOCK_MODE=true` (dev) — no social keys needed yet
- [ ] Database migrated: `pnpm db:migrate`
- [ ] Seed (optional): `pnpm db:seed`
- [ ] `pnpm dev` (web) + `pnpm worker` (scheduled publishing)

---

## Questions I still need answered from you

1. **Clerk Organizations as the tenant?** I'll use Clerk Organizations = tenants (one Sage&Saim Organization per Clerk org, members share data). If you'd rather have a single org per user for V1, say so.
2. **Default subscription plan name/price?** The reference doc mentions a "Growth Plan $299/mo". Tell me the V1 plan name + price to seed, or I'll use "Marketing Pro / $49/mo" as a placeholder.
3. **Template catalog?** Do you have real templates/prices, or should I seed a few sample templates (some free, some premium) so the Templates page isn't empty? These are just catalog rows, not files.
4. **WhatsApp note:** the official WhatsApp Cloud API does **not** support posting to a public feed — only messaging. V1 will show WhatsApp as "status/messaging only" (no fake feed). Confirm that's acceptable, or drop WhatsApp from V1 publishing.
5. **Local Postgres fallback?** If you don't want to depend on a live Supabase project for local dev, I can add an optional `docker-compose.yml` for local Postgres + a local storage driver. Want that fallback?
