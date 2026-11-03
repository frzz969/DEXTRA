#!/usr/bin/env sh
# Semua pemeriksaan yang bisa dijalankan di mesin ini, dalam urutan yang masuk akal:
# paket JS dulu (murah), lalu Python (mahal), lalu paritas paket.
set -eu
cd "$(dirname "$0")/.."

echo "== paket tersinkron =="
node scripts/verify-packages.mjs

echo "== tes Node =="
npm test

echo "== tes HTTP gateway =="
npm run test:http

echo "== tes Python =="
python -m pytest tests -q
