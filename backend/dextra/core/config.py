"""Konfigurasi runtime DEXTRA v2.

Dibaca dari environment setiap kali dipakai, bukan saat modul dimuat, supaya
rotasi token dan perubahan DATABASE_URL tidak menuntut restart proses.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    return default if value is None or value == "" else value


@dataclass(frozen=True)
class Settings:
    database_url: str
    agent_token: str
    ops_token: str
    allowed_origins: tuple[str, ...]
    environment: str
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


def get_settings() -> Settings:
    raw_origins = _env(
        "DEXTRA_ALLOWED_ORIGINS",
        "http://127.0.0.1:8899,http://localhost:8899,http://127.0.0.1:3000,http://localhost:3000",
    )
    origins = tuple(o.strip() for o in raw_origins.split(",") if o.strip())
    return Settings(
        database_url=_env("DATABASE_URL", "sqlite+pysqlite:///./data/dextra-v2.db"),
        agent_token=_env("DEXTRA_AGENT_TOKEN", "agent-dev-token"),
        ops_token=_env("DEXTRA_OPS_TOKEN", "ops-dev-token"),
        allowed_origins=origins,
        environment=_env("DEXTRA_ENV", "development"),
        google_client_id=_env("GOOGLE_CLIENT_ID", ""),
        google_client_secret=_env("GOOGLE_CLIENT_SECRET", ""),
        google_redirect_uri=_env("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/api/v1/auth/google/callback"),
    )
