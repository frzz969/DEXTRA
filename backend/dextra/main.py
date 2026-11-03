"""Aplikasi FastAPI DEXTRA v2.

Semua endpoint di bawah /api/v1. Tidak ada endpoint yang terbuka tanpa token —
termasuk /overview, karena ringkasan operasional tetap informasi internal.
Pengecualian hanya /health, yang tidak mengembalikan data bisnis.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import get_settings
from .database.session import database_health
from .modules.approvals.router import router as approvals_router
from .modules.audit.router import router as audit_router
from .modules.execution.router import router as execution_router
from .modules.identity.router import router as identity_router
from .modules.mandates.router import router as mandates_router
from .modules.overview.router import router as overview_router
from .modules.policies.router import router as policies_router
from .modules.tasks.router import router as tasks_router
from .modules.workforce.router import router as workforce_router

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="DEXTRA API",
        version="2.0.0",
        description="Governed Enterprise AI Workforce & Operations Platform",
    )

    # Allowlist eksplisit. Tidak ada "*" — wildcard CORS pada API yang memegang
    # wewenang eksekusi akan membatalkan seluruh pemisahan scope.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    for router in (
        overview_router,
        workforce_router,
        tasks_router,
        execution_router,
        approvals_router,
        mandates_router,
        policies_router,
        audit_router,
        identity_router,
    ):
        app.include_router(router, prefix=API_PREFIX)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        db = database_health()
        return {
            "ok": db["ok"],
            "service": "dextra-api",
            "version": "2.0.0",
            "database": db,
            "environment": settings.environment,
        }

    @app.get(f"{API_PREFIX}/meta", tags=["meta"])
    def meta() -> dict:
        return {
            "api_prefix": API_PREFIX,
            "capabilities": [
                "view_own",
                "view_all",
                "create_request",
                "approve",
                "issue_mandate",
                "revoke_mandate",
                "execute",
                "view_audit",
            ],
            "unbacked_capabilities": ["edit_policy", "manage_users", "manage_integrations"],
        }

    return app


app = create_app()
