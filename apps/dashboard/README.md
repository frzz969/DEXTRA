# DEXTRA Dashboard

Dashboard HTML/CSS/JS (tanpa build step, offline).

## Menjalankan

1. Seed data: `cd packages/store && npm run seed`
2. Jalankan MCP server: `cd apps/mcp-server && npm start` (port 8765)
3. Buka `apps/dashboard/index.html` di browser (atau `python -m http.server 3000` di folder apps/dashboard).

Token ops default: `ops-dev-token` (hardcoded di app.js untuk MVP).
