"""Otorisasi: token -> scope -> capability.

Ini adalah cermin dari packages/contracts/src/authorization.ts. Kalau keduanya
menyimpang, salah satu server akan mengizinkan hal yang ditolak server lain.
`tests/security/test_authorization_parity.py` membandingkan daftar capability
Python dengan kontrak TypeScript supaya penyimpangan itu ketahuan.

Yang penting dan sering disalahpahami: **token tidak membawa identitas**.
Scope adalah himpunan kemampuan, bukan orang. `principal` selalu None sampai
ada sistem identitas yang benar-benar memverifikasi pemanggil.
"""
from __future__ import annotations

import hmac
from dataclasses import dataclass, field
from typing import Literal

from fastapi import Depends, Header, HTTPException, status

from .config import get_settings

Scope = Literal["agent", "ops"]

#: Semua capability yang dikenal sistem.
CAPABILITIES: tuple[str, ...] = (
    "view_own",
    "view_all",
    "create_request",
    "approve",
    "issue_mandate",
    "revoke_mandate",
    "execute",
    "view_audit",
    "edit_policy",
    "manage_users",
    "manage_integrations",
)

#: Capability yang tidak diberikan ke scope mana pun. Dilaporkan apa adanya
#: sebagai "belum tersedia" — bukan "ditolak", karena tidak ada keputusan.
UNBACKED_CAPABILITIES: tuple[str, ...] = (
    "edit_policy",
    "manage_users",
    "manage_integrations",
)

SCOPE_CAPABILITIES: dict[str, tuple[str, ...]] = {
    "agent": ("view_own", "view_all", "create_request"),
    "ops": (
        "view_own",
        "view_all",
        "create_request",
        "approve",
        "issue_mandate",
        "revoke_mandate",
        "execute",
        "view_audit",
    ),
}


@dataclass(frozen=True)
class CallerContext:
    scope: Scope
    principal: None = None
    capabilities: tuple[str, ...] = field(default_factory=tuple)
    unbacked_capabilities: tuple[str, ...] = UNBACKED_CAPABILITIES

    def can(self, capability: str) -> bool:
        return capability in self.capabilities


def resolve_scope(token: str | None) -> Scope | None:
    """Petakan bearer token ke scope. Tidak ada fallback dan tidak ada scope default."""
    if not token:
        return None
    settings = get_settings()
    candidates: tuple[tuple[Scope, str], ...] = (
        ("agent", settings.agent_token),
        ("ops", settings.ops_token),
    )
    for scope, expected in candidates:
        # compare_digest menuntut tipe yang sama dan panjang yang sama;
        # perbandingan panjang eksplisit menghindari menjadi oracle waktu.
        if len(token) == len(expected) and hmac.compare_digest(token, expected):
            return scope
    return None


def caller_context(scope: Scope) -> CallerContext:
    return CallerContext(scope=scope, capabilities=SCOPE_CAPABILITIES[scope])


async def get_caller(authorization: str | None = Header(default=None)) -> CallerContext:
    """Dependency FastAPI: default-deny.

    Tidak ada header -> 401. Token tidak dikenal -> 401. Token dikenal tetapi
    scope tidak punya capability -> 403, dan itu diputuskan di `require_capability`.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token bearer tidak ada.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    scope = resolve_scope(token)
    if scope is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak dikenali.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return caller_context(scope)


def require_capability(capability: str):
    """Dependency factory: menolak 403 jika scope pemanggil tidak punya capability."""
    if capability not in CAPABILITIES:
        raise ValueError(f"Capability tidak dikenal: {capability}")

    async def dependency(caller: CallerContext = Depends(get_caller)) -> CallerContext:
        if not caller.can(capability):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope {caller.scope} tidak memiliki capability {capability}.",
            )
        return caller

    return dependency
