# Program C Final Evidence Index R3

## Release identity

```text
Program: APP SHELL SLIMMING R3
Program start: b15e6fbe24c525c95a573b51a0c7ab68e77f4790
Recovery checkpoint: 2ebe00b390caae556fdb8ed0e03087ad0965cb24
Phase 7 accepted: 0d34084adefb897302aeb82cea570067f642cbec
Seal resolver: v1.2.0-rc2-app-shell-slimming-r3^{}
Branch: stage/app-shell-slimming-r3
```

The peeled annotated tag is the authoritative seal commit. This avoids the
impossible requirement for a Git commit to embed its own SHA in its own tree.

## Recovery and continuation evidence

- `docs/recovery/PROGRAM_C_LOST_SESSION_FULL_RECOVERY_AUDIT_R2.md` — deleted-
  session repository, reflog, unreachable-object, process, protected-tree, and
  recovery-case audit; decision `PROGRAM_C_RESUME_ALLOWED`.
- `docs/recovery/PROGRAM_C_C2_12_RESUME_POINT_R2.md` — last proven Wave 11,
  recovered Wave 12 scope, exact safety state, and next action.
- `ai/APP_SHELL_SLIMMING_R3_STATE.md` — chronological program state plus the
  final Phase 8 seal state.
- External recovery snapshot recorded by the audit:
  `C:\Users\Administrator\Desktop\qisi-program-c-recovery-20260714-024343`.

## C2-12 wave evidence

- `docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_C2_12.md` — wave-by-wave
  owner/responsibility and remaining-shell inventory.
- `docs/release/PROGRAM_C_C2_12_WAVE12_DOCX_SUPPORT_SOURCE_PRODUCER_REPORT.md`
- `docs/release/PROGRAM_C_C2_12_WAVE13_DOCX_CONVERTER_RECONCILER_REPORT.md`
- `docs/release/PROGRAM_C_C2_12_WAVE14_REVIEW_DRAFT_COMMAND_PERSISTENCE_REPORT.md`
- `docs/release/PROGRAM_C_C2_12_WAVE15_MANUAL_REVIEW_PROVENANCE_FORMAL_LIFECYCLE_REPORT.md`
- `docs/release/PROGRAM_C_C2_12_WAVE16_OCR_TRANSPORT_PRODUCER_REPORT.md`
- `docs/release/PROGRAM_C_C2_12_WAVE17_STORAGE_FORMAL_REPOSITORY_REPORT.md`
- `docs/release/PROGRAM_C_C2_12_APP_SHELL_CONVERGENCE_REPORT.md` — Wave 18 and
  C2-12 final convergence decision.
- `tests/app-shell-c2-12-baseline-characterization.test.js`
- `tests/app-shell-c2-12-owner-modules.test.js`
- `tests/app-shell-c2-12-final-convergence.test.js`

## C2-13 owner and dead-path evidence

- `docs/architecture/owners.json` and `docs/architecture/layers.json` — detailed
  machine-readable production owners, responsibilities, dependencies, and
  layers.
- `architecture/owners.json` and `architecture/layers.json` — compatibility
  manifest enforced against the detailed graph.
- `docs/architecture/PROGRAM_C_PRODUCTION_CALL_GRAPH_AUDIT_R3.md` — normal UI,
  Bridge, producer, persistence, Formal Admission, and repository call graph.
- `docs/release/PROGRAM_C_C2_13_OWNER_AND_DEAD_CODE_CLOSURE_REPORT.md` — C2-13
  decision and retired/deprecated owner inventory.
- `tests/c2-13-owner-runtime-closure.test.js` — runtime order, production
  reachability, dependency direction, unique-owner, retired-owner, and missing-
  dependency execution gate.

## Phase 6 engineering evidence

- `docs/testing/PROGRAM_C_PHASE6_COUNTERFACTUAL_ATTACK_MATRIX_R3.json` — 43/43
  machine-readable dependency, safety-data, runtime, cancellation, transaction,
  retry, and fallback attacks.
- `docs/architecture/PROGRAM_C_CODE_QUALITY_AUDIT_R3.md` — complexity, mutable
  state, error behavior, transaction boundary, security, production/test
  divergence, and architecture-gate audit.
