from __future__ import annotations

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: str | None = None
    role: str
    provider: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ScanHistoryItem(BaseModel):
    id: str
    filename: str
    size: int
    scan_type: str
    created_at: str


class AdminOverview(BaseModel):
    total_users: int
    registrations_last_7_days: int
    registrations_last_30_days: int
    avg_scans_per_user: float
    users_with_owned_scans: int


class AdminUserRow(BaseModel):
    id: str
    email: str
    name: str
    role: str
    provider: str
    created_at: str
    owned_items: int
