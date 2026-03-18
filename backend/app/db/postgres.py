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
                CREATE TABLE IF NOT EXISTS users (
                    id          UUID PRIMARY KEY,
                    email       TEXT NOT NULL UNIQUE,
                    password_hash TEXT,
                    name        TEXT NOT NULL,
                    avatar_url  TEXT,
                    role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
                    provider    TEXT NOT NULL DEFAULT 'local' CHECK (provider IN ('local', 'google')),
                    google_id   TEXT UNIQUE,
                    created_at  TIMESTAMPTZ NOT NULL
                )
                """
            )
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
            await cur.execute(
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
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS sandbox_usage (
                    id UUID PRIMARY KEY,
                    input_length INT NOT NULL,
                    line_count INT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            # Add owner_id FK to existing tables (idempotent)
            await cur.execute(
                "ALTER TABLE files ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL"
            )
            await cur.execute(
                "ALTER TABLE solidity_contracts ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL"
            )
            await cur.execute(
                "ALTER TABLE sandbox_usage ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL"
            )
        await conn.commit()
    finally:
        await conn.close()