- `docs/benchmark/PROGRAM_C_APP_SHELL_BENCHMARK_R3.md` — selected 10-run p50/p95
  owner-chain, validation, startup, heap, and first-review-render evidence.
- `docs/release/PROGRAM_C_PHASE6_ENGINEERING_CLOSURE_REPORT.md` — decision
  `PROGRAM_C_PHASE6_ENGINEERING_CLOSURE_ACCEPTED`.
- `scripts/benchmark/measure-program-c-closure.js`
- `scripts/benchmark/measure-review-validation.js`
- `scripts/benchmark/measure-first-review-render.js`
- `scripts/benchmark/measure-app-shell-browser.js`
- `tests/program-c-phase6-engineering-closure.test.js`

## Phase 7 independent internal review

- `docs/release/PROGRAM_C_PHASE7_INTERNAL_CTO_REVIEW.md` — 42/42 required
  answers, independent production-entry rerun, same-environment disclosure, and
  decision `PROGRAM_C_PHASE7_CTO_ACCEPTED`.
- Independent `verify:safe`: 1,631/1,631 across 54 suites.
- Independent mandatory gates: 11/11 in prescribed order.
- Independent normal-UI production browser: 15/15 scenarios.
- Independent owner/runtime/architecture/formal/persistence focus: 63/63.
- Independent benchmark smoke: 4/4 executable modes.

## Production-entry and safety tests

- `tests/e2e/production-normal-ui-import-cutover.test.js` — normal
  `AppProxy.runBatchRecognition` entry, production Bridge mode, 15 scenarios,
  persisted review state, and safety counters.
- `tests/normal-ui-import-production-owner.test.js`
- `tests/normal-ui-import-no-legacy-fallback.test.js`
- `tests/import-state-machine.test.js`
- `tests/import-cutover-persistence-transaction.test.js`
- `tests/import-cutover-formal-write-isolation.test.js`
- `tests/draft-persistence-service.test.js`
- `tests/formal-admission-policy.test.js`
- `tests/batch-formal-submit-production.test.js`
- `tests/formal-question-transaction.test.js`
- `tests/formal-question-concurrency.test.js`
- `tests/pdf-support-controlled-write-answer-ownership.test.js`
- `tests/pdf-route-b-hold.test.js`
- `tests/architecture-manifest.test.js`
- `tests/architecture-consistency.test.js`
- `tests/qisi-runtime-dependencies.test.js`

## Mandatory gate order

```text
1. node --test tests/base-migration-execution-gate.test.js
2. node --test tests/pdf-route-b-hold.test.js
3. npm.cmd run smoke:batch:mock
4. npm.cmd run verify:safe
5. npm.cmd run verify:batch-safety
6. npm.cmd run verify:pdf-known-bad
7. node --test tests/pdf-support-controlled-write-answer-ownership.test.js
8. node scripts/pdf-master-browser-runner.js preflight
9. node scripts/pdf-master-browser-runner.js dry-run
10. npm.cmd run verify:docx-stable
11. npm.cmd run verify:no-real-ai
```

Final Phase 6 and independent Phase 7 executions both passed 11/11. Preflight
and dry-run recorded `realApiCalled=false` and zero underlying calls. No
`real-run` was authorized or executed.

## Frozen production files

The following files have zero Program C seal delta and remain frozen:

```text
qisi-pdf-support-controlled-write.js
qisi-pdf-support-aligner.js
qisi-pdf-support-block-parser.js
qisi-pdf-answer-only-extraction.js
qisi-pdf-answer-extraction-quality.js
scripts/pdf-master-browser-runner.js
```

## Final release records

- `docs/release/PROGRAM_C_APP_SHELL_SLIMMING_R3_FINAL_REPORT.md`
- `docs/release/PROGRAM_C_PHASE8_GIT_SEAL_REPORT.md`
- annotated tag `v1.2.0-rc2-app-shell-slimming-r3`

The external post-commit Git verification must prove branch local/tracking/live
remote equality, local/remote tag-object equality, peeled-tag equality to the
seal commit, a clean tree, an empty index, and no untracked release evidence.
