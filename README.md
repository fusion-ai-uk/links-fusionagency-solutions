# Email Link Tracking — Fusion Agency Solutions

Private email open and click tracking service for IMI marketing campaigns.

**Production domain:** [https://links.fusionagency.solutions](https://links.fusionagency.solutions)

This service logs estimated email opens via a 1×1 tracking pixel and CTA clicks via allowlisted redirect links. It includes a password-protected admin dashboard and CSV export.

---

## Features

| Endpoint | Purpose |
|----------|---------|
| `GET /o?cid=&rid=&mid=` | Open tracking pixel (returns 1×1 GIF) |
| `GET /c/[linkId]?cid=&rid=&mid=` | Click tracking redirect |
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
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ADMIN_PASSWORD` | Yes | Password for `/admin` login |
| `IP_HASH_SECRET` | Yes | Secret for HMAC-hashing client IPs (e.g. `openssl rand -hex 32`) |

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

Add these in **Vercel → Project → Settings → Environment Variables** for Production (and Preview if desired):

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Use Vercel Postgres, Neon, Supabase, or another managed Postgres provider |
| `ADMIN_PASSWORD` | Strong password for dashboard access |
| `IP_HASH_SECRET` | Random 32+ byte hex string; **must stay stable** or historical IP hashes become incomparable |

---

## Vercel deployment

### From GitHub

1. Push this repo to GitHub (see below).
2. In [Vercel](https://vercel.com), **Add New Project** → import `fusion-ai-uk/links-fusionagency-solutions`.
3. Framework preset: **Next.js** (auto-detected).
4. Add the three environment variables above.
5. Deploy.

The build runs `prisma generate && next build` automatically via `package.json`.

### Run migrations on production

After the first deploy, run migrations against your production database:

```bash
DATABASE_URL="your-production-url" npx prisma migrate deploy
```

Or use your provider's SQL console to apply `prisma/migrations/20250520000000_init/migration.sql`.

---

## Custom domain: links.fusionagency.solutions

### In Vercel

1. Go to **Project → Settings → Domains**.
2. Add `links.fusionagency.solutions`.
3. Vercel will show the required DNS records.

### DNS configuration

In your DNS provider for `fusionagency.solutions`, add:

**Option A — CNAME (recommended for subdomains)**

| Type | Name | Value |
|------|------|-------|
| CNAME | `links` | `cname.vercel-dns.com` |

**Option B — If Vercel provides a specific target**

Use the exact CNAME or A record values shown in the Vercel domain settings panel.

### Verification

- Wait for DNS propagation (usually minutes, can take up to 48 hours).
- Vercel will issue an SSL certificate automatically.
- Confirm:
  - [https://links.fusionagency.solutions/health](https://links.fusionagency.solutions/health) returns `{ "status": "ok", ... }`
  - [https://links.fusionagency.solutions/admin](https://links.fusionagency.solutions/admin) shows the login page

---

## Adding / updating tracked links

Edit `src/config/links.ts`:

```typescript
export const linkDestinations: Record<string, string> = {
  "hero-button": "https://yoursite.com/landing?utm_source=imi&...",
  "secondary-cta": "https://yoursite.com/contact?utm_source=imi&...",
};
```

- **Key** = link ID used in URLs: `/c/hero-button?...`
- **Value** = full destination URL (include UTM params here)
- Commit and redeploy after changes

**Security:** Destination URLs are **never** taken from query strings. Unknown link IDs return 404. This prevents open-redirect abuse.

---

## Email HTML snippets

See also [/examples](https://links.fusionagency.solutions/examples) when deployed.

### Open pixel

```html
<img src="https://links.fusionagency.solutions/o?cid=CAMPAIGN_ID&rid=RECIPIENT_TOKEN&mid=MESSAGE_ID" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />
```

### Tracked CTA

```html
<a href="https://links.fusionagency.solutions/c/hero-button?cid=CAMPAIGN_ID&rid=RECIPIENT_TOKEN&mid=MESSAGE_ID">Learn more</a>
```

### Do not modify

Do **not** wrap unsubscribe, preference centre, legal, or compliance links with this tracker. Those must remain direct URLs.

---

## Testing locally

### Open pixel

```bash
curl -i "http://localhost:3000/o?cid=test-campaign&rid=recipient-123&mid=msg-456"
```

Expect: `200`, `Content-Type: image/gif`, `Cache-Control: no-store`, binary GIF body.

Or open in a browser:

```
http://localhost:3000/o?cid=test-campaign&rid=recipient-123&mid=msg-456
```

Check `/admin` for a new **open** event.

### Click redirect

```bash
curl -i "http://localhost:3000/c/hero-button?cid=test-campaign&rid=recipient-123&mid=msg-456"
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
- Multiple opens from the same recipient are counted in total opens; unique opens dedupe by `recipient_token`.

Use opens as a directional signal; rely on click tracking for stronger engagement data.

---

## Privacy notes

- **No raw email addresses** are stored or required in URLs. `recipient_token` is an opaque ID from IMI.
- **No raw IP addresses** are stored. IPs are HMAC-SHA256 hashed with `IP_HASH_SECRET`.
- **Location** is coarse only (country / region / city from Vercel geo headers when available).
- User agents are stored for bot detection and debugging.
- This service is for internal campaign analytics, not public-facing profiles.

---

## Database schema

`email_events` table:

| Column | Description |
|--------|-------------|
| `id` | Primary key (cuid) |
| `event_type` | `open` or `click` |
| `campaign_id` | From `cid` query param |
| `recipient_token` | From `rid` query param |
| `message_id` | From `mid` query param |
| `link_id` | Click only — allowlisted link key |
| `destination_url` | Click only — resolved destination |
| `ip_hash` | HMAC hash of client IP |
| `ip_country`, `ip_region`, `ip_city` | Coarse geo from Vercel headers |
| `user_agent` | Raw user agent string |
| `is_bot` | Bot/scanner heuristic flag |
| `created_at` | Event timestamp |

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
