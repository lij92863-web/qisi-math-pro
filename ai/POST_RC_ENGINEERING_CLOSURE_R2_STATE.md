# POST-RC ENGINEERING CLOSURE R2 — State

- Start HEAD: `da699b53abbe8a6715bb8a8ffae5a954f6b514af`
- Baseline tag: `pre-engineering-closure-r2-da699b5`
- Current branch: `stage/post-rc-engineering-closure-r2`
- Current phase: Phase 2
- Current work package: WP2N app.js slimming audit accepted; preparing atomic commit
- Status updated: 2026-07-12 Asia/Shanghai

## Completed items

- Phase 0.5 `11c9e39`; Phase 1 `20f3cf9`; WP2A `3b93225`; WP2B `5ebf2ff`; WP2C `90946e3`; WP2D `02fbd5b`; WP2E `4a52e4b`; WP2F `8384cbc`; WP2G `b10040a`; WP2H `56ce991`; WP2I `d772280`; WP2J `13f79e1`; WP2K `b05a0bd`; WP2L `64ae5e5`; WP2M `64c33d5`.
- Added isolated Playwright harness with unique ports, isolated browser contexts, and blocked AI/OCR routes.
- Added browser startup, mock DOCX/PDF upload + review/confirm/insert, reload persistence, export/download, recent-task deletion, and formal-data preservation tests.
- Verified deletion of recent-task data preserves the independently stored formal question.
- Added the canonical `qisi.question.v1` recognition/question contract owner with immutable factories, validators, provenance/raw-evidence preservation, stable errors, and the sole legacy compatibility mapping.
- Confirmed-question validation requires both controlled-write acceptance and explicit manual confirmation evidence.
- Added the storage repository owner for library reads, atomic question/image writes, optimistic conflicts, idempotent confirmation, soft delete/restore, recent tasks, drafts, JSON preferences, transactions, and versioned backup/restore.
- Migrated active library load, image reference reads, edited-question saves, recent-task deletion, export reads, and preference serialization to the repository boundary.
- Added the pure library service for search/filter, knowledge descendants, stable sort, pagination, batch selection, duplicate detection, metadata aggregation, and repository-delegated soft delete/restore.
- Migrated the Vue library computed query and pagination to the service without DOM, OCR, parser, or storage-backend dependencies.
- Added the review controller for immutable field edits, dirty/manual state, warning lifecycle, provenance display, validation requests, cancel, and manual confirmation.
- Migrated review field updates and confirmation decisions while leaving persistence outside the controller and preserving the existing validation/controlled-write chain.
- Added the export service for schema-compatible question/image mapping, stable filename generation, progress, cancellation, and structured error mapping.
- Migrated ZIP export plan construction to the service while retaining JSZip/download browser effects in the UI adapter.
- Added the import orchestrator for DOCX/PDF/batch routing, progress, cancellation, candidate aggregation, validator enforcement, review handoff, duplicate-run locking, and error mapping.
- Migrated the live batch recognition wrapper to the orchestrator while retaining the proven legacy batch handler as an injected dependency.
- Added the versioned OCR ground-truth schema, ten-category synthetic corpus, validator, and deterministic scoring for CER, LaTeX F1, formula exactness, structure, options, ownership safety, and manual correction cost.
- Explicitly ignored private OCR benchmark materials; synthetic fixtures are labeled non-real evidence.
- Added the OCR engine registry plus Qwen and loopback-local adapters returning canonical RecognitionCandidate values via injected transports.
- Enforced registry default/health/capabilities/timeout/cancellation and local MIME/size/no-path/loopback boundaries; no adapter owns alignment or writing.
- Added isolated OCR shadow comparison retaining separate candidates while emitting raw-content-free structured metrics.
- Shadow output is explicitly ineligible for review, controlled-write, auto-selection, supplementation, or field merging; conflicts require manual review.
- Recorded the WP2M no-change decision because only synthetic scoring evidence exists; frozen recognition/safety owners remain unchanged.
- Audited the ordered app owner migrations, removed the obsolete filename helper, and added app-shell boundary guards without forced line-count refactoring.

## Pending items

- WP2N atomic commit and push.
- WP2O–WP2P and Phase 3–8.

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
- WP2G targeted tests: 5/5 passed; reactive Proxy regression covered.
- WP2G browser product acceptance and final mandatory matrix passed; no controller repository write exists.
- WP2H targeted tests: 4/4 passed; browser E2E 4/4 and final mandatory matrix passed.
- WP2I targeted tests: 4/4 passed; browser acceptance and final mandatory matrix passed.
- WP2J scoring tests: 4/4 passed; ten synthetic categories validate and final mandatory matrix passed with no OCR/API call.
- WP2K adapter/registry tests: 4/4 passed; runtime/no-real-AI and final mandatory matrix passed using mock transports only.
- WP2L shadow isolation tests: 2/2 passed; runtime/no-real-AI and final mandatory matrix passed.
- WP2N app-shell guard: 2/2; runtime 8/8, browser 4/4, and final mandatory matrix passed.
- Preflight and dry-run passed with `realApiCalled=false` and `underlyingApiCallCount=0`.

## Browser E2E results

- Four Playwright suites passed: 4/4, 0 skipped.
- Covered startup/script loading, mock DOCX/PDF safe-partial upload, review edits, confirmation, formal insertion, reload persistence, export download, recent-task deletion, and console/project errors.

## Benchmark results

- Deterministic scoring harness and ten-category synthetic corpus pass.
- No authorized real OCR corpus/run exists; synthetic results are not claimed as real quality improvement, so WP2M production changes are deferred.

## Known limitations

- Mock upload validates the real UI/file-role path; recognition results are deterministic seeded candidates because real AI/OCR is forbidden.
- Full import orchestration receives production contract coverage in WP2I.
- `qisi-db.js` retains the proven Dexie physical version bootstrap; residual legacy app transaction call sites migrate through the repository during ordered WP2N slimming rather than rewriting the historical schema chain in WP2E.
- app.js reduction is 264/22,043 physical lines (1.20%), below the suggested 20%; 131 high-risk legacy DB call sites remain and are not force-extracted.

## Next exact action

Commit `stage closure r2 audit app shell slimming`, push, then begin WP2O performance baseline and optimization.
