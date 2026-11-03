"""Identitas dan permission.

Halaman /users dan /permissions di dashboard terkunci karena capability-nya
belum punya backend. Di sini kejujuran itu ditegakkan: /permissions melaporkan
konteks pemanggil apa adanya, dan /users menolak dengan 403 karena
`manage_users` tidak diberikan ke scope mana pun.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

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
