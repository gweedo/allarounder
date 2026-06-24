"""Admin bootstrap CLI.

Usage:
    python -m cli create-admin --email admin@example.com --password <secret>
"""

import argparse
import sys
from datetime import timedelta

from sqlalchemy.orm import Session, sessionmaker

from app.application.identity.services import AuthService
from app.infrastructure.database import get_engine
from app.infrastructure.identity.hibp import HibpBreachedPasswordChecker
from app.infrastructure.identity.password import Argon2PasswordHasher
from app.infrastructure.identity.repositories import SqlRefreshTokenRepository, SqlUserRepository
from app.infrastructure.identity.tokens import JoseTokenIssuer
from app.settings import get_settings


def _build_service() -> tuple[AuthService, Session]:
    settings = get_settings()
    SessionFactory: sessionmaker[Session] = sessionmaker(
        bind=get_engine(), expire_on_commit=False
    )
    session: Session = SessionFactory()

    svc = AuthService(
        user_repo=SqlUserRepository(session),
        token_repo=SqlRefreshTokenRepository(session),
        password_hasher=Argon2PasswordHasher(),
        breached_checker=HibpBreachedPasswordChecker(),
        token_issuer=JoseTokenIssuer(settings.jwt_secret_key, settings.jwt_algorithm),
        access_token_ttl=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        refresh_token_ttl=timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    return svc, session


def cmd_create_admin(email: str, password: str) -> None:
    svc, session = _build_service()
    try:
        user = svc.create_admin(email, password)
        session.commit()
        print(f"Admin user created: {user.email.value} (id={user.id})")
    except Exception as exc:
        session.rollback()
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Allarounder admin CLI")
    subparsers = parser.add_subparsers(dest="command")

    create_parser = subparsers.add_parser(
        "create-admin", help="Bootstrap the first admin user"
    )
    create_parser.add_argument("--email", required=True, help="Admin email address")
    create_parser.add_argument(
        "--password", required=True, help="Admin password (min 12 chars)"
    )

    args = parser.parse_args()

    if args.command == "create-admin":
        cmd_create_admin(args.email, args.password)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
