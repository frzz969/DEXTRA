"""Identitas dan permission.

Halaman /users dan /permissions di dashboard terkunci karena capability-nya
belum punya backend. Di sini kejujuran itu ditegakkan: /permissions melaporkan
konteks pemanggil apa adanya, dan /users menolak dengan 403 karena
`manage_users` tidak diberikan ke scope mana pun.
"""
from __future__ import annotations

import urllib.parse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.config import get_settings
from ...core.security import (
    CAPABILITIES,
    SCOPE_CAPABILITIES,
    UNBACKED_CAPABILITIES,
    CallerContext,
    get_caller,
    require_capability,
)
from ...database.session import get_db
from ...models.identity import Role, User

router = APIRouter(tags=["identity"])


@router.get("/permissions")
def permissions(caller: CallerContext = Depends(get_caller)) -> dict:
    return {
        "scope": caller.scope,
        "principal": caller.principal,
        "capabilities": list(caller.capabilities),
        "unbacked_capabilities": list(UNBACKED_CAPABILITIES),
        "all_capabilities": list(CAPABILITIES),
        "scope_capabilities": {k: list(v) for k, v in SCOPE_CAPABILITIES.items()},
        "note": "Tidak ada identitas per pengguna: token membawa wewenang, bukan nama.",
    }


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(require_capability("manage_users")),
) -> dict:
    # Tidak akan tercapai selama manage_users tidak diberikan ke scope mana pun.
    rows = db.scalars(select(User).order_by(User.email)).all()
    return {"items": [{"id": u.id, "email": u.email, "display_name": u.display_name} for u in rows]}


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(require_capability("manage_users")),
) -> dict:
    rows = db.scalars(select(Role).order_by(Role.name)).all()
    return {"items": [{"id": r.id, "name": r.name, "permissions": len(r.permissions)} for r in rows]}


# --- Google OAuth (fondasi; status honest: butuh env GOOGLE_CLIENT_ID/SECRET) ---

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@router.get("/auth/google")
def google_login() -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth belum dikonfigurasi: set GOOGLE_CLIENT_ID (dan GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI).",
        )
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return {"authorization_url": GOOGLE_AUTH_URL + "?" + urllib.parse.urlencode(params)}


@router.get("/auth/google/callback")
def google_callback(code: str = Query(...), state: str | None = None) -> dict:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth belum dikonfigurasi.")
    with httpx.Client(timeout=15.0) as client:
        token_res = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if token_res.status_code != 200:
        raise HTTPException(status_code=400, detail="Gagal menukar code: " + token_res.text)
    tokens = token_res.json()
    id_token = tokens.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Google tidak mengembalikan id_token.")
    with httpx.Client(timeout=15.0) as client:
        info_res = client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})
    if info_res.status_code != 200:
        raise HTTPException(status_code=400, detail="ID token tidak valid.")
    info = info_res.json()
    if info.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=400, detail="audience mismatch.")
    if info.get("iss") not in ("https://accounts.google.com", "accounts.google.com"):
        raise HTTPException(status_code=400, detail="issuer mismatch.")
    return {
        "principal": {
            "sub": info.get("sub"),
            "email": info.get("email"),
            "name": info.get("name"),
            "picture": info.get("picture"),
        },
        "note": "Fondasi OAuth. Sesi server-side (cookie/JWT) belum diimplementasikan; token mentah tidak disimpan.",
    }
