#!/usr/bin/env sh
# Terapkan migrasi sampai head. DATABASE_URL wajib diisi.
set -eu
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?DATABASE_URL belum diisi}"
python -m alembic -c database/alembic.ini upgrade head
