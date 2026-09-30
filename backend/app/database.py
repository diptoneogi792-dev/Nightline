from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings
from .models import Base


def async_database_url(url: str) -> str:
    normalized = url.replace("postgres://", "postgresql://", 1)
    if normalized.startswith("postgresql://"):
        normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)
    return normalized.replace("sslmode=require", "ssl=require")


settings = get_settings()
engine = create_async_engine(async_database_url(settings.database_url), pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


async def initialize_tables() -> None:
    if settings.should_init_tables:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
