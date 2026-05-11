# Conformal Landing Page

Last updated: May 11, 2026

## Purpose

The public home page is the Conformal studio landing page. It should read as a serious AI firm that senior enterprise buyers call when they want working software, not another transformation deck.

The voice is direct, senior, and specific: a small partner-led team describing real production AI work without naming clients or revealing founder identities.

## Current Page Flow

The home page follows this order:

1. Hero
2. Stats strip
3. The problem we keep finding
4. What we do
5. Selected work
6. Our point of view
7. Journal preview
8. Trust & security
9. The people
10. Frequently asked
11. How we work
12. Final CTA
13. Footer

The old single-case-study flow was removed from the public landing page. In particular, the previous client trust band, recent-build screenshot block, single-client stat bar, "Why us" proof-card grid, and "Week one" simulated conversation are no longer part of the home page.

## Positioning

### Hero

The headline says:

> We've spent four years making the second-oldest companies act like the youngest.

The phrase "like the youngest" remains italic and uses the Conformal red `#B8232E`.

### Proof Strategy

The page proves credibility through:

- aggregate operating stats,
- anonymized but specific engagement descriptions,
- sector breadth,
- implementation timelines,
- concrete capability tags,
- a sharp point of view,
- founder credentials without founder names,
- enterprise-buying details around security, code ownership, and model neutrality.

### Navigation

The public nav is:

- Approach -> hashless scroll to the `approach` section
- Work -> hashless scroll to the `selected-work` section
- Journal -> `/journal`

Section links are rendered through `SectionScrollButton`, so clicking them scrolls without leaving `#approach`, `#selected-work`, `#trust`, `#faq`, or `#conversation` in the browser URL. `Journal` links to the real journal route rather than a mailto.

## Component Map

The landing page lives under `src/components/landing/`.

The shared Conformal mark lives in `src/components/brand/ConformalMark.tsx`.

### `ConformalLandingPage.tsx`

Top-level public home page shell. It owns:

- nav,
- hero,
- problem section,
- what-we-do pillars,
- point-of-view beliefs,
- journal preview rows,
- trust/security cards,
- anonymous founder credential tables,
- FAQ,
- how-we-work steps,
- final CTA,
- footer.

It imports:

- `StatsStrip`,
- `SelectedWork`,
- `SectionScrollButton`,
- `sectionTargetFromHref` from `src/lib/section-scroll.ts`.

### `SectionScrollButton.tsx`

Client-side section navigation for the public site. It renders clean `/` links and performs `scrollIntoView()` in the browser, including cross-page jumps from `/journal` back to home sections through `sessionStorage`. It also removes any incoming hash after handling it, so shared old URLs with section fragments do not leave a fragment in the address bar once the page loads.

### `StatsStrip.tsx`

Renders the four-column credibility strip directly under the hero:

- `17` production agents shipped since 2022,
- `₹38,000 Cr` combined revenue of enterprises worked with,
- `7 weeks` median kickoff-to-production time,
- `9 / 11` first engagements that led to a second.

### `SelectedWork.tsx`

Renders the anonymized five-engagement portfolio section and the private-demo CTA. The section has the anchor `id="selected-work"` for nav scrolling.

### `Engagement.tsx`

Reusable row component for each selected-work entry. Each row has:

- a 180px sector/context column on desktop,
- a flexible details column,
- red uppercase status,
- serif headline,
- body copy,
- three capability tags,
- 0.5px row hairline except on the final row.

## Credibility Sections

### Point Of View

`PointOfViewSection` is the intellectual centerpiece of the home page. It uses a two-column intro and a 2x2 belief grid with internal 0.5px hairlines only.

The four beliefs are:

- Agents are the new application, not the new feature.
- The bottleneck is data shape, not model intelligence.
- Trust is built by showing the reasoning.
- The deliverable is your team's fluency.

### Journal Preview

`JournalPreviewSection` has `id="journal"` and renders the five newest posts from `src/lib/journal.ts`. Each row links to `/journal/[slug]` and uses the same three-column row pattern as the journal index.

### Trust & Security

`TrustSecuritySection` has `id="trust"` and covers:

- VPC deployment,
- SOC 2 status,
- audit trail,
- DPIA/DPA readiness,
- code escrow,
- model-provider neutrality.

Important accuracy note: the SOC 2 card says `SOC 2 Type II in progress` with a Q3 2026 target. Do not change it to completed certification until the report exists and can be shared under NDA.

### The People

`PeopleSection` uses two anonymous horizontal founder narratives: a left rail with role and credibility tags, and a right column with characterization and prose. There are no names, initials, photos, alt text, or comments that identify the founders.

Founder prose supports `**bold**` primary emphasis for outcomes, `//muted//` emphasis for firm names, and `*italic-red*` emphasis in the characterization line through `renderInline()`.

### FAQ

`FAQSection` has `id="faq"` and uses direct answers. Do not soften the copy with "it depends" language. The pricing answer currently publishes a six-week engagement range of `₹40-80 lakh`.

## Journal

The journal lives on conformal.live.

### Routes

- `src/app/journal/page.tsx` renders `/journal`.
- `src/app/journal/[slug]/page.tsx` renders every post from `src/lib/journal.ts`.
- `src/app/journal/[slug]/opengraph-image.tsx` generates a unique OG image for each post.
- `src/app/journal/rss.xml/route.ts` returns RSS at `/journal/rss.xml`.

