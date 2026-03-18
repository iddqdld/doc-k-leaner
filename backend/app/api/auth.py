"""
Authentication API Endpoints

Routes:
    POST /register  - Create account with email/password
    POST /login     - Login with email/password
    POST /google    - Login/register via Google ID token
    GET  /me        - Get current user info
    GET  /me/history - Get scan history for current user
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import get_current_user, require_admin
from app.db.postgres import get_db
from app.schemas.auth import (
    AdminOverview,
    AdminUserRow,
    DockerContainersResponse,
    DockerContainerRow,
    DockerLogsResponse,
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    ScanHistoryItem,
    TokenResponse,
    UserResponse,
)
from app.services.docker_admin_service import fetch_container_logs, list_stack_containers
from app.services.auth_service import (
    create_access_token,
    create_user,
    get_user_by_email,
    get_user_by_google_id,
    hash_password,
    verify_google_token,
    verify_password,
)
from app.services.db_service import (
    count_admins,
    delete_user_by_id,
    get_admin_overview,
    get_user_role,
    get_user_scan_history,
    list_users_for_admin,
)

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)


def _user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        avatar_url=user.get("avatar_url"),
        role=user["role"],
        provider=user["provider"],
    )


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, db=Depends(get_db)):
    existing = await get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = await create_user(
        db,
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
    )
    token = create_access_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=_user_response(user))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db=Depends(get_db)):
    user = await get_user_by_email(db, payload.email)
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=_user_response(user))


@router.post("/google", response_model=TokenResponse)
async def google_auth(payload: GoogleAuthRequest, db=Depends(get_db)):
    info = await verify_google_token(payload.credential)
    if not info or not info.get("email"):
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    user = await get_user_by_google_id(db, info["google_id"])
    if not user:
        user = await get_user_by_email(db, info["email"])
    if not user:
        user = await create_user(
            db,
            email=info["email"],
            name=info["name"],
            avatar_url=info.get("picture"),
            provider="google",
            google_id=info["google_id"],
        )

    token = create_access_token(user["id"], user["role"])
    return TokenResponse(access_token=token, user=_user_response(user))


@router.get("/me", response_model=UserResponse)
async def me(user: dict = Depends(get_current_user)):
    return _user_response(user)


@router.get("/me/history", response_model=list[ScanHistoryItem])
async def my_history(
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
):
    return await get_user_scan_history(db, user["id"])


@router.get("/admin/overview", response_model=AdminOverview)
async def admin_overview(_admin: dict = Depends(require_admin), db=Depends(get_db)):
    data = await get_admin_overview(db)
    return AdminOverview(**data)


@router.get("/admin/users", response_model=list[AdminUserRow])
async def admin_list_users(_admin: dict = Depends(require_admin), db=Depends(get_db)):
    rows = await list_users_for_admin(db)
    return [AdminUserRow(**r) for r in rows]


@router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: UUID,
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
):
    tid = str(user_id)
    if tid == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    role = await get_user_role(db, tid)
    if role is None:
        raise HTTPException(status_code=404, detail="User not found")
    if role == "admin":
        n = await count_admins(db)
        if n <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    ok = await delete_user_by_id(db, tid)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted", "id": tid}


@router.get("/admin/docker/containers", response_model=DockerContainersResponse)
async def admin_docker_containers(_admin: dict = Depends(require_admin)):
    rows, hint = list_stack_containers()
    return DockerContainersResponse(
        containers=[DockerContainerRow(**r) for r in rows],
        hint=hint,
    )


@router.get("/admin/docker/logs", response_model=DockerLogsResponse)
async def admin_docker_logs(
    service: str,
    tail: int = 300,
    _admin: dict = Depends(require_admin),
):
    logs, err = fetch_container_logs(service, tail)
    if err:
        raise HTTPException(status_code=400, detail=err)
    return DockerLogsResponse(logs=logs or "")
