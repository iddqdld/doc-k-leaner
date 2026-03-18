"""
CLI script to create an admin user.

Usage:
    python -m scripts.create_admin

Reads DOCKCLEANER_POSTGRES_URL from the environment (or uses the default).
Prompts for email, password, and name interactively.
"""

from __future__ import annotations

import asyncio
import getpass
import sys

import psycopg

sys.path.insert(0, ".")

from app.core.config import settings  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402


async def main() -> None:
    print("=== Doc(k)leaner Admin Creator ===\n")

    email = input("Email: ").strip()
    if not email:
        print("Error: email is required")
        sys.exit(1)

    name = input("Name: ").strip()
    if not name:
        name = email.split("@")[0]

    password = getpass.getpass("Password (min 6 chars): ")
    if len(password) < 6:
        print("Error: password must be at least 6 characters")
        sys.exit(1)

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Error: passwords do not match")
        sys.exit(1)

    pw_hash = hash_password(password)

    import uuid
    from datetime import datetime, timezone

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    conn = await psycopg.AsyncConnection.connect(settings.postgres_url)
    try:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO users (id, email, password_hash, name, role, provider, created_at)
                VALUES (%s, %s, %s, %s, 'admin', 'local', %s)
                """,
                (user_id, email, pw_hash, name, now),
            )
        await conn.commit()
        print(f"\nAdmin user created: {email} (id: {user_id})")
    except Exception as exc:
        print(f"\nFailed to create admin: {exc}")
        sys.exit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
