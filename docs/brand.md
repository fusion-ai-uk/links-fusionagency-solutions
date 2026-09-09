# Fusion brand — applied to this app

Source: `Fusion_BrandComms_Deck_Kit_v3` (internal standard, v3.0, issued
27 August 2026). Values below are taken from that document, not invented. The
deck is a **deck** standard; where it has no answer for a web interface, the
extension made here is marked **[web]**.

---

## Surfaces (darkest to lightest)

| Token | Hex | Deck role |
|-------|-----|-----------|
| `--surface-inset` | `#0A101C` | Deepest inset — mockup sidebars |
| `--surface-well` | `#0E1524` | Well — panel behind content |
| `--surface-bg` | `#121A2B` | Background |
| `--surface-subtle` | `#1A2438` | Hairlines, faint fills |
| `--surface-card` | `#1B2740` | Primary card fill |
| `--surface-raised` | `#23304A` | Alternate zebra row, pill fill |
| `--border-soft` | `#27334D` | 1pt border on wells |
| `--border` | `#31405E` | 0.75pt border on cards |

## Text tiers

| Token | Hex | Deck role |
|-------|-----|-----------|
| `--text-primary` | `#E8EEF5` | Titles, row heads. **Warm off-white — never `#FFFFFF`** |
| `--text-secondary` | `#C7D0DC` | Body copy |
| `--text-tertiary` | `#8A97A8` | Eyebrow, standfirst |
| `--text-quaternary` | `#5A6572` | Source lines, footers |
| `--text-divider` | `#9AA7B8` | Section-divider wording only |
| `--alert` | `#E5484D` | Negative or at-risk only — used 6 times in 43 slides |

Pure white glares on this ground. The deck is explicit: do not substitute it.

## Accent rotation

Fixed order — **cyan comes second, before teal**:

| # | Token | Hex |
|---|-------|-----|
| 01 | `--accent-orange` | `#F97316` |
| 02 | `--accent-cyan` | `#22D3EE` |
| 03 | `--accent-teal` | `#2DD4BF` |
| 04 | `--accent-violet` | `#A78BFA` |

Semantic use:

- **Teal** — the recommended option, the positive case
- **Orange** — the caution, the constraint, the thing that bites
- **Alert red** — genuinely negative or at-risk values only
- Every eyebrow uses the **orange em-dash**, whatever the item's accent
- Sequential items take the rotation in reading order; a fifth restarts at orange
- **[web]** Cyan carries interactive text (links, focus rings). Orange is
  reserved for caution and the eyebrow, so it cannot also mean "clickable".

## Typography

The deck specifies **Century Gothic** (the voice — titles, body, numbers,
labels, footers) and **Consolas** (annotation only, 4.9–8.6pt, never body copy
or a title).

**[web]** Neither is a web font. This app uses **Jost** and **JetBrains Mono** —
the same substitutes Fusion used to typeset the deck kit PDF itself. Century
Gothic and Consolas stay first in the stack so anyone with them installed sees
the true faces.

Scale, as measured in the deck:

| Tier | Size | Colour | Notes |
|------|------|--------|-------|
| Eyebrow label | 10.5pt, `spc 2.0` | `#8A97A8` | Uppercase, orange em-dash prefix |
| Title | 26pt regular | `#E8EEF5` | Sentence case. **Regular, not bold** |
| Standfirst | 11.5pt | `#8A97A8` | One or two lines |
| Row heading | 13.5pt bold | `#E8EEF5` | |
| Body | 9.2–10pt | `#C7D0DC` | |
| Mono annotation | 8.6pt | `#F97316` | Consolas, `//` prefix |
| Source line | 7.6pt | `#5A6572` | |

Letter-spacing: `2.0` eyebrows, `1.5` small-caps column heads, `1.0` divider
titles, `0.8` right-hand tags, `0` everything else including all body copy.

## Components

- **Corners are square.** Cards, rows and bars are plain rectangles. Only pills
  and mockup frames are rounded.
- **The accent bar is the signature** — `0.075in` (≈5.4pt) on the top of a card
  or the left of a row. Its colour matches that item's number and tag, and never
  a colour the item does not otherwise use.
- Card fill `#1B2740`, border `0.75pt #31405E`. Wells take `1pt #27334D`.
- Zebra rows alternate `#1B2740` / `#23304A`.
- Pills fully rounded, fill `#23304A`, hairline border in the accent.
- **No shadows, gradients or transparency anywhere.** Depth comes from the
  surface ladder and 1pt borders only.
- **No bullets.** Lists are cards, rows, pills, or a mono flow string.
- Centred text only for the cover, numerals in their own box, and column
  headings. Never body copy.

## Furniture

- **Eyebrow** — `—   LABEL · SUBLABEL`, uppercase. Orange em-dash plus three
  spaces, then the label in tertiary. Middot separator with two spaces each side.
- **Footer signature** — `FUSION · prepared for · CLIENT`. Party names bold
  primary, connector regular quaternary.
- **Section divider** — leading full stop bold orange, wording regular
  `#9AA7B8`, deliberately quieter than a content title.
- **Cover** — wordmark, the fixed tagline *Deep expertise | Machine speed |
  Every stage of the lifecycle*, and a `1.5in × 0.02in` rule in `#31405E`.
  Nothing else. The pipe separator is used here and nowhere else in the system.

> The cover calls for the `fusion_logo.png` asset, which is not in this repo,
> so the sign-in screen renders the wordmark as type. To use the real logo, add
> it at `public/fusion-logo.png` and swap the wordmark span for a next/image
> tag — see the comment in `src/app/admin/login/page.tsx`. Do not detect it at
> runtime: `public/` is not bundled into Vercel serverless functions, so an
> `fs` check is always false in production.

## Honesty conventions — mandatory

These do real compliance work and the deck says both should be mandatory.

1. **The source line.** Names the dataset, the party that owns it, and any
   assumption. *A number with no source line is not finished.*
2. **The dummy-data badge.** `ILLUSTRATIVE — DUMMY DATA` in bold orange, on the
   face of the artwork, repeated at the foot. Said twice, deliberately.

In this app, every figure carries a source line stating that it is
first-party tracking activity, and every estimate says so in the same breath.

## Language

- UK English. GBP. Dates as `27 August 2026`.
- Sentence case for titles; uppercase only in the label tiers.
- Active, present tense. Titles written as claims, not labels.
- Expand acronyms on first use.
- **Banned:** revolutionary, game-changing, unparalleled, seamless, leverage as
  a verb, unlock, supercharge, best-in-class, cutting-edge. No exclamation marks.
- Never write that something *will* deliver a result — write what it is designed
  to do. Never write "significant" without the figure beside it.
- Client-facing, medical, regulatory or legal content is a draft until the named
  reviewer has signed it off.
