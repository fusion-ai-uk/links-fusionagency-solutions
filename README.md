# Email Link Tracking — Fusion Agency Solutions

Private **campaign-level** email open and click tracking for client email
programmes.

Work is organised in two levels:

- **Programme** — a client + brand (e.g. Gilead AmBisome), defined in
  `src/config/programmes.ts`
- **Campaign** — one email / wave, identified by the `cid` in its tracking URLs

The admin dashboard is sectioned by programme, and each campaign has its own
setup and handover page at `/admin/setup/<campaign-id>`.

**Production domain:** [https://links-record.vercel.app](https://links-record.vercel.app)

This service logs estimated email opens via a 1×1 tracking pixel and CTA clicks via allowlisted redirect links. It includes a password-protected admin dashboard and CSV export.

---

## Campaign-level tracking limitation

Because the sending platforms are **not** providing recipient IDs or merge tags,
this system tracks **campaign-level opens and clicks only**.

> This has been confirmed for the IMI waves. For any new programme, confirm with
> the sending platform whether recipient IDs are available before assuming
> campaign-level only.

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
| `GET /health` | Health check — DB connectivity and whether the schema is current |
| `GET /admin` | Admin dashboard, sectioned by programme |
| `GET /admin/setup/[campaignId]` | Per-email tracking setup + handover pack |
| `GET /admin/guide` | How to read the figures — caveats and definitions |
| `GET /admin/duplication` | Duplication analysis — scanner echoes, repeat clicks, evidence |
| `GET /admin/export.csv` | CSV export (scoped to the current dashboard view) |
| `GET /examples` | Generic email HTML snippet reference (public) |

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
| `ADMIN_PASSWORD` | Yes | Password for michael@fusionagency.solutions |
| `STEVEN_PASSWORD` | For Steven | Password for steven@fusionagency.solutions |
| `IP_HASH_SECRET` | Yes | Secret for HMAC-hashing client IPs (e.g. `openssl rand -hex 32`) |

Locally, set `DATABASE_POSTGRES_PRISMA_URL` and `DATABASE_URL_UNPOOLED` to the same Postgres URL (or use `vercel env pull .env.local`).

No client- or platform-specific environment variables are required.

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
| `ADMIN_PASSWORD` | Michael's dashboard password |
| `STEVEN_PASSWORD` | Steven's dashboard password |
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

**https://links-record.vercel.app**

Use this base URL in all email HTML snippets and handover packs. Routes are unchanged: `/o`, `/c/[linkId]`, `/admin`, `/health`.

### Verification after deploy

Confirm:
  - [https://links-record.vercel.app/health](https://links-record.vercel.app/health) returns `{ "status": "ok", "schema": "current", ... }` — `schema: outdated` means a deploy went out without its migration
  - [https://links-record.vercel.app/admin](https://links-record.vercel.app/admin) shows the login page
  - [https://links-record.vercel.app/examples](https://links-record.vercel.app/examples) shows HTML snippets

If you add a custom domain later, update the URLs in your email templates accordingly.

---

## Adding / updating tracked links

Edit `src/config/links.ts` and add/update entries under `campaignLinkDestinations`:

```typescript
export const campaignLinkDestinations = {
  "gilead-ambisome-email-1": {
    "read-more": "https://example.com/landing-page",
    "watch-video": "https://example.com/landing-page#video",
  },
};
```

- **Campaign ID** (`cid`) identifies the email in reporting
- **Key** = link ID used in URLs: `/c/LINK_ID?cid=CAMPAIGN_ID`
- **Value** = final destination URL
- Commit and redeploy after changes

### How a click is resolved

1. The campaign's own map (a `-test` ID uses its parent campaign's map).
2. If the campaign is configured at all, **stop** — an unknown link ID returns
   404.
3. Only for campaign IDs the app does not recognise, fall back to the legacy
   aliases in `defaultLinkDestinations`.

Step 2 matters: a missing link ID on a known campaign is a config error, and a
404 is far safer than silently sending a recipient to a **different brand's**
content. The legacy aliases in step 3 exist only for link IDs that may already be
live in mail sent before per-campaign maps existed.

**Security:** Destination URLs are **never** taken from query strings. Unknown
link IDs return 404. This prevents open-redirect abuse.

---

## Instructions for the email HTML build

- Add the open pixel once near the bottom of the email HTML, ideally before `</body>`
- Replace only the CTA/button links you want to track
- Use `/c/LINK_ID?cid=CAMPAIGN_ID` for tracked links
- Do not change unsubscribe links
- Do not change preference centre links
- Do not change legal, compliance or adverse-event reporting links
- Do not add raw email addresses or recipient data to URLs
- **No merge tags are needed**

The exact URLs for a given email are generated at `/admin/setup/<campaign-id>`.
See also [/examples](https://links-record.vercel.app/examples) for the generic
patterns.

---

## Accounts and access

Sign-in is by named account, not a shared password. The registry lives in
`src/config/users.ts`; each user names an environment variable that holds their
password, so no password is ever committed.

| Email | Name | Role | Password variable |
|-------|------|------|-------------------|
| michael@fusionagency.solutions | Michael | `admin` | `ADMIN_PASSWORD` |
| steven@fusionagency.solutions | Steven | `build` | `STEVEN_PASSWORD` |

### What the roles can do

| | `admin` | `build` |
|---|---|---|
| Dashboard, all programmes and figures | Yes | Yes |
| Per-email setup and handover packs | Yes | Yes |
| Guide page | Yes | Yes |
| Run test sends | Yes | Yes |
| CSV export of individual events | Yes | **No** |
| `/admin/debug/recent-events` | Yes | **No** |

The CSV export and debug endpoint are held back from `build` because they carry
hashed IP addresses and full user agent strings. To give Steven them, change his
`role` to `"admin"` in `src/config/users.ts` and redeploy — nothing else.

### Adding or removing someone

1. Add an entry to `USERS` in `src/config/users.ts` with a new
   `passwordEnv` name.
2. Set that variable in Vercel → Settings → Environment Variables.
3. Redeploy.

To remove access, delete the environment variable and redeploy. That user can no
longer sign in and any existing session of theirs stops working immediately.

### How sessions work

The session cookie is the user's email plus an HMAC of it keyed on their own
password. Consequences worth knowing:

- Changing a password signs that user out everywhere, and only that user.
- Clearing a password variable revokes that account immediately.
- The cookie cannot be edited to impersonate someone else — the signature is
  keyed on the other account's password, which the cookie holder does not have.
- Sessions last 7 days. Cookies are `httpOnly`, `sameSite=lax`, and `secure`
  in production.

### Sign-in throttling

Repeated failures are slowed down using a `login_attempts` table, so the limit
holds across serverless instances: **5 failures per email address** or **20 per
client address** within a 15-minute sliding window, after which the form
answers "Too many sign-in attempts" with the minutes to wait. A successful
sign-in clears that address's failures. The lock-out message is the same for
unknown and known addresses, and the client address is stored hashed. If the
database is unreachable the password check still stands on its own — throttling
never blocks a legitimate sign-in.

### Security headers

Every response carries a plain content-security-policy (self-hosted scripts,
styles and fonts only; no external calls), `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, a strict referrer policy, a restrictive
permissions policy and HSTS. See `next.config.ts`. The admin area also has a
branded error boundary, so a fault shows an explanation and a way back rather
than a stack trace.

---

## Programmes and campaign IDs

Programmes and their campaigns are defined in `src/config/programmes.ts`.
Each campaign carries a status so the dashboard shows where it is in approval:

| Status | Meaning |
|--------|---------|
| `planned` | Slot reserved. Content/HTML not received — nothing to configure yet |
| `in-review` | Content received, still in client / medical / legal review |
| `ready` | Tracking configured and handed to the email build. Not sent |
| `sent` | Sent — collecting live data |
| `closed` | Send finished and reporting signed off |

### Gilead AmBisome

Five-email programme sent via IMI. As with the other IMI waves, no recipient IDs
or merge tags are provided, so tracking is **campaign-level only**.

Campaign IDs are reserved and the dashboard section is live, but **link IDs and
destination URLs are deliberately empty** until each approved HTML lands.

| Campaign ID (`cid`) | Email | Status | Send date |
|---------------------|-------|--------|-----------|
| `gilead-ambisome-email-1` | AmBisome Email 1 | planned | TBC |
| `gilead-ambisome-email-2` | AmBisome Email 2 | planned | TBC |
| `gilead-ambisome-email-3` | AmBisome Email 3 | planned | TBC |
| `gilead-ambisome-email-4` | AmBisome Email 4 | planned | TBC |
| `gilead-ambisome-email-5` | AmBisome Email 5 | planned | TBC |

Open tracking for these works the moment the pixel is in the HTML — no config
needed. Click tracking needs each CTA allowlisting first.

### IMI — Gilead AIDS 2026

| Campaign ID (`cid`) | Email | Status |
|---------------------|-------|--------|
| `imi-aids2026-pre-email-jun-2026` | Pre-email | sent |
| `imi-aids2026-post-congress-jul-2026` | Post-congress | sent |
| `imi-aids2026-wave-3` | Wave 3 | planned (no link IDs yet) |

### IMI — Gilead Lyvdelzi

| Campaign ID (`cid`) | Email | Status |
|---------------------|-------|--------|
| `imi-lyvdelzi-may-2026` | Lyvdelzi May 2026 | sent |

---

## How an email is set up

Every email is different — some have no calls to action, some several — so
tracking is configured from the **final approved HTML**, one email at a time.
Setup is done by Michael through Claude Code, not in the dashboard, until an
automated route exists. The steps, as they actually run:

1. **Final approved HTML reaches Michael.**
2. **Tracking is generated from that HTML** — the open pixel and a tracked URL
   per call to action, added to `src/config/links.ts`; status → `ready`;
   deploy. The one-page handover pack (`scratchpad/docgen/make-pack.cjs`)
   goes to Steve.
3. **Steve tests.** Either the `-test` URLs or the live URLs before the send —
   both are treated as testing. The setup page shows each link as clicked or
   not.
4. **Send.** Michael sets status → `sent` and records `liveFrom` (ISO 8601
   with offset). From that moment events on the live ID are live data.

The setup page at `/admin/setup/<cid>` reflects these four steps and is where
test activity is checked.

---

## What counts as a test, and what counts as real

Every event gets a **phase** from configuration alone:

| Phase | Rule |
|-------|------|
| `test` | Recorded on a `-test` campaign ID |
| `pre-send` | Recorded on the live campaign ID before the email was sent: status not yet `sent`, or before its `liveFrom` |
| `live` | Recorded on the live campaign ID at or after `liveFrom` |

Test and pre-send are hidden from the dashboard figures by default (shown,
labelled, with *Include test sends*). Historic sends with no `liveFrom` count
everything as live, as before.

Every **live click** then gets one **triage reason**, first match wins:

| Reason | Rule |
|--------|------|
| `bot` | User agent matched a scanner / proxy / automation pattern |
| `internal` | Same device (hashed IP + user agent) had produced test or pre-send events in the scope — a tester looking at the live email |
| `echo` | Near-simultaneous click on the same link from a different address |
| `repeat` | Near-simultaneous click on the same link from the same address |
| `genuine` | None of the above |

Phase and reason are computed, never stored (`src/lib/triage.ts`), so a
corrected `liveFrom` re-triages history consistently. The dashboard shows the
waterfall from raw to genuine; the CSV export carries `phase` and `triage`
per row and always includes the `-test` twin of each requested campaign.

---

## Test sends

Any campaign ID with `-test` appended resolves to the same allowlisted
destinations as its parent, but records events under the test ID:

```
https://links-record.vercel.app/o?cid=gilead-ambisome-email-1-test
https://links-record.vercel.app/c/read-more?cid=gilead-ambisome-email-1-test
```

Test data is **hidden from the dashboard** unless *Include test sends* is ticked,
so live reporting stays clean. No config is needed to enable a test ID.

## Email HTML snippets

### Open pixel

```html
<img src="https://links-record.vercel.app/o?cid=CAMPAIGN_ID" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />
```

### Tracked CTA

```html
<a href="https://links-record.vercel.app/c/LINK_ID?cid=CAMPAIGN_ID">CTA text</a>
```

### Test variant

Append `-test` to the campaign ID in a test build:

```html
<img src="https://links-record.vercel.app/o?cid=CAMPAIGN_ID-test" width="1" height="1" alt="" style="width:1px;height:1px;border:0;display:block;" />

<a href="https://links-record.vercel.app/c/LINK_ID?cid=CAMPAIGN_ID-test">CTA text</a>
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

### Dashboard controls

Every figure-changing control sits in one bar that stays at the top of the page.
Changes apply immediately (a thin line along the top of the bar shows while the
figures update) and the address bar always reflects the current view, so any
view can be bookmarked or sent to a colleague.

- **Programme tabs** — pick the client programme.
- **Email picker** — all emails in the programme, or tick one or several to
  compare. Clicking an email's name in the table focuses on it; clicking again
  clears it.
- **Signal chips** — Genuine, Echo, Repeat, Internal, Bot, Pre-send, Test. Each
  chip shows how many clicks of that kind exist in the selection; switching a
  chip on or off changes every figure on the page. Presets: **All live**
  (default), **Genuine only** (the figure to report), **Everything**.
- **Settings** — the echo window (5/10/30/60s).
- **CSV** — administrators only; every event in the selection with `phase`
  and `triage` columns, regardless of chips.

URL parameters: `programme`, `campaign` (repeatable), `include` (comma list
of classes; absent means all live), `window`, `q`, `status`. The older
`bots=exclude`, `tests=include` and `collapse=1` still work and convert to
`include` on the next navigation.

---

## Duplication: scanner echoes and repeat clicks

The most common oddity in click data is **two clicks on the same link seconds
apart, one from the UK and one from somewhere else**. That is almost always one
person. Many organisations route mail through a link-protection layer —
Microsoft Defender Safe Links, Proofpoint URL Defense, Mimecast and similar —
which fetches a URL from its own infrastructure to check it as the recipient
clicks, then lets the browser through. Both requests reach the redirect, from
different addresses, so the approximate-unique measure cannot merge them.

### What the app does about it

**Captures request hints.** Since September 2026 every event records the
`Sec-Fetch-*` headers, `Accept-Language` and `Accept`, and derives a
`client_kind`:

| `client_kind` | Meaning |
|---------------|---------|
| `navigation` | Top-level browser navigation — the strongest sign of a person |
| `image` | A browser loading the pixel |
| `other` | A browser, but not a navigation (preview, prefetch, programmatic fetch) |
| `none` | No Sec-Fetch headers at all — typical of scanners and older mail clients |
| `NULL` | Recorded before hints were captured |

Absence of hints is a soft signal, weighed alongside timing and geography.

**Clusters near-simultaneous clicks.** Clicks on the same campaign + link within
a window (default 10 seconds, chain-linked) form a cluster. The most person-like
event is the **primary**; the rest are labelled:

- **echo** — different address to the primary. The scanner signature.
- **repeat** — same address. Someone clicking again.

Primary selection, in order: not flagged as a bot → browser navigation → the
country most of that campaign's browser clicks came from (derived from the data,
not hard-coded) → the later event, since scanners tend to fetch first.

**Offers a collapse filter.** *Collapse near-simultaneous echoes* on the
dashboard counts one click per cluster in every click figure, recalculates
approximate unique clicks over primaries, and appends the window to the source
line. Nothing is deleted; the CSV export always contains every event.

**Shows the evidence.** `/admin/duplication` lists every cluster with more than
one click — role, offset, location, client hints, browser, bot reason — plus
where echoes come from, what each window setting would do, and an
interpretation that is labelled as such.

### Bot reasons

`is_bot` now comes with a `bot_reason` naming the pattern that matched
(`google-image-proxy`, `http-library`, `skype-teams-preview`, …), so a
flagged row can be explained rather than just excluded. See
`src/lib/bot-detect.ts`.

### Choosing a window

Ten seconds catches the typical 1–5 second echo with room to spare. Widening it
risks merging two real people who click in the same moment right after a send.
The duplication page shows what 5, 10, 30 and 60 seconds would each do to the
same clicks — if the numbers barely move, the echoes are tight and the default
is safe.

### Reporting

Use collapsed clicks, exclude likely bots, and say so in the source line. If a
client has already seen the uncollapsed figure, show both and explain the
difference rather than letting them discover it.

---

## Times

Every time shown in the interface is **UK time** (Europe/London — GMT or BST as
applicable), formatted `09 Sep 2026 14:32:07`. Timestamps are stored in UTC and
the CSV export keeps them as ISO 8601 with a `Z`, which is unambiguous for
analysis. `liveFrom` in `src/config/programmes.ts` should be written with its
offset, e.g. `2026-09-10T09:00:00+01:00`.

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
| `bot_reason` | Which pattern matched, when `is_bot` is true |
| `client_kind` | `navigation` / `image` / `other` / `none` — derived from request hints |
| `accept_language`, `accept_header` | Request headers, truncated to 200 chars |
| `sec_fetch_mode`, `sec_fetch_dest`, `sec_fetch_user`, `sec_fetch_site` | Browser fetch metadata; NULL when absent |
| `created_at` | Event timestamp |

`login_attempts` table: `id`, `key` (`email:<address>` or `ip:<hash>`),
`success`, `attempted_at` — see Sign-in throttling.
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
    admin/                  # Dashboard, per-email setup pages, CSV export
    examples/page.tsx       # Generic HTML snippets (public)
  config/
    programmes.ts           # Programme + campaign registry, statuses
    links.ts                # Allowlisted click destinations
  lib/
    tracking.ts             # Event logging
    auth.ts                 # Admin session
    dashboard.ts            # Stats queries, collapse mode, CSV
    event-filters.ts        # Shared WHERE builders
    duplication.ts          # Click clustering, echo/repeat labelling
    triage.ts               # Phase (test/pre-send/live) and reason per event
    view.ts                 # Dashboard view model: signal classes and figures
    time.ts                 # UK-time formatting
    rate-limit.ts           # Sign-in throttling
    request-hints.ts        # Sec-Fetch capture and client_kind
    bot-detect.ts           # Bot patterns with reasons
    programme-view.ts       # Programme scoping + wave table view model
    tracking-urls.ts        # Pixel / CTA URL and handover-pack builders
    ip-hash.ts              # IP hashing
    geo.ts                  # Vercel geo headers
    bot-detect.ts           # Bot UA detection
prisma/
  schema.prisma
  migrations/
```

---

## Brand

The interface follows `Fusion_BrandComms_Deck_Kit_v3` — the dark navy surface
ladder, the four-accent rotation, square corners, and the accent bar as the
component signature. The palette, type scale and component rules are documented
in [docs/brand.md](docs/brand.md), including the two places where a deck
standard needed extending for a web interface.

Two of the deck's honesty conventions are load-bearing here:

- **Every figure carries a source line.** A number with no source line is not
  finished.
- **Estimates say so where they appear**, not only in a footnote.

The typefaces are Jost and JetBrains Mono, standing in for the deck's Century
Gothic and Consolas, which are not web fonts. These are the same substitutes
used to typeset the deck kit itself.

The cover calls for the `fusion_logo.png` asset, which is not in this repo, so
the sign-in screen sets the wordmark as type. To use the real logo, add it at
`public/fusion-logo.png` and swap the wordmark for a `next/image` tag — the
comment in `src/app/admin/login/page.tsx` says how.

---

## License

Private — Fusion Agency Solutions / Fusion AI UK.
