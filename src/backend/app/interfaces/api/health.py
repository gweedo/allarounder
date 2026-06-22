from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.interfaces.api.auth.dependencies import get_db_session

router = APIRouter()


@router.get("/api/health")
def health(session: Annotated[Session, Depends(get_db_session)]) -> dict[str, str]:
    try:
        session.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        )
    return {"status": "ok"}
