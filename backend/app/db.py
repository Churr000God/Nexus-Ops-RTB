from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return database_url
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


if settings.DATABASE_URL is None:
    raise RuntimeError("DATABASE_URL no esta configurada")

engine = create_async_engine(
    _normalize_database_url(settings.DATABASE_URL),
    pool_pre_ping=True,
    connect_args={"prepare_threshold": 0},  # PgBouncer: deshabilita prepared statements
)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session
