# Multi-stage build for the Globus BTP FastAPI backend.
# Stage 1: install Python deps in a slim builder image.
# Stage 2: copy the venv + source into a minimal runtime.

# ----- Builder --------------------------------------------------
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System libs needed by pillow (QR), xhtml2pdf font rendering, magic, asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libmagic1 \
        libjpeg-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .
RUN python -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip wheel && \
    /opt/venv/bin/pip install -r requirements.txt


# ----- Runtime --------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Runtime libs only (no compilers — keeps image small)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1001 globus

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=globus:globus . /app

# Pre-create the writable directories so the unprivileged user can use them.
RUN mkdir -p /app/uploads /app/uploads/generated && chown -R globus:globus /app/uploads

USER globus
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0) if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else sys.exit(1)" \
    || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
