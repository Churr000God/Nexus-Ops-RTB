from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import AsyncIterator
from pathlib import Path

import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


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
        # Limpiar schema public por completo para garantizar schema fresco
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS staging"))
        await conn.run_sync(Base.metadata.create_all)
        sql_path = PROJECT_ROOT.parent / "scripts" / "bootstrap_triggers.sql"
        if sql_path.exists():
            await conn.exec_driver_sql(sql_path.read_text(encoding="utf-8"))
    yield None
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))


@pytest_asyncio.fixture()
async def db_session(_db_schema: None) -> AsyncIterator[AsyncSession]:
    from app.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE "
                "refresh_tokens, users, "
                "categorias, marcas, "
                "clientes, proveedores, "
                "productos, proveedor_productos, "
                "cotizacion_items, cotizaciones, cotizaciones_canceladas, "
                "ventas, "
                "inventario, inventory_movements, no_conformes, "
                "solicitudes_material, entradas_mercancia, facturas_compras, "
                "pedidos_clientes, pedidos_incompletos, verificador_fechas_pedidos, "
                "crecimiento_inventario, pedidos_proveedor, gastos_operativos "
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
