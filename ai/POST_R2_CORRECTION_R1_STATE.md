# POST-R2 CORRECTION R1 — State

- Start commit: `6ab88d0551be5af24d134f17906ba0c42631b2ea`
- Baseline tag: `pre-post-r2-correction-r1-6ab88d0`
- Current branch: `stage/post-r2-correction-r1`
- Current phase: Program A / Phase 2
- Current work package: A2-9 architecture ownership manifest accepted;
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
- Added a directly testable production review validator that composes existing
  content checks with draft identity/version/source checks, field-level manual
  revision state, complete provenance, and a Formal Admission Policy precheck.
- Wired ReviewController and the pre-submit review check to that real validator;
  global edit/confirm booleans cannot wash a rejected field into manual.
- Reclassified the three R2 browser tests as seeded review, persistence, and
  export/delete lifecycles instead of complete import proof.
- Added a repository-backed injected candidate path used only by an explicitly
  marked mock transport, plus true UI-entry DOCX, PDF safe-partial, and
  admission E2E coverage.
- Proved gap prefix behavior, raw JSON rejection, answer/solution ownership
  rewind rejection, click-only rejection, field-level teacher rewrite,
  transactional review persistence, formal v2 admission, reload persistence,
  sanitized export, and localhost-only browser execution.
- Added complete layer and domain-owner manifests for all required architecture
  owners plus the corrective release composition modules.
- Added automated guards for dependency direction/cycles, duplicate ownership,
  app-shell reimplementation, adapter/OCR authority, permissive controllers,
  formal-submit bypass, and research-only production loading.

## Pending

- Phase 3 through Phase 8 attacks, audits, benchmark, CTO review, and sealing.

## Commits

- Phase 0 baseline state `d326e0b`.
- Phase 1 architecture and truth audit `92d913b`.
- A2-1 Formal Admission Policy `b7feeef`.
- A2-2 question schema v2 `4544270`.
- A2-3 formal question transaction `6da4247`.
- A2-4 batch formal submit production wiring `45d7101`.
- A2-5 controller fail-closed behavior `dab55b6`.
- A2-6 truthful import coordinator boundary `f33cf7a`.
- A2-7 production review validator wiring `173fa19`.
- A2-8 true deterministic import E2E `36c919b`.
- A2-9 architecture ownership guards `10e1240`.
- A2-10 hostile archive hardening `52f6252`.
- A2-10 temporary-job lifecycle `52316ba`.
- A2-10 private-safe logging `c8e6ab2`.

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
- A2-7 failure-first evidence: the production review validator owner was
  missing and the app used only content/display checks.
- A2-7 production validator, counterfactual provenance, controller, quality,
  and seeded UI tests: passed 17/17.
- A2-7 `verify:safe`: passed with 1065/1065 tests, 0 skipped; batch mock smoke
  passed 20/20.
- A2-7 full mandatory matrix: passed.
- A2-7 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-8 failure-first evidence: existing E2E seeded draft tables directly and no
  true UI-entry candidate transport path existed.
- A2-8 seeded and true-import browser suite: passed 10/10 checks across 7 browser
  scenarios; true-import designated tests passed 4/4.
- A2-8 `verify:safe`: passed with 1069/1069 tests, 0 skipped; batch mock smoke
  passed 20/20.
- A2-8 full mandatory matrix: passed.
- A2-8 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-9 failure-first evidence: both required architecture manifest files were
  missing while source-level checks existed only in partial hand-written tests.
- A2-9 architecture manifest and existing architecture/quality suite: passed
  14/14.
- A2-9 `verify:safe`: passed with 1073/1073 tests, 0 skipped; batch mock smoke
  passed 20/20.
- A2-9 full mandatory matrix: passed.
- A2-9 browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-10 ZIP failure-first evidence: the production readers directly called
  `JSZip.loadAsync` and no hostile-archive security owner existed.
- A2-10 ZIP attack and production-wiring tests: passed 7/7; real DOCX browser
  import plus admission and DOCX regression checks passed 20/20.
- A2-10 ZIP `verify:safe`: passed; batch mock smoke passed 20/20.
- A2-10 ZIP full mandatory matrix: passed.
- A2-10 ZIP browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- A2-10 temporary-file failure-first evidence: the upload file used a swallowed
  best-effort unlink, converted job directories were retained, and no startup
  expiry cleanup existed.
