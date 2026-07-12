# POST-R2 CORRECTION R1 — State

- Start commit: `6ab88d0551be5af24d134f17906ba0c42631b2ea`
- Baseline tag: `pre-post-r2-correction-r1-6ab88d0`
- Current branch: `stage/post-r2-correction-r1`
- Current phase: Program A / Phase 2
- Current work package: A2-6 truthful import coordinator boundary accepted;
  preparing atomic commit
- Status updated: 2026-07-13 Asia/Shanghai

## Completed

- Read the complete three-program R3 master plan.
- Read repository instructions, required AI governance files, and the Git stage
  workflow skill.
- Confirmed the starting working tree was clean and the active branch was
  `main`.
- Fetched live remote main and confirmed local `HEAD`, `origin/main`, and live
  `refs/heads/main` were all
  `6ab88d0551be5af24d134f17906ba0c42631b2ea`.
- Confirmed both local/remote comparison ranges were empty.
- Confirmed `v1.1.0-rc1-engineering-closure-r2` still points at the R2 final
  commit.
- Created and pushed annotated baseline tag
  `pre-post-r2-correction-r1-6ab88d0`.
- Created and pushed `stage/post-r2-correction-r1` from the verified baseline.
- Independently audited the R2 production wiring, formal writes, contract call
  sites, seeded E2E coverage, architecture guards, and stale release ledger.
- Designed source-aware Formal Admission, question schema v2, the repository
  confirmation transaction, and true deterministic import E2E.
- Implemented the pure source-aware Formal Admission Policy with immutable
  decisions, per-field provenance, fail-closed mode rules, decision validation,
  and question-v2 construction.
- Extended the canonical recognition/contracts owner with immutable question v2
  runtime validation and a non-persistable legacy read-only compatibility view.
- Added repository-owned `confirmDraftToQuestion` with fresh policy re-evaluation,
  v2 validation, atomic question/image/draft/batch writes, optimistic versioning,
  idempotency, and stable failure codes.
- Wired the real batch submit path through a production
  `BatchFormalSubmit` owner, Formal Admission Policy, and the repository
  transaction; removed the submit path's direct formal-table transaction.
- Added field-level manual revision tracking for actual editor changes while
  preserving deterministic and controlled-write evidence on untouched fields.
- Upgraded the seeded review fixture to carry draft versions, source mode, and
  complete field provenance without converting click-only confirmation into a
  manual edit.
- Removed permissive default validators from ImportOrchestrator and
  ReviewController; missing, malformed, throwing, and explicitly invalid
  validators now fail closed before handoff or confirmation.
- Replaced the misleading production ImportOrchestrator/no-op-validator wiring
  with `LegacyBatchRunCoordinator`, which truthfully identifies the active
  workflow as a legacy business-and-persistence boundary and verifies its
  persisted terminal state.
- Recorded that candidate production validation and the six proposed import
  extraction steps remain deferred debt rather than completed architecture.

## Pending

- A2-7 through A2-10 review validation, true E2E, architecture manifest, and
  operational hardening.
  boundary, review validation, true E2E, architecture manifest, and operational
  hardening.
- Phase 3 through Phase 8 attacks, audits, benchmark, CTO review, and sealing.

## Commits

- Phase 0 baseline state `d326e0b`.
- Phase 1 architecture and truth audit `92d913b`.
- A2-1 Formal Admission Policy `b7feeef`.
- A2-2 question schema v2 `4544270`.
- A2-3 formal question transaction `6da4247`.
- A2-4 batch formal submit production wiring `45d7101`.
- A2-5 controller fail-closed behavior `dab55b6`.

## Gates

- Starting Git reality gate: passed.
- R2 tag immutability check: passed.
- `verify:safe`: passed with 1013/1013 tests, 0 skipped.
- Batch mock smoke: passed 20/20.
- `verify:no-real-ai`: passed as part of the safe gate.
- Phase 0 exact diff-scope verification: passed for this state file only.
- Phase 1 explicit `verify:no-real-ai`: passed.
- Phase 1 `verify:safe`: passed with 1013/1013 tests, 0 skipped; batch mock
  smoke passed 20/20.
- Phase 1 docs/ai exact diff-scope verification: passed.
- A2-1 failure-first evidence: module-not-found before implementation.
- A2-1 targeted syntax and policy tests: passed 12/12, 0 skipped.
- A2-1 full mandatory matrix: passed.
- A2-1 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-2 failure-first evidence: v2 validator and legacy adapter exports missing.
- A2-2 targeted v1/v2/policy/compatibility tests: passed 33/33, 0 skipped.
- A2-2 full mandatory matrix: passed.
- A2-2 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-3 failure-first evidence: repository transaction API missing.
- A2-3 transaction/concurrency plus storage regression tests: passed 19/19.
- A2-3 full mandatory matrix: passed.
- A2-3 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-4 failure-first evidence: production submit still directly called
  `db.questions.put` and produced a legacy formal record without schema v2.
- A2-4 production-linked AppProxy, formal-owner, repository, and seeded UI
  lifecycle tests: passed.
- A2-4 `verify:safe`: passed with 1047/1047 tests, 0 skipped; batch mock smoke
  passed 20/20.
- A2-4 full mandatory matrix: passed, including app shell 21,780-line gate,
  DOCX stable chain, PDF known-bad and ownership gates.
- A2-4 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-5 failure-first evidence: both controllers accepted a missing validator;
  malformed results were not distinguished and validator exceptions escaped.
- A2-5 targeted fail-closed and controller regressions: passed 24/24.
- A2-5 `verify:safe`: passed with 1055/1055 tests, 0 skipped; batch mock smoke
  passed 20/20.
- A2-5 full mandatory matrix: passed.
- A2-5 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-6 failure-first evidence: the required legacy coordinator owner was
  missing and production still used an unconditional `valid:true` callback.
- A2-6 coordinator, production-boundary, shell, quality, and seeded UI tests:
  passed 11/11.
- A2-6 `verify:safe`: passed with 1059/1059 tests, 0 skipped; batch mock smoke
  passed 20/20.
- A2-6 full mandatory matrix: passed.
- A2-6 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.

## Blockers

- None.
- Real AI/OCR and model download remain disabled.

## Next exact action

Run exact A2-6 diff-scope verification, commit/push, then begin A2-7 production
review validator wiring.
