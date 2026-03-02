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
            await cur.execute( ## file uploads stored here
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
            await cur.execute(  ## scan results table 
                """
                CREATE TABLE IF NOT EXISTS scan_results (
                    id UUID PRIMARY KEY,
                    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    scanner TEXT NOT NULL,
                    status TEXT NOT NULL,
                    summary_json JSONB NOT NULL,
                    raw_output_path TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS solidity_contracts (
                    id UUID PRIMARY KEY,
                    filename TEXT NOT NULL,
                    size BIGINT NOT NULL,
                    storage_path TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS solidity_scans (
                    id UUID PRIMARY KEY,
                    contract_id UUID NOT NULL REFERENCES solidity_contracts(id) ON DELETE CASCADE,
                    guard_audit_id TEXT NOT NULL,
                    mode TEXT NOT NULL CHECK (mode IN ('quick', 'standard')),
                    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')),
                    score INT,
                    severity_counts JSONB NOT NULL DEFAULT '{}',
                    findings JSONB NOT NULL DEFAULT '[]',
                    report_markdown TEXT,
                    created_at TIMESTAMPTZ NOT NULL,
                    completed_at TIMESTAMPTZ
                )
                """
            )
        await conn.commit()
    finally:
        await conn.close()
