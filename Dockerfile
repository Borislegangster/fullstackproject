# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Stage 1 — Build frontend (Vite)
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --silent

COPY frontend/ .
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 2 — Python backend
# ─────────────────────────────────────────────────────────────
FROM python:3.12-slim AS backend

# Prevent Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# System dependencies for psycopg2 and bcrypt
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .

# Create uploads directory
RUN mkdir -p /app/uploads

# Copy built frontend → served by Nginx (see docker-compose)
COPY --from=frontend-builder /app/frontend/dist /app/static

# Expose port (Uvicorn behind Nginx)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import httpx; r = httpx.get('http://localhost:8000/health'); r.raise_for_status()"

# Run with production settings
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
