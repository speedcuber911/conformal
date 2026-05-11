FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG SITE_VARIANT=conformal
ENV NEXT_TELEMETRY_DISABLED=1
ENV SITE_VARIANT=$SITE_VARIANT
ENV NEXT_PUBLIC_SITE_VARIANT=$SITE_VARIANT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
ARG SITE_VARIANT=conformal
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SITE_VARIANT=$SITE_VARIANT
ENV NEXT_PUBLIC_SITE_VARIANT=$SITE_VARIANT
ENV PORT=3000
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
