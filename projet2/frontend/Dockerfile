# Two-stage build for the Vite React frontend:
#   Stage 1: install deps + build static assets
#   Stage 2: serve the build via nginx with PWA-friendly headers

# ----- Builder --------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /build

# Install deps first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the source and build
COPY . .

# Vite needs VITE_API_URL at build time; provide a default that can be
# overridden via `--build-arg VITE_API_URL=...`
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build


# ----- Runtime --------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Drop the default config in favour of a SPA-aware one
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1
