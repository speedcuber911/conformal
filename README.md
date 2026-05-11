This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install the Python backend dependencies and start the ECEO sidecar:

```bash
pnpm backend:dev
```

That script uses `uv run`, so it will create/use the Python environment declared in `pyproject.toml`.

In another shell, run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Landing Page

The public home page is the Conformal studio landing page, not the cockpit demo. Its current positioning, proof sections, journal routes, RSS/sitemap behavior, metadata behavior, and verification notes are documented in [`Docs/LANDING_PAGE.md`](Docs/LANDING_PAGE.md).

Public Conformal routes:

- `/` — studio landing page
- `/journal` — journal index with category filters
- `/journal/[slug]` — long-form journal posts
- `/journal/rss.xml` — RSS 2.0 feed
- `/sitemap.xml` — home, journal, and all post URLs
- `/robots.txt` — crawler policy for the public site

## Hosting

`conformal.live` is hosted on AWS Amplify Hosting from the GitHub `main` branch.

- Amplify app ID: `dlwwm3b70gv88`
- Region: `ap-south-1`
- Build spec: `amplify.yml`
- Custom domain: `conformal.live`

Pushes to `main` now run GitHub Actions validation and then Amplify rebuilds and deploys the site automatically from the connected branch. The GitHub workflow no longer deploys the public site through EC2.

The EC2/nginx path is still used for `dcmshriram.conformal.live`, not for the public Conformal landing page.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## CI/CD

The public site pipeline is split cleanly:

- GitHub Actions validates `main` and pull requests with `pnpm install --frozen-lockfile`, `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`.
- AWS Amplify Hosting is connected to `main` and performs the production build/deploy with `amplify.yml`.
- EC2 deploy scripts are only for the older analytics cockpit/demo surface on `dcmshriram.conformal.live`.

## Production

The public production site runs on Amplify:

- URL: https://conformal.live
- Amplify app ID: `dlwwm3b70gv88`
- Amplify region: `ap-south-1`
- Branch: `main`
- RSS feed: https://conformal.live/journal/rss.xml

The EC2 host remains available for the internal demo runtime at `dcmshriram.conformal.live`.

### Azure OpenAI agent runtime

`/api/chat` now uses the ECEO backend sidecar at `ECEO_BACKEND_URL` and adapts its four-agent SSE stream into the cockpit's NDJSON stream. If the sidecar is unavailable, the app returns an error instead of silently showing legacy demo answers.

This is additive: keep the existing cockpit capabilities intact. The original TypeScript agent orchestrator, deterministic demo fallback, generated chart rendering, live/pinned chart behavior, dashboard reuse, and `/api/chat` client contract should continue to work. Use `ECEO_BACKEND_DISABLED=1` to force the legacy in-process path for local testing or emergency fallback.

The backend supports Anthropic, Bedrock, and Azure OpenAI. For this repo, Azure OpenAI is the default when these variables are present:

```bash
ECEO_BACKEND_URL=http://127.0.0.1:8000
ECEO_BACKEND_DISABLED=0
ECEO_BACKEND_REQUIRED=1
LLM_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<secret>
AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini
AZURE_OPENAI_API_STYLE=responses
AZURE_OPENAI_TIMEOUT_MS=14000
AZURE_OPENAI_MAX_OUTPUT_TOKENS=1200
```

Optional overrides:

```bash
AZURE_OPENAI_GPT55_DEPLOYMENT=gpt-5.5   # compatibility / strong-model fallback name
AZURE_OPENAI_API_STYLE=chat
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_TIMEOUT_MS=14000
AZURE_OPENAI_MAX_OUTPUT_TOKENS=1200
```

Production deploys source `/etc/conformal.env` before `docker compose`, so keep these values there and never commit secrets.

### ECEO backend capabilities

The Python backend in `backend/` was brought over from the ECEO copy and keeps the four-agent architecture:

- `Interpreter` clarifies ambiguous executive questions.
- `AnalysisPlanner` decomposes a question into up to four concrete analyses.
- `QueryExecutor` writes DuckDB SQL per analysis, executes it, and retries once on SQL failure.
- `PresentationDesigner` streams the CEO-style narrative and selects KPI/chart/table layout.

The schema, prompts, chart rules, and workbook source live in `Docs/`. The Next app keeps using `/api/chat`; the route handler proxies to `POST /query/stream` on the sidecar and converts backend events into the existing UI event contract.