### Shared Data

`src/lib/journal.ts` is the single source of truth for:

- slugs,
- categories,
- titles,
- deks,
- read times,
- published dates,
- article bodies,
- related-post selection,
- RSS XML escaping.

All article bodies should remain 700-1,400 words. Stubs, lorem ipsum, and placeholder sections are not acceptable.

### Index Behavior

`src/components/journal/JournalIndex.tsx` filters posts client-side by:

- All
- Engineering
- Architecture
- Strategy
- Evaluations
- Field notes
- Hiring

`src/components/journal/JournalChrome.tsx` mirrors the home nav/footer for journal pages.

## Metadata, RSS, Sitemap, Robots

`src/app/layout.tsx` uses:

- `metadataBase`: `https://conformal.live`
- title: `Conformal — AI transformation, in working code`
- description: `We build the AI products that legacy enterprises actually ship — replacing slide decks with working software, six weeks at a time.`
- Open Graph locale: `en_IN`

`src/app/opengraph-image.tsx` renders the public OG image:

- eyebrow: `AI transformation for enterprise leaders`
- headline: `In working code.`
- proof line: `Six-week agents · Enterprise systems · Auditable traces`

`src/app/twitter-image.tsx` re-exports the Open Graph image.

Each journal post exports metadata from `generateMetadata()` and has a post-level generated Open Graph image.

## Logo And App Icons

The Conformal mark is a black rounded square with a white open `C` contour and a red trace/chevron. It is intentionally compact so it holds up as:

- nav/footer brand mark,
- favicon,
- Apple touch icon,
- Open Graph brand stamp.

Do not revert it to the old dot-in-square placeholder. Use `ConformalMark` for in-app surfaces and keep `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`, and `src/app/journal/[slug]/opengraph-image.tsx` visually aligned with that mark.

`src/app/journal/rss.xml/route.ts` returns a RSS 2.0 feed with all journal posts.

`src/app/sitemap.ts` includes home, `/journal`, and every journal post.

`src/app/robots.ts` allows all crawlers and points to `https://conformal.live/sitemap.xml`.

## Footer

The footer tagline remains:

> AI transformation, in working code.

Footer groups:

- `Work`: Executive cockpits, Agentic workflows, Data product audits
- `Company`: Approach, Journal
- `Resources`: Trust & security, FAQ, RSS
- `Contact`: hello@conformal.live, Gurugram · San Francisco

## Hosting And Deployment

The public Conformal site is hosted on AWS Amplify Hosting, connected to the GitHub `main` branch.

- Production URL: `https://conformal.live`
- Amplify region: `ap-south-1`
- Amplify app ID: `dlwwm3b70gv88`
- Amplify branch: `main`
- Build spec: `amplify.yml`

GitHub Actions now runs `.github/workflows/deploy.yml` as website CI only: install, TypeScript, lint, and build. The deploy step is the Amplify GitHub integration, which starts a production build automatically after a successful push to `main`.

Route53 keeps the apex `conformal.live` as an alias to the Amplify-managed CloudFront target. The `dcmshriram.conformal.live` record remains on EC2 for the analytics cockpit/demo runtime.

Do not deploy the Conformal public site through the EC2 Docker/nginx path unless you are deliberately rolling back Amplify. Amplify is now the source of truth for public landing-page and journal deploys.

## Verification Notes

Use these checks after landing-page or journal edits:

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/components/brand/ConformalMark.tsx src/components/landing/ConformalLandingPage.tsx src/components/landing/SectionScrollButton.tsx src/components/journal/JournalChrome.tsx src/components/journal/JournalIndex.tsx src/app/icon.tsx src/app/apple-icon.tsx src/app/journal/page.tsx 'src/app/journal/[slug]/page.tsx' 'src/app/journal/[slug]/opengraph-image.tsx' src/app/journal/rss.xml/route.ts src/lib/journal.ts src/lib/section-scroll.ts src/app/layout.tsx src/app/sitemap.ts src/app/robots.ts src/app/opengraph-image.tsx
```

For copy regressions, run:

```bash
rg -n "Parikshit|Aanya|Devansh|Bhandari|Raghav|Saxena|DCM|Shriram|SFS|Project Leap" \
  src/app/journal src/components/landing src/components/journal src/lib/journal.ts
```

Expected result: no matches.

For article length regressions, run:

```bash
./node_modules/.bin/tsx -e "import {posts} from './src/lib/journal'; for (const p of posts) { const words = p.sections.flatMap(s=>s.paragraphs).join(' ').split(/\\s+/).filter(Boolean).length; if (words < 700 || words > 1400) throw new Error(p.slug + ' ' + words); console.log(words, p.slug); }"
```

## Known Boundary

The public Conformal landing and journal surfaces are separate from the older analytics cockpit/demo runtime. Dashboard route, backend, and internal demo docs may still contain legacy SFS/DCM terminology because those files describe the runtime demo, not the public marketing site.

During this update, local `next build` was blocked by native macOS code-signature errors in the installed Next/Tailwind binaries. Source-level checks passed, but browser/Lighthouse validation requires a clean dependency install or a runtime where the native binaries can load.
