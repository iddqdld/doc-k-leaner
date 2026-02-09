from typing import AsyncGenerator

import psycopg

from app.core.config import settings


async def get_db() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    conn = await psycopg.AsyncConnection.connect(settings.postgres_url)
    try:
        yield conn
    finally:
        await conn.close()


async def init_db() -> None:
    conn = await psycopg.AsyncConnection.connect(settings.postgres_url)
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS files (
                    id UUID PRIMARY KEY,
                    filename TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    size BIGINT NOT NULL,
                    source TEXT NOT NULL CHECK (source IN ('upload', 'url')),
                    original_url TEXT,
                    storage_path TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
                """
            )
        await conn.commit()
    finally:
        await conn.close()
