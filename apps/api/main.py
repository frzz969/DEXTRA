"""Entrypoint ASGI untuk DEXTRA API.

Menambahkan backend/ ke sys.path supaya `dextra` bisa diimpor tanpa instalasi
paket. Untuk deployment, pasang backend sebagai paket (lihat pyproject.toml)
dan jalankan `uvicorn dextra.main:app`.
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from dextra.main import app  # noqa: E402  (path harus disiapkan lebih dulu)

__all__ = ["app"]
