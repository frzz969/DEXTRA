"""Identitas dan permission.

Halaman /users dan /permissions di dashboard terkunci karena capability-nya
belum punya backend. Di sini kejujuran itu ditegakkan: /permissions melaporkan
konteks pemanggil apa adanya, dan /users menolak dengan 403 karena
`manage_users` tidak diberikan ke scope mana pun.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...core.config import get_settings
from ...core.security import (
    CAPABILITIES,
    SCOPE_CAPABILITIES,
    CallerContext,
    get_caller,
    enforced_capabilities,
    require_capability,
    unbacked_capabilities,
)
from ...core.authz import require_tenant
from ...database.session import get_db
from ...models.identity import Role, User
from ...models.tenant import Membership

router = APIRouter(tags=["identity"])


@router.get("/permissions")
def permissions(caller: CallerContext = Depends(get_caller)) -> dict:
    return {
        "scope": caller.scope,
        "principal": caller.principal,
        "capabilities": list(caller.capabilities),
        "enforced_capabilities": list(enforced_capabilities()),
        "unbacked_capabilities": list(unbacked_capabilities()),
        "all_capabilities": list(CAPABILITIES),
        "scope_capabilities": {k: list(v) for k, v in SCOPE_CAPABILITIES.items()},
        "note": "Tidak ada identitas per pengguna: token membawa wewenang, bukan nama.",
    }


@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(require_capability("manage_users")),
) -> dict:
    """Anggota tenant pemanggil. Tidak ada jalur ke pengguna tenant lain.

    Daftar ini sebelumnya mengembalikan seluruh tabel `users`. Begitu `admin`
    memegang `manage_users`, query tanpa filter tenant akan menjadi kebocoran —
    jadi filternya ada di sini, bukan di UI.
    """
    tenant_id = require_tenant(caller)
    rows = db.execute(
        select(Membership, User, Role)
        .join(User, User.id == Membership.user_id)
        .join(Role, Role.id == Membership.role_id)
        .where(Membership.tenant_id == tenant_id)
        .order_by(User.email)
    ).all()
    return {
        "items": [
            {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "role": role.name,
                "status": membership.status,
                "is_default": membership.is_default,
                "joined_at": membership.created_at.isoformat(),
            }
            for membership, user, role in rows
        ],
        "tenant_id": tenant_id,
    }


@router.get("/roles")
def list_roles(
    db: Session = Depends(get_db),
    caller: CallerContext = Depends(require_capability("manage_users")),
) -> dict:
    tenant_id = require_tenant(caller)
    rows = db.scalars(
        select(Role)
        .where((Role.tenant_id == tenant_id) | (Role.tenant_id.is_(None)))
        .order_by(Role.name)
    ).all()
    return {
        "items": [
            {
                "id": role.id,
                "name": role.name,
                "description": role.description,
                "is_system": role.is_system,
                "capabilities": sorted(perm.capability for perm in role.permissions),
            }
            for role in rows
        ]
    }


# --- Google OAuth (fondasi; status honest: butuh env GOOGLE_CLIENT_ID/SECRET) ---

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@router.get("/auth/google")
def google_login() -> dict:
    """OAuth dicabut secara eksplisit sampai sesi bisa diterbitkan dengan benar.

    Keputusan A15: session belum siap (tidak ada alur: state terverifikasi,
    tukar code->id_token dengan validasi exp/aud/iss/email_verified, lalu
    buat session cookie). Daripada mengembalikan principal tanpa sesi — yang
    memberi kesan login berhasil — endpoint ini menjawab 503 jujur.
    Response netral: tidak membocorkan konfigurasi server.
    """
    raise HTTPException(
        status_code=503,
        detail="Login Google belum tersedia.",
    )


@router.get("/auth/google/callback")
def google_callback(code: str = Query(...), state: str | None = None) -> dict:
    """Lihat google_login. Callback tidak menukar code apa pun."""
    raise HTTPException(
        status_code=503,
        detail="Login Google belum tersedia.",
    )
