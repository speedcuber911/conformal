This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production

Production runs on the shared ap-south-1 EC2 host behind the existing Dockerized nginx edge:

- URL: https://dcmshriram.conformal.live
- App path: `/home/ubuntu/partner-apps/dcmshriram`
- Container: `partner-dcmshriram`
- Docker network: `cutcompanion_default`
- Edge config reference: `deploy/nginx.dcmshriram.conf`

Pushes to `main` run `.github/workflows/deploy.yml`, validate with `pnpm lint` and `pnpm build`, sync the app to EC2, rebuild the app container, and reload nginx.

### Azure OpenAI agent runtime

`/api/chat` uses Azure OpenAI when the server runtime has these variables. If they are absent, the app falls back to the curated deterministic demo path.

```bash
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<secret>
AZURE_OPENAI_GPT55_DEPLOYMENT=gpt-5.5
AZURE_OPENAI_API_STYLE=responses
```

Optional overrides:

```bash
AZURE_OPENAI_API_STYLE=chat
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_TIMEOUT_MS=14000
AZURE_OPENAI_MAX_OUTPUT_TOKENS=1200
```

Production deploys source `/etc/leap.env` before `docker compose`, so keep these values there and never commit secrets.
