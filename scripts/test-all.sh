#!/usr/bin/env sh
# Pintu masuk lama, dipertahankan supaya kebiasaan `sh scripts/test-all.sh` tetap jalan.
# Isinya ada di test-all.mjs agar Windows dan Linux menjalankan urutan yang sama persis.
exec node "$(dirname "$0")/test-all.mjs"