- A2-10 temporary-file lifecycle and production-wiring tests: passed 5/5,
  including success, failure, expired startup job, and code-only cleanup log.
- A2-10 temporary-file `verify:safe` and full mandatory matrix: passed.
- A2-10 temporary-file browser preflight/dry-run: passed with the cleanup-first
  server startup healthy, `realApiCalled=false`, and `underlyingApiCallCount=0`.
- A2-10 log failure-first evidence: browser and server console calls could emit
  OCR/model text, filenames, error messages, paths, and arbitrary payloads.
- A2-10 secure-log and production-wiring tests: passed 4/4; live-browser leak
  injection emitted none of the five forbidden marker classes.
- A2-10 log `verify:safe` and full mandatory matrix: passed.
- A2-10 log browser preflight/dry-run: passed with `realApiCalled=false`,
  `underlyingApiCallCount=0`, and browser chain healthy.
- Phase 3 validator-missing failure-first evidence: the designated matrix was
  absent; the attack itself already failed closed at both controller boundaries.
- Phase 3 validator-missing attack and controller regressions: passed 10/10.
- Phase 3 validator-missing full mandatory matrix: passed; browser preflight and
  dry-run remained healthy with `realApiCalled=false`.
- Phase 3 validator-throws failure-first evidence: the designated matrix row was
  absent; the attack itself already failed closed at both controller boundaries.
- Phase 3 validator-throws attack and controller regressions: passed 10/10; full
  mandatory matrix passed with preflight/dry-run and no real API call.
- Phase 3 malformed-admission failure-first evidence: its matrix row was absent;
  null and structurally invalid validator results already failed closed.
- Phase 3 malformed-admission attack passed 2/2; full mandatory matrix and
  browser preflight/dry-run passed with no real API call.
- Phase 3 fake-manual-flag failure-first evidence: its matrix row was absent;
  Formal Admission already rejected draft-level flag laundering.
- Phase 3 fake-manual-flag and policy regressions passed 14/14; full mandatory
  matrix and browser preflight/dry-run passed with no real API call.
- Phase 3 rejected-AI-confirm failure-first evidence: its matrix row was absent;
  the real production validator already preserved rejected provenance.
- Phase 3 rejected-AI-confirm attack and production-validator regressions passed
  8/8; full mandatory matrix and browser dry-run passed with no real API call.
- Phase 3 duplicate-submit failure-first evidence: its matrix row was absent;
  repository idempotency already prevented the second formal write.
- Phase 3 duplicate-submit and concurrency regressions passed 5/5; full
  mandatory matrix and browser dry-run passed with no real API call.
- Phase 3 two-tab-race failure-first evidence: its matrix row was absent; the
  repository already rejected the losing tab after the first atomic commit.
- Phase 3 two-tab-race and concurrency regressions passed 5/5; full mandatory
  matrix and browser dry-run passed with no real API call.
- Phase 3 transaction-abort failure-first evidence: its matrix row was absent;
  the repository transaction already rolled back all isolated mutations.
- Phase 3 transaction-abort and transaction regressions passed 8/8; full
  mandatory matrix and browser dry-run passed with no real API call.
- Phase 3 stale-draft failure-first evidence: its matrix row was absent; version
  conflict handling already blocked all formal writes.
- Phase 3 stale-draft and concurrency regressions passed 5/5; full mandatory
  matrix and browser dry-run passed with no real API call.
- Phase 3 raw-JSON failure-first evidence: its matrix row was absent; contract
  and real transport paths already rejected the wrapper before persistence.
- Phase 3 raw-JSON contract and UI transport regressions passed 4/4; full
  mandatory matrix and browser dry-run passed with no real API call.
- Phase 3 ownership-rewind failure-first evidence: its matrix row was absent;
  Formal Admission and real PDF safe-partial already preserved rejection.
- Phase 3 ownership-rewind regressions passed 3/3; full mandatory matrix and
  browser dry-run passed with no real API call.
- Phase 3 script-missing failure-first evidence: the matrix row was absent and
  the initial designated assertion used `file` instead of the audit's `path`.
- Phase 3 script-missing and runtime-dependency regressions passed 10/10; full
  mandatory matrix and browser dry-run passed with no real API call.

## Blockers

- None.
- Real AI/OCR and model download remain disabled.

## Next exact action

Commit/push script missing, then execute formal-submit direct DB bypass.
