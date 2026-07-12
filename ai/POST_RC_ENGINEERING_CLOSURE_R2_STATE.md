# POST-RC ENGINEERING CLOSURE R2 — State

- Start HEAD: `da699b53abbe8a6715bb8a8ffae5a954f6b514af`
- Baseline tag: `pre-engineering-closure-r2-da699b5`
- Current branch: `stage/post-rc-engineering-closure-r2`
- Current phase: Phase 2
- Current work package: WP2F library service accepted; preparing atomic commit
- Status updated: 2026-07-12 Asia/Shanghai

## Completed items

- Phase 0.5 `11c9e39`; Phase 1 `20f3cf9`; WP2A `3b93225`; WP2B `5ebf2ff`; WP2C `90946e3`; WP2D `02fbd5b`; WP2E `4a52e4b`.
- Added isolated Playwright harness with unique ports, isolated browser contexts, and blocked AI/OCR routes.
- Added browser startup, mock DOCX/PDF upload + review/confirm/insert, reload persistence, export/download, recent-task deletion, and formal-data preservation tests.
- Verified deletion of recent-task data preserves the independently stored formal question.
- Added the canonical `qisi.question.v1` recognition/question contract owner with immutable factories, validators, provenance/raw-evidence preservation, stable errors, and the sole legacy compatibility mapping.
- Confirmed-question validation requires both controlled-write acceptance and explicit manual confirmation evidence.
- Added the storage repository owner for library reads, atomic question/image writes, optimistic conflicts, idempotent confirmation, soft delete/restore, recent tasks, drafts, JSON preferences, transactions, and versioned backup/restore.
- Migrated active library load, image reference reads, edited-question saves, recent-task deletion, export reads, and preference serialization to the repository boundary.
- Added the pure library service for search/filter, knowledge descendants, stable sort, pagination, batch selection, duplicate detection, metadata aggregation, and repository-delegated soft delete/restore.
- Migrated the Vue library computed query and pagination to the service without DOM, OCR, parser, or storage-backend dependencies.

## Pending items

- WP2F atomic commit and push.
- WP2G–WP2P and Phase 3–8.

## Blocked items

- None. Real AI/OCR remains disabled.

## Gate results

- WP2A, WP2B, and WP2C mandatory matrices passed.
- WP2C `verify:safe`: 944/944 passed, 0 skipped.
- WP2C runtime dependency gate: 8/8 passed.
- WP2D contract/compatibility targeted tests: 10/10 passed.
- WP2D final mandatory matrix passed after the last production change.
- WP2E storage/migration/failure targeted tests: 10/10 passed.
- WP2E browser E2E: 4/4 passed; final mandatory matrix passed with `npm test` 964/964 and 0 skipped.
- WP2F targeted tests: 7/7 passed, including 100/1000/5000 metadata records.
- WP2F browser E2E: 4/4 passed; final mandatory matrix passed with `npm test` 971/971 and 0 skipped.
- Preflight and dry-run passed with `realApiCalled=false` and `underlyingApiCallCount=0`.

## Browser E2E results

- Four Playwright suites passed: 4/4, 0 skipped.
- Covered startup/script loading, mock DOCX/PDF safe-partial upload, review edits, confirmation, formal insertion, reload persistence, export download, recent-task deletion, and console/project errors.

## Benchmark results

- Specification complete; execution pending.

## Known limitations

- Mock upload validates the real UI/file-role path; recognition results are deterministic seeded candidates because real AI/OCR is forbidden.
- Full import orchestration receives production contract coverage in WP2I.
- `qisi-db.js` retains the proven Dexie physical version bootstrap; residual legacy app transaction call sites migrate through the repository during ordered WP2N slimming rather than rewriting the historical schema chain in WP2E.

## Next exact action

Audit the WP2F diff, commit `stage closure r2 extract library service`, push, then begin WP2G review controller.
