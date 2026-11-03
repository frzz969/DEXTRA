#!/usr/bin/env sh
# Jalankan API dengan reload. Default SQLite supaya bisa langsung jalan tanpa
# PostgreSQL; isi DATABASE_URL untuk memakai PostgreSQL.
set -eu
cd "$(dirname "$0")/.."
export DATABASE_URL="${DATABASE_URL:-sqlite+pysqlite:///./data/dextra-v2.db}"
export PYTHONPATH="backend${PYTHONPATH:+:$PYTHONPATH}"
exec python -m uvicorn dextra.main:app --host 127.0.0.1 --port 8000 --reload
