from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import httpx
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    """Return {"sub": ..., "role": ...} or None on failure."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except JWTError:
        return None


async def verify_google_token(credential: str) -> dict | None:
    """Exchange a Google ID token for user info via Google's tokeninfo endpoint."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": credential},
        )
    if resp.status_code != 200:
        return None
    data = resp.json()
    aud = data.get("aud", "")
    if settings.google_client_id and aud != settings.google_client_id:
        return None
    return {
        "email": data.get("email"),
        "name": data.get("name", data.get("email", "")),
        "picture": data.get("picture"),
        "google_id": data.get("sub"),
    }


# ── DB helpers ──────────────────────────────────────────────────────────

async def create_user(
    conn,
    *,
    email: str,
    password_hash: str | None = None,
    name: str,
    avatar_url: str | None = None,
    role: str = "user",
    provider: str = "local",
    google_id: str | None = None,
) -> dict:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    async with conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO users (id, email, password_hash, name, avatar_url, role, provider, google_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (user_id, email, password_hash, name, avatar_url, role, provider, google_id, now),
        )
    await conn.commit()
    return {
        "id": user_id,
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
        "role": role,
        "provider": provider,
    }


async def get_user_by_email(conn, email: str) -> dict | None:
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT id, email, password_hash, name, avatar_url, role, provider, google_id FROM users WHERE email = %s",
            (email,),
        )
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "email": row[1],
        "password_hash": row[2],
        "name": row[3],
        "avatar_url": row[4],
        "role": row[5],
        "provider": row[6],
        "google_id": row[7],
    }


async def get_user_by_google_id(conn, google_id: str) -> dict | None:
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT id, email, password_hash, name, avatar_url, role, provider, google_id FROM users WHERE google_id = %s",
            (google_id,),
        )
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "email": row[1],
        "password_hash": row[2],
        "name": row[3],
        "avatar_url": row[4],
        "role": row[5],
        "provider": row[6],
        "google_id": row[7],
    }


async def get_user_by_id(conn, user_id: str) -> dict | None:
    async with conn.cursor() as cur:
        await cur.execute(
            "SELECT id, email, password_hash, name, avatar_url, role, provider, google_id FROM users WHERE id = %s",
            (user_id,),
        )
        row = await cur.fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "email": row[1],
        "password_hash": row[2],
        "name": row[3],
        "avatar_url": row[4],
        "role": row[5],
        "provider": row[6],
        "google_id": row[7],
    }
