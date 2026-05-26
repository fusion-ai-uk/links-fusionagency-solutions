# Email Link Tracking — Fusion Agency Solutions

Private **campaign-level** email open and click tracking for IMI marketing emails.

**Production domain:** [https://links.vercel.app](https://links.vercel.app)

This service logs estimated email opens via a 1×1 tracking pixel and CTA clicks via allowlisted redirect links. It includes a password-protected admin dashboard and CSV export.

---

## Campaign-level tracking limitation

Because IMI is **not** providing recipient IDs or merge tags, this system tracks **campaign-level opens and clicks only**.

**We can track:**

- Total opens
- Total clicks
- Clicks by CTA/link
- Campaign-level performance
- Rough location where available
- Approximate unique users based on hashed IP and user agent

**We cannot reliably track:**

- Individual recipients
- Exact unique opens
- Exact unique clicks
- Recipient-level journeys

Approximate unique metrics in the dashboard use distinct combinations of `campaign_id + event_type + ip_hash + user_agent`. These are labelled as approximate and must not be treated as recipient counts.

---

## Features

| Endpoint | Purpose |
|----------|---------|
| `GET /o?cid={campaign_id}` | Open tracking pixel (returns 1×1 GIF) |
| `GET /c/[linkId]?cid={campaign_id}` | Click tracking redirect |
| `GET /health` | Health check (includes DB connectivity) |
| `GET /admin` | Admin dashboard |
| `GET /admin/export.csv` | CSV export of all events |
| `GET /examples` | Email HTML snippet reference |

---

## Tech stack

- **Next.js 15** (App Router, TypeScript)
- **Prisma** + **PostgreSQL**
- Deployed on **Vercel**

---

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL (local, Docker, or a cloud dev instance)
- npm

### 1. Clone and install

```bash
git clone https://github.com/fusion-ai-uk/links-fusionagency-solutions.git
cd links-fusionagency-solutions
npm install
```

### 2. Environment variables

Copy the example file and fill in values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_POSTGRES_PRISMA_URL` | Yes (Vercel) | Prisma pooled connection — set automatically by Vercel Neon/Postgres |
| `DATABASE_URL_UNPOOLED` | Yes (Vercel) | Direct connection for migrations — set automatically by Vercel Neon/Postgres |
| `DATABASE_URL` | Vercel sets this too | Present on Vercel but Prisma uses the two vars above |
| `ADMIN_PASSWORD` | Yes | Password for `/admin` login |
| `IP_HASH_SECRET` | Yes | Secret for HMAC-hashing client IPs (e.g. `openssl rand -hex 32`) |

Locally, set `DATABASE_POSTGRES_PRISMA_URL` and `DATABASE_URL_UNPOOLED` to the same Postgres URL (or use `vercel env pull .env.local`).

No IMI-related environment variables are required.

### 3. Database setup

Run migrations against your database:

```bash
npx prisma migrate deploy
```

For local development you can also use:

```bash
npm run db:migrate
```

This creates the `email_events` table defined in `prisma/schema.prisma`.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables (Vercel)

**Vercel Neon/Postgres storage** (already connected) automatically adds `DATABASE_POSTGRES_PRISMA_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_URL`, and related vars.

You must add these manually in **Vercel → Settings → Environment Variables**:

| Variable | Notes |
|----------|-------|
| `ADMIN_PASSWORD` | Strong password for dashboard access |
| `IP_HASH_SECRET` | Random 32+ byte hex string; **must stay stable** or historical IP hashes become incomparable |

After adding storage or env vars, **redeploy** so serverless functions receive them. The build runs `prisma migrate deploy` to create tables automatically.

---

## Vercel deployment

### From GitHub

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com), **Add New Project** → import `fusion-ai-uk/links-fusionagency-solutions`.
3. Framework preset: **Next.js** (auto-detected).
4. Connect Vercel Postgres/Neon storage (adds database env vars automatically).
5. Add `ADMIN_PASSWORD` and `IP_HASH_SECRET`.
6. Deploy (migrations run during build).

The build runs `prisma migrate deploy && prisma generate && next build` via `package.json`.

### Run migrations on production

After the first deploy, run migrations against your production database:

```bash
vercel env pull .env.local
npx prisma migrate deploy
```

Or use your provider's SQL console to apply `prisma/migrations/20250520000000_init/migration.sql`.

---

## Production URL on Vercel

The tracking service is served at the Vercel production URL:

**https://links.vercel.app**

Use this base URL in all email HTML snippets and IMI handover docs. Routes are unchanged: `/o`, `/c/[linkId]`, `/admin`, `/health`.

### Verification after deploy

Confirm:
  - [https://links.vercel.app/health](https://links.vercel.app/health) returns `{ "status": "ok", ... }`
  - [https://links.vercel.app/admin](https://links.vercel.app/admin) shows the login page
  - [https://links.vercel.app/examples](https://links.vercel.app/examples) shows HTML snippets

If you add a custom domain later, update the URLs in your email templates accordingly.

---

## Adding / updating tracked links

Edit `src/config/links.ts`:

```typescript
export const linkDestinations: Record<string, string> = {
  "hero-button": "https://yoursite.com/landing?utm_source=imi&...",
  "secondary-cta": "https://yoursite.com/contact?utm_source=imi&...",
};
```

- **Key** = link ID used in URLs: `/c/hero-button?cid=...`
- **Value** = full destination URL (include UTM params here)
- Commit and redeploy after changes

**Security:** Destination URLs are **never** taken from query strings. Unknown link IDs return 404. This prevents open-redirect abuse.

---

## Instructions for the email HTML build

- Add the open pixel once near the bottom of the email HTML, ideally before `</body>`
- Replace only the CTA/button links you want to track
- Use `/c/LINK_ID?cid=CAMPAIGN_ID` for tracked links
- Do not change unsubscribe links
- Do not change preference centre links
- Do not change legal or compliance links
- Do not add raw email addresses to URLs
- **No IMI merge tags are needed**

See also [/examples](https://links.vercel.app/examples) when deployed.

---

## Email HTML snippets

### Open pixel

```html
<img src="https://links.vercel.app/o?cid=CAMPAIGN_ID" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />
```

### Tracked CTA

```html
<a href="https://links.vercel.app/c/LINK_ID?cid=CAMPAIGN_ID">CTA text</a>
```

### Real example

```html
<img src="https://links.vercel.app/o?cid=imi-lyvdelzi-may-2026" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />

<a href="https://links.vercel.app/c/learn-more?cid=imi-lyvdelzi-may-2026">Learn more</a>
```

---

## Testing locally

### Open pixel

```bash
curl -i "http://localhost:3000/o?cid=imi-lyvdelzi-may-2026"
```

Expect: `200`, `Content-Type: image/gif`, `Cache-Control: no-store`, binary GIF body.

Or open in a browser:

```
http://localhost:3000/o?cid=imi-lyvdelzi-may-2026
```

Check `/admin` for a new **open** event.

Missing `cid` still returns the pixel but logs `campaign_id` as `unknown`:

```bash
curl -i "http://localhost:3000/o"
```

### Click redirect

```bash
curl -i "http://localhost:3000/c/hero-button?cid=imi-lyvdelzi-may-2026"
```

Expect: `302` redirect to the URL in `src/config/links.ts`.

Unknown link ID:

```bash
curl -i "http://localhost:3000/c/not-configured?cid=test"
```

Expect: `404` JSON error.

### Health check

```bash
curl http://localhost:3000/health
```

### Admin & CSV

1. Set `ADMIN_PASSWORD` in `.env`.
2. Visit [http://localhost:3000/admin](http://localhost:3000/admin).
3. Export: [http://localhost:3000/admin/export.csv](http://localhost:3000/admin/export.csv) (requires login cookie).

---

## Open tracking limitations

Email open counts are **estimates only**:

- **Apple Mail Privacy Protection** and similar features preload images via proxy servers.
- **Gmail** may cache or proxy images.
- Some clients block images by default.
- Security scanners and bots may request the pixel (`is_bot` is recorded but traffic is not blocked).
- Without recipient IDs, opens cannot be attributed to individual people.

Use opens as a directional signal; rely on click tracking for stronger engagement data.

---

## Privacy notes

- **No raw email addresses** in URLs or database.
- **No raw IP addresses** stored. IPs are HMAC-SHA256 hashed with `IP_HASH_SECRET`.
- **Location** is coarse only (country / region / city from Vercel geo headers when available).
- User agents are stored for bot detection and approximate deduplication.
- `recipient_token` and `message_id` columns exist for legacy compatibility but are not used in default tracking URLs.

---

## Database schema

`email_events` table:

| Column | Description |
|--------|-------------|
| `id` | Primary key (cuid) |
| `event_type` | `open` or `click` |
| `campaign_id` | From `cid` query param (`unknown` if missing) |
| `link_id` | Click only — allowlisted link key |
| `destination_url` | Click only — resolved destination |
| `ip_hash` | HMAC hash of client IP |
| `ip_country`, `ip_region`, `ip_city` | Coarse geo from Vercel headers |
| `user_agent` | Raw user agent string |
| `is_bot` | Bot/scanner heuristic flag |
| `created_at` | Event timestamp |
| `recipient_token` | Nullable legacy field (not used by default) |
| `message_id` | Nullable legacy field (not used by default) |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm start` | Start production server |
| `npm run db:migrate` | Create/apply dev migrations |
| `npm run db:push` | Push schema without migration (dev only) |
| `npm run db:studio` | Open Prisma Studio |

---

## Project structure

```
src/
  app/
    o/route.ts              # Open pixel
    c/[linkId]/route.ts     # Click redirect
    health/route.ts         # Health check
    admin/                  # Dashboard + CSV export
    examples/page.tsx       # HTML snippets
  config/
    links.ts                # Allowlisted click destinations
  lib/
    tracking.ts             # Event logging
    auth.ts                 # Admin session
    dashboard.ts            # Stats queries
    ip-hash.ts              # IP hashing
    geo.ts                  # Vercel geo headers
    bot-detect.ts           # Bot UA detection
prisma/
  schema.prisma
  migrations/
```

---

## License

Private — Fusion Agency Solutions / Fusion AI UK.
