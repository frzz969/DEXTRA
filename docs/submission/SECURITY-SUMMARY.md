# DEXTRA — Security Summary

## Findings
| ID | Temuan | Status |
| --- | --- | --- |
| D-01 | CORS wildcard + no Host check | CLOSED (tested) |
| D-02 | Agent token dicetak ke console | CLOSED (code fix, verified typecheck/test) |
| D-03 | Ops token di browser | PARTIAL (fallback removed; full proxy TBD) |
| D-04 | Approval token tidak ditegakkan | CLOSED (min length, no placeholder, reuse check) |
| D-05 | Recipient scope tidak ditegakkan | CLOSED (contact existence + ambiguous flag) |

## Prinsip
- Baca boleh otomatis, tulis harus lewat mandat.
- Validator deterministik (bukan LLM).
- Tidak ada secret di repo.
- Endpoint lokal bind 127.0.0.1.

## Catatan jujur
- D-03 belum full server-side proxy; dashboard masih menyimpan token di sessionStorage. Roadmap.
- Integrasi email/kalender masih mock.