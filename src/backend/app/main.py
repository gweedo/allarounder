from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.interfaces.api.admin.articles.router import router as articles_router
from app.interfaces.api.admin.authors.router import router as admin_authors_router
from app.interfaces.api.admin.categories.router import router as admin_categories_router
from app.interfaces.api.admin.dashboard.router import router as dashboard_router
from app.interfaces.api.admin.guests.router import router as admin_guests_router
from app.interfaces.api.admin.media.router import router as media_router
from app.interfaces.api.admin.pages.router import router as admin_pages_router
from app.interfaces.api.admin.tags.router import router as admin_tags_router
from app.interfaces.api.auth.router import router as auth_router
from app.interfaces.api.health import router as health_router
from app.interfaces.api.preview.router import router as preview_router
from app.interfaces.api.public.articles.router import router as public_articles_router
from app.interfaces.api.public.authors.router import router as public_authors_router
from app.interfaces.api.public.categories.router import router as public_categories_router
from app.interfaces.api.public.guests.router import router as public_guests_router
from app.interfaces.api.public.pages.router import router as public_pages_router
from app.interfaces.api.public.tags.router import router as public_tags_router
from app.settings import get_settings

settings = get_settings()


def _get_real_ip(request: Request) -> str:
    """Resolve real client IP from X-Forwarded-For when behind a trusted proxy.

    Only active when TRUST_FORWARDED_FOR=true (set in production behind Front Door).
    Safe because the backend Container App ingress is internal-only; external
    traffic cannot reach it directly and spoof the header.
    """
    if settings.trust_forwarded_for:
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_get_real_ip, default_limits=[])
app = FastAPI(
    title="Allarounder API",
    version="0.1.0",
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
    openapi_url="/openapi.json" if settings.app_env == "development" else None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(articles_router)
app.include_router(admin_authors_router)
app.include_router(admin_categories_router)
app.include_router(admin_guests_router)
app.include_router(admin_tags_router)
app.include_router(media_router)
app.include_router(preview_router)
app.include_router(admin_pages_router)
app.include_router(public_articles_router)
app.include_router(public_authors_router)
app.include_router(public_categories_router)
app.include_router(public_guests_router)
app.include_router(public_pages_router)
app.include_router(public_tags_router)
