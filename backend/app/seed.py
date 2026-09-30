import asyncio

from sqlalchemy import select

from .database import SessionFactory
from .models import PublicAuthority


async def seed() -> None:
    async with SessionFactory() as session:
        existing = await session.scalar(
            select(PublicAuthority).where(PublicAuthority.slug == "nightline-demo-campus")
        )
        if existing is None:
            session.add(
                PublicAuthority(
                    slug="nightline-demo-campus",
                    display_name="Nightline Demo Campus",
                    policy_url="https://example.edu/student-support/privacy",
                    active_network="preview",
                )
            )
            await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
