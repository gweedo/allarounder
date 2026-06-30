"""Admin dashboard endpoint: personalized article summary for the logged-in editor."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.infrastructure.content.models import ArticleModel, AuthorModel
from app.infrastructure.identity.models import UserModel
from app.interfaces.api.admin.dashboard.schemas import DashboardArticleItem, DashboardResponse
from app.interfaces.api.auth.dependencies import CurrentUser, get_db_session, require_editor

router = APIRouter(prefix="/api/admin/dashboard", tags=["dashboard"])

_LIMIT = 5


def _base_stmt() -> Any:
    return (
        select(
            ArticleModel.id,
            ArticleModel.title,
            ArticleModel.created_at,
            ArticleModel.updated_at,
            func.coalesce(AuthorModel.name, UserModel.email).label("author_name"),
        )
        .outerjoin(AuthorModel, ArticleModel.author_profile_id == AuthorModel.id)
        .join(UserModel, ArticleModel.author_id == UserModel.id)
    )


def _to_item(row: Any) -> DashboardArticleItem:
    return DashboardArticleItem(
        id=row.id,
        title=row.title,
        author_name=row.author_name,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    current_user: Annotated[CurrentUser, Depends(require_editor)],
    session: Annotated[Session, Depends(get_db_session)],
) -> DashboardResponse:
    user_uuid = uuid.UUID(current_user.user_id)

    my_published = session.execute(
        _base_stmt()
        .where(
            ArticleModel.author_id == user_uuid,
            ArticleModel.status == "published",
        )
        .order_by(ArticleModel.updated_at.desc())
        .limit(_LIMIT)
    ).all()

    all_drafts = session.execute(
        _base_stmt()
        .where(ArticleModel.status == "draft")
        .order_by(ArticleModel.updated_at.desc())
        .limit(_LIMIT)
    ).all()

    return DashboardResponse(
        my_published=[_to_item(r) for r in my_published],
        all_drafts=[_to_item(r) for r in all_drafts],
    )
