# DEXTRA — Submission Checklist

## Artifacts
- [ ] Video demo 7 menit (docs/submission/DEMO-SCRIPT.md)
- [ ] Surprise-test 90 detik (docs/submission/SURPRISE-TEST-SCRIPT.md)
- [ ] Cover image 16:9
- [ ] Registrasi organizer (https://qdrl.qq.com/fc97Jrkr)
- [ ] Empat pertanyaan submission (menunggu informasi dari materi submission)

## Git
- [ ] Commit final
- [ ] Annotated tag `hackathon-submission`
- [ ] Push branch + tag

## Pre-tag verification (semua harus lulus)
- [ ] `pnpm run typecheck` (clean)
- [ ] `pnpm run test:inproc` (all pass)
- [ ] `pnpm run test:http` (pass)
- [ ] Security tests (D-02–D-05)
- [ ] TC-001 manual (live build)
- [ ] TC-009 manual (live build)
- [ ] Idempotency tests
- [ ] Demo seed dari kondisi bersih
- [ ] Dashboard + MCP server berjalan
- [ ] E2E flow
- [ ] Tidak ada secret di repo/log
- [ ] Git diff review
- [ ] Tidak ada file sensitif ter-commit

## Status
- Tag `hackathon-submission` BELUM dibuat (menunggu verifikasi lengkap).