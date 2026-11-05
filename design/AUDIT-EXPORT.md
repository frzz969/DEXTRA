# P4 — Audit Export & Independent Verification

Status: implemented. Format version `1.0.0`.

## 1. What this is

`export_audit` copies the audit log into a JSONL artifact and writes a manifest
beside it. A separate command verifies that pair without the MCP server, the
dashboard, or the data directory:

```
node --experimental-strip-types packages/audit-export/src/cli.ts <path>
```

`<path>` may be the `.jsonl`, the `.manifest.json`, or the directory holding one
export. Exit `0` verified, `1` failed, `2` unreadable.

## 2. Why the verifier is a second implementation

`packages/store/src/repository.ts` already verifies the chain. Reusing it would
have been less code and much less confidence: a verifier that shares the writer's
logic agrees with the writer by construction, including when both are wrong.

So the canonical hash rule exists three times:

| Where | Role |
| --- | --- |
| `packages/store/src/repository.ts` | writes the live chain, verifies it for the endpoint |
| `packages/audit-export/src/canonical.ts` | hashes for the exporter |
| `packages/audit-export/src/verify.ts` | recomputes, independently |

`packages/audit-export/tests/parity.test.ts` compares all three over a corpus
covering every optional field, empty detail, unsorted detail keys, and unicode.
If someone changes the field list in one place, that test fails. That is the
whole mechanism keeping three copies honest, and it is why the duplication is
acceptable rather than sloppy.

## 3. Export format

`<export_id>.jsonl` — one event per line, **copied byte-for-byte from the live
log**. Nothing is re-serialised, so `event_id`, `prev_hash`, and `hash` are the
stored values and no hash is recomputed to make the export look valid. The
artifact checksum therefore describes the bytes that were actually stored.

`<export_id>.manifest.json`:

| Field | Meaning |
| --- | --- |
| `format_version` | `1.0.0`; bumped when the event schema, manifest shape, or hash rule changes |
| `export_id` | `exp_` + 12 hex, random per export |
| `exported_at` | ISO 8601 UTC |
| `exported_by` | principal id, or `scope:<name>` when the token has no bound principal |
| `source.file` | basename only — an absolute path would leak the exporter's layout |
| `event_count` | events in the artifact |
| `range.first` / `range.last` | `{event_id, at, hash}` of the first and last event |
| `integrity` | the verdict at export time: `verified`, `unchained`, `broken_at`, `broken_index`, `malformed_at`, `checkpoint_status`, `ok` |
| `checkpoint` | `{event_count, head_hash, at}` or `null` |
| `artifact` | `{file, sha256, bytes, lines}` |

The manifest schema is `.strict()`: an unknown field is a failed verification,
not a field to ignore.

## 4. What the verifier checks

| Check | Catches |
| --- | --- |
| `manifest.structure` | malformed manifest, unknown field, wrong format version |
| `artifact.exists` / `artifact.name` | missing artifact, manifest pointing at another file |
| `artifact.sha256` / `artifact.bytes` | any byte changed without the manifest being updated |
| `event.structure` | a line that parses as JSON but is not an event |
| `event.parse` | an unparseable line |
| `event.ids_unique` | a duplicated event, even when the chain still joins |
| `event.count` | added or removed events |
| `event.range` | different first or last event than the manifest claims |
| `chain.linkage` | deletion, insertion, reordering, a `prev_hash` pointing elsewhere |
| `chain.hash` | edited content under a stored hash |
| `integrity.matches` | any manifest verdict field that differs from the recomputed one |
| `unchained.not_verified` | unhashed events counted as verified |
| `checkpoint.consistent` | artifact shorter than the checkpoint, or ending elsewhere |
| `export.nonempty` | an empty artifact, which vouches for nothing |
| `export.identity`, `export.time`, `export.principal` | reported **unverifiable**, never passed |

`verified`, `unchained`, and `broken` stay separate everywhere: an event written
before the chain existed is counted as `unchained` and can never appear in
`verified`.

## 5. Security

