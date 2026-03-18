from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from app.db.postgres import get_db
from app.services.auth_service import decode_access_token, get_user_by_id


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    return auth[7:]


async def get_optional_user(request: Request, db=Depends(get_db)) -> dict | None:
    """Return the authenticated user dict, or None for anonymous requests."""
    token = _extract_token(request)
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user = await get_user_by_id(db, payload["sub"])
    return user


async def get_current_user(request: Request, db=Depends(get_db)) -> dict:
    """Return the authenticated user or raise 401."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require the user to have admin role or raise 403."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
