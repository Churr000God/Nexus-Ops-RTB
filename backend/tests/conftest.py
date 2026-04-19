from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import AsyncIterator

import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _ensure_test_env() -> None:
    os.environ.setdefault("JWT_SECRET", "test_secret")
    os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "1")


_ensure_test_env()
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


@pytest_asyncio.fixture(scope="session")
async def _db_schema() -> AsyncIterator[None]:
    from app.db import engine
    from app.models import Base

    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS staging"))
        await conn.run_sync(Base.metadata.create_all)
    yield None
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture()
async def db_session(_db_schema: None) -> AsyncIterator[AsyncSession]:
    from app.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE "
                "refresh_tokens, users, "
                "cotizacion_items, cotizaciones, cotizaciones_canceladas, "
                "ventas, clientes, productos "
                "RESTART IDENTITY CASCADE"
            )
        )
        await session.execute(
            text(
                "TRUNCATE TABLE "
                "staging.csv_row_errors, staging.csv_rows, staging.csv_files "
                "RESTART IDENTITY CASCADE"
            )
        )
        await session.commit()
        yield session


@pytest_asyncio.fixture()
async def auth_header(db_session: AsyncSession) -> dict[str, str]:
    from app.models.user_model import User
    from app.services.auth_service import AuthService

    user = User(
        email="test@example.com",
        hashed_password=AuthService.hash_password("Password12345"),
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    token = AuthService(db_session).create_access_token(user)
    return {"Authorization": f"Bearer {token}"}
