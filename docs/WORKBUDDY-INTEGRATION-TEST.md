# DEXTRA — WorkBuddy Integration Test

## Test Cases

| ID | Skenario | Expected | Status |
| --- | --- | --- | --- |
| WB-01 | MCP connection dari WorkBuddy ke 127.0.0.1:8765 | Connected | BELUM (butuh WorkBuddy client) |
| WB-02 | Tool discovery (tools/list) | 7 read/plan tools, tanpa execute/submit/issue/revoke | BELUM |
| WB-03 | Agent token auth | Valid → scope agent | BELUM |
| WB-04 | Forbidden tool call (execute_action dengan agent token) | 403 / Forbidden | BELUM |
| WB-05 | Error handling (invalid JSON) | parse error | BELUM |
| WB-06 | Prompt-injection resistance | Tidak ada eksekusi | BELUM |
| WB-07 | mcp.json format valid (connector package) | connector-meta + mcp.json + icon.svg + skills/ | DONE (files created) |

## Catatan
- Pengujian langsung di WorkBuddy client belum dilakukan (butuh WorkBuddy Desktop).
- Server-side enforcement sudah teruji via http-verification test (origin-policy, auth).