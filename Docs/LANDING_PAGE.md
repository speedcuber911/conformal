# Conformal Landing Page

Last updated: May 11, 2026

## Purpose

The public home page has been reframed from a single-client executive cockpit demo into the Conformal studio landing page. The page should now read as: Conformal has shipped many production AI engagements across multiple sectors over four years.

The landing page should not feel like a press release or a startup manifesto. The voice is direct, senior, and specific: a small partner-led firm describing real work without naming clients.

## Current Page Flow

The home page now follows this order:

1. Hero
2. Stats strip
3. The problem we keep finding
4. What we do
5. Selected work
6. How we work
7. Final CTA
8. Footer

The old single-case-study flow was removed from the public landing page. In particular, the previous client trust band, recent-build screenshot block, single-client stat bar, "Why us" proof-card grid, and "Week one" simulated conversation are no longer part of the home page.

## Positioning Changes

### Hero

The headline now says:

> We've spent four years making the second-oldest companies act like the youngest.

The phrase "like the youngest" remains italic and uses the Conformal red `#B8232E`. The subhead and CTAs remain intentionally close to the prior version so the brand system still feels continuous.

### Proof Strategy

The page no longer proves credibility by implying one named or easily identifiable client. It proves credibility through:

- aggregate operating stats,
- anonymized but specific engagement descriptions,
- sector breadth,
- implementation timelines,
- concrete capability tags.

### Navigation

The public nav is now:

- Approach
- Work
- Journal

`Work` links to `#selected-work` on the home page. "Case studies" and "Engagements" were removed from the public nav because they made the page feel either singular or too client-list oriented.

## Component Map

The landing page lives under `src/components/landing/`.

### `ConformalLandingPage.tsx`

Top-level public home page shell. It owns:

- nav,
- hero,
- problem section,
- what-we-do pillars,
- how-we-work steps,
- final CTA,
- footer.

It imports the extracted proof components:

- `StatsStrip`,
- `SelectedWork`.

### `StatsStrip.tsx`

Renders the four-column credibility strip directly under the hero:

- `17` production agents shipped since 2022,
- `₹38,000 Cr` combined revenue of enterprises worked with,
- `7 weeks` median kickoff-to-production time,
- `9 / 11` first engagements that led to a second.

The number is set in Fraunces at roughly 42px and weight 500. Units such as `Cr` and `weeks` are rendered smaller at roughly 18px while preserving the same color.

### `SelectedWork.tsx`

Renders the anonymized five-engagement portfolio section and the private-demo CTA. The section has the anchor `id="selected-work"` for nav scrolling.

It owns the engagement data array. Engagements are intentionally specific enough to feel real and anonymized enough to avoid identifying clients:

- Industrial conglomerate: CEO decision cockpit
- Pharmaceutical manufacturer: regulatory intelligence agent
- Specialty chemicals: procurement copilot
- Mid-sized NBFC: early-warning credit agent
- Family office: investment memo copilot

### `Engagement.tsx`

Reusable row component for each selected-work entry. Each row has:

- a 180px sector/context column on desktop,
- a flexible details column,
- red uppercase status,
- serif headline,
- body copy,
- three capability tags,
- 0.5px row hairline except on the final row.

## Public Metadata And Social Cards

`src/app/layout.tsx` now uses Conformal public metadata:

- `metadataBase`: `https://conformal.live`
- title: `Conformal`
- description: four-year, multi-engagement production-agent framing
- Open Graph and Twitter cards no longer reference the old cockpit/demo identity

`src/app/opengraph-image.tsx` now renders a Conformal-branded OG image using the same multi-engagement frame:

- eyebrow: "Four-year AI transformation programs"
- headline: "Delivered as many production agent engagements."
- proof line: "Multi-engagement · Four-year arc · In production"

`src/app/twitter-image.tsx` re-exports the Open Graph image so both social surfaces stay aligned.

## Styling System

Global landing styles are defined in `src/app/globals.css`. The public page keeps the existing restrained Conformal visual language:

- white or near-white surfaces,
- 0.5px hairlines,
- Inter for interface copy,
- Fraunces for display and numbers,
- Conformal red `#B8232E` for emphasis and status,
- rounded brand mark,
- no screenshots or image assets in the selected-work proof section.

The public home page is routed from `src/app/page.tsx` to `ConformalLandingPage`.

## Footer

The footer tagline remains:

> AI transformation, in working code.

The first footer link group is now titled `Work` and lists:

- Executive cockpits
- Agentic workflows
- Data product audits

## README And Deployment Naming

The top-level `README.md` production section now uses Conformal public naming:

- URL: `https://conformal.live`
- app path: `/home/ubuntu/partner-apps/conformal`
- container: `partner-conformal`
- edge config: `deploy/nginx.conformal.conf`
- env file: `/etc/conformal.env`

This keeps the public landing/deploy docs aligned with the Conformal brand rather than the older client-specific subdomain.

## Standalone HTML Reference

The standalone file `/Users/pariksj/Desktop/conformal_landing_multi_client.html` was also aligned with the public landing-page direction:

- nav links are `Approach`, `Work`, `Journal`,
- `Work` points to `#selected-work`,
- the stray public login link was removed,
- `#approach` and `#selected-work` anchors were added.

That file is outside this Git repository, so it is not part of the repo commit.

## Public Copy Scrub

The public landing surface was scrubbed for old one-client/demo terms across:

- `README.md`,
- `src/app`,
- `src/components/landing`,
- `/Users/pariksj/Desktop/conformal_landing_multi_client.html`.

The scrub intentionally focused on the public landing and metadata surfaces. Internal cockpit/runtime files and older demo docs still contain old SFS/DCM/Project Leap terminology because those files describe the dashboard/demo runtime, not the public landing page.

## Verification Notes

Use these checks after landing-page edits:

```bash
./node_modules/.bin/eslint
```

For production builds inside the Codex desktop environment, prefer the workspace Node runtime to avoid macOS code-signing issues with the native Next SWC binary:

```bash
PATH="/Users/pariksj/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ./node_modules/.bin/next build
```

The build should report routes for `/`, `/dashboard`, metadata images, robots, sitemap, and the API routes.

For copy regressions, run:

```bash
rg -n "DCM|Shriram|SFS|Project Leap|Bain|Currently shipping|A recent build|Week one|Case studies|#engagements|Engagements|conformal-cockpit|redacted|Log in" \
  README.md src/app/layout.tsx src/app/opengraph-image.tsx src/app/twitter-image.tsx src/app/page.tsx src/components/landing src/app/globals.css
```

Expected result: no matches.

## Known Boundary

This page is now the public Conformal landing page. The dashboard route and backend still contain historical cockpit/demo language in code and internal docs. That should only be changed as part of a separate product/runtime cleanup, because those files are tied to the current analytics cockpit behavior.