- Capability is `view_audit` — the same one that governs reading the log. A new
  capability would be a new authorization concept for the same authority, which
  P4 forbids. `agent` holds `view_all` but not `view_audit`, so an agent cannot
  export, and the refusal is `ACTION_NOT_ALLOWED` rather than an empty export.
- The output directory comes from the store layout, not from the caller.
- No code path writes to `audit.jsonl`. The tests read the file before and after
  an export and compare bytes.
- The artifact checksum is **not** a replacement for the hash chain: it proves
  "these bytes are the bytes that were exported", nothing about their content.
  The chain is checked separately.

## 6. Operations

- The source is streamed. Memory is O(1) in file size for both export and
  verification; only the set of `event_id`s grows, and that is bounded by the
  file-size limit.
- Limit: **64 MiB** source (`MAX_SOURCE_BYTES`), roughly 200 000 events. Above
  that the export is refused with `SOURCE_TOO_LARGE` instead of being truncated.
- Partial exports: the artifact is written as `<id>.jsonl.partial` and renamed
  only after the stream closes; the manifest is written last. A crash therefore
  leaves a `.partial` file with no manifest, which the verifier refuses. A
  missing manifest means "this export did not finish".
- Export failure is reported to the caller as an error code; nothing is written
  to the audit log about the export. Writing an audit event during an audit
  export is circular, and a failed export is not a fact about the organisation's
  work.
- The export does not lock the log for longer than one read pass.

## 7. Limits — what this does not prove

1. **The manifest is claims, not a signature.** The verifier recomputes every
   field it can and marks the rest unverifiable. An attacker who rewrites the
   artifact *and* every hash *and* the manifest consistently produces a pair this
   verifier accepts. That is inherent to a hash chain whose anchor travels with
   the evidence. Turning evidence into proof needs the checkpoint (or the
   `export_id` + checksum) recorded somewhere the exporter cannot reach.
2. **The export is not a backup.** Nothing here copies the artifact to separate
   storage, and the repository is not immutable storage.
3. **Known defect, not fixed here:** the live endpoint (`get_audit_log` →
   `listAuditWithIntegrity`) still reports `ok: true` for a log with zero events,
   because `verifyAuditChain` has no bad link to find. The verifier refuses that
   case (`export.nonempty`), which means an export of an empty log verifies as
   FAILED while the endpoint says ok. The two disagree on purpose; changing the
   endpoint's behaviour is outside P4 and is recorded here rather than done
   quietly.
4. **Two reads, not one, when verifying.** Bytes are hashed while lines are
   parsed in the same pass, so this is one pass; but the file must not change
   during verification. There is no file lock on the artifact.
5. **No dashboard button.** Export is reachable as an MCP tool and as the CLI.
   The Security Center does not call it yet; that is UI work, not a gap in the
   export itself.

## 8. Deliberate non-goals

PostgreSQL migration, transactional outbox, hash-chain format changes, audit
retention or deletion, authorization model changes, Skill Registry, LangGraph.
None of these are touched.

## 9. Tests

- `packages/audit-export/tests/parity.test.ts` — three implementations agree,
  including on a broken chain.
- `packages/audit-export/tests/export.test.ts` — source untouched, manifest
  matches the artifact, checkpoint `matches`/`ahead`/`truncated`/`head_mismatch`,
  malformed prefix, unchained prefix, missing source, size limit, no `.partial`
  left behind.
- `packages/audit-export/tests/verify.test.ts` — 15 tests: one clean pass, and
  one refusal each for edited detail, deleted, inserted, reordered, wrong
  `prev_hash`, wrong hash, modified manifest, wrong checksum, unchained claimed
  as verified, unknown manifest field, missing artifact, truncated artifact,
  duplicated id, and an empty export.
- `apps/mcp-server/tests/audit-export-tool.test.ts` — ops may export and the
  result verifies; the log is unchanged; agent is refused; two exports differ;
  a missing log reports `SOURCE_NOT_FOUND`.

Negative controls (each guard disabled in turn, then restored, restore verified
by hash): every one makes a named test fail. See the P4 report.
