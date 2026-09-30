from collections.abc import AsyncIterator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import get_settings
from .models import Base


def async_database_url(url: str) -> str:
    normalized = url.replace("postgres://", "postgresql://", 1)
    parsed = make_url(normalized)
    if parsed.drivername in {"postgres", "postgresql"}:
        parsed = parsed.set(drivername="postgresql+asyncpg")

    query = dict(parsed.query)
    channel_binding_key = next(
        (key for key in query if key.lower() == "channel_binding"),
        None,
    )
    if channel_binding_key:
        query.pop(channel_binding_key)

    sslmode_key = next((key for key in query if key.lower() == "sslmode"), None)
    if sslmode_key:
        ssl_mode = query.pop(sslmode_key)
        if not any(key.lower() == "ssl" for key in query):
            query["ssl"] = ssl_mode

    return parsed.set(query=query).render_as_string(hide_password=False)


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
