from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.interfaces.api.admin.articles.router import router as articles_router
from app.interfaces.api.admin.categories.router import router as admin_categories_router
from app.interfaces.api.admin.media.router import router as media_router
from app.interfaces.api.admin.tags.router import router as admin_tags_router
from app.interfaces.api.auth.router import router as auth_router
from app.interfaces.api.health import router as health_router
from app.interfaces.api.preview.router import router as preview_router
from app.interfaces.api.public.articles.router import router as public_articles_router
from app.interfaces.api.public.categories.router import router as public_categories_router
from app.interfaces.api.public.tags.router import router as public_tags_router
from app.settings import get_settings

settings = get_settings()

limiter = Limiter(key_func=get_remote_address, default_limits=[])
app = FastAPI(title="Allarounder API", version="0.1.0")
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
app.include_router(articles_router)
app.include_router(admin_categories_router)
app.include_router(admin_tags_router)
app.include_router(media_router)
app.include_router(preview_router)
app.include_router(public_articles_router)
app.include_router(public_categories_router)
app.include_router(public_tags_router)
