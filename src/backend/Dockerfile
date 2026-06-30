FROM python:3.13-slim AS base

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# ---- deps: local dev image (docker-compose --target deps for hot-reload) ----
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
# Stub package root so setuptools can resolve the editable install;
# the /app volume mount at runtime replaces this with the real source.
RUN mkdir -p app && touch app/__init__.py
RUN pip install --no-cache-dir -e ".[dev]"

# ---- build: compile C extensions with build tools, then discard ----
FROM base AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
RUN pip install --no-cache-dir --prefix=/install .

# ---- production: only the installed packages, no build tools ----
FROM base AS production
COPY --from=builder /install /usr/local
COPY . .

RUN adduser --disabled-password --gecos "" --uid 1001 appuser \
    && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
