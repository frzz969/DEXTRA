#!/usr/bin/env sh
# Jalankan Next.js. Token dibaca server-side dari environment.
# apps/web punya node_modules sendiri (bukan workspace root) karena symlink
# workspace gagal dibuat di Windows; lihat docs/REPOSITORY_AUDIT.md.
set -eu
cd "$(dirname "$0")/../apps/web"
export DEXTRA_API_URL="${DEXTRA_API_URL:-http://127.0.0.1:8000}"
export DEXTRA_API_TOKEN="${DEXTRA_API_TOKEN:-ops-dev-token}"
exec node node_modules/next/dist/bin/next dev -p 3000
