# Local Development

Everything runs via Docker Compose: PostgreSQL, the FastAPI backend, and the Next.js frontend.

## Prerequisites

- Docker (with the Compose plugin)
- Git

## First-time setup

### 1. Copy the env file

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local dev. The only value you may want to change is `JWT_SECRET_KEY` — leave the placeholder for local work, but never use it in staging or production.

### 2. Start the stack

```bash
docker compose up
```

This starts three services:

| Service | Local URL | Notes |
|---|---|---|
| Frontend (Next.js) | http://localhost:3000 | SSR + admin UI, hot-reload enabled |
| Backend (FastAPI) | http://localhost:8000 | JSON API, hot-reload enabled |
| Database (PostgreSQL) | localhost:5432 | persisted in a Docker volume |

The backend waits for the database healthcheck before starting.

### 3. Run migrations

In a separate terminal, run Alembic to create the schema:

```bash
docker compose exec backend alembic upgrade head
```

You only need this on first start and after pulling new migrations.

### 4. Create a first admin user

There is no seed script yet. Create a user directly via the Python shell:

```bash
docker compose exec backend python - <<'EOF'
import uuid, datetime
from app.infrastructure.database import get_session_factory
from app.infrastructure.identity.models import UserModel
from app.infrastructure.identity.password import Argon2PasswordHasher

session = get_session_factory()()
hasher = Argon2PasswordHasher()
user = UserModel(
    id=uuid.uuid4(),
    email="admin@allarounder.it",
    hashed_password=hasher.hash("changeme"),
    role="admin",
    is_active=True,
    failed_login_count=0,
    created_at=datetime.datetime.now(datetime.UTC),
)
session.add(user)
session.commit()
print("Created:", user.email)
EOF
```

Then log in at http://localhost:3000/admin/login.

## Daily workflow

```bash
# Start everything
docker compose up

# Stop everything (keeps DB data)
docker compose down

# Rebuild images after changing dependencies
docker compose build

# Apply new migrations
docker compose exec backend alembic upgrade head

# Run backend tests
docker compose exec backend pytest

# Run frontend tests
docker compose exec frontend npm test
```

## API docs

The interactive OpenAPI docs are available at http://localhost:8000/docs when `APP_ENV=development` (the default).

## Ports reference

| Port | Service |
|---|---|
| 3000 | Next.js frontend |
| 8000 | FastAPI backend |
| 5432 | PostgreSQL |

## Environment variables

See `.env.example` for the full list with descriptions. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `JWT_SECRET_KEY` | `change-me-in-production` | Signs auth tokens — insecure placeholder is fine locally |
| `DATABASE_URL` | points to the `db` service | Auto-set by Compose; only change if running the backend outside Docker |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` | Must include the frontend origin |
| `AZURE_STORAGE_ACCOUNT_NAME` | _(empty)_ | Leave blank locally; image uploads will fail gracefully |
