# syntax=docker/dockerfile:1.7
# Image web GLOBUS (Next.js 15, sortie « standalone »). Contexte de construction : racine systemcomplet/.
#   docker build -f infra/docker/web.Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://www.exemple.cm -t globus/web:4.0.0 .

FROM node:22-bookworm-slim AS deps
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
COPY apps/web/scripts ./scripts
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /web
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY --from=deps /web/node_modules ./node_modules
COPY apps/web ./
# Garde-fous V4 avant toute image : types, lint, aucun mock (V4-DEPLOY-42), liens internes, build.
RUN npm run typecheck && npm run lint && node scripts/check-no-mocks.mjs && node scripts/check-links.mjs && npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Africa/Douala
RUN groupadd --system --gid 10001 globus \
 && useradd --system --uid 10001 --gid globus --home-dir /web --shell /usr/sbin/nologin globus
COPY --from=build --chown=globus:globus /web/.next/standalone ./
COPY --from=build --chown=globus:globus /web/.next/static ./.next/static
COPY --from=build --chown=globus:globus /web/public ./public
USER globus
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
