# Program C C2-11 — Legacy Batch Owner Retirement Report

## Stage

`C2-11 — NORMAL UI PRODUCTION CUTOVER AND LEGACY BATCH OWNER RETIREMENT`

## Baseline and evidence sources

- Start commit: `c77523c590b424a9c7f011ae2c0881ca8188f69a`
- Branch: `stage/app-shell-slimming-r3`
- Production cutover commit: `3a26001409ce61221e2f491d527f52ddf1b0a869`
- Phase 5 release:
  `docs/release/PROGRAM_C_PHASE5_REAL_BROWSER_SHADOW_EQUIVALENCE_R3.md`
- Phase 5 browser benchmark:
  `docs/benchmark/IMPORT_SHADOW_EQUIVALENCE_R3.md`
- Phase 5 internal CTO review:
  `docs/audit/PROGRAM_C_PHASE5_INTERNAL_CTO_REVIEW_R3.md`
- PDF projection correction:
  `docs/release/PDF_PROJECTION_OWNER_CORRECTION_R3.md`
- Phase 5 pre-resume patch:
  `docs/release/PHASE5_PRE_RESUME_SAFETY_PATCH_R1.md`
- Runtime and owner manifests: `architecture/layers.json`,
  `architecture/owners.json`, and
  `scripts/verify-qisi-runtime-dependencies.js`
- Program state: `ai/APP_SHELL_SLIMMING_R3_STATE.md`
- Governing task:
  `D:/Backup/Downloads/QISI_PROGRAM_C_PHASE5_TO_PHASE8_MASTER_TASK_R1.md`

The C2-11 start was the clean, pushed, three-way-equal accepted Phase 5 commit.
No production work began until the Phase 5 safe suite, browser equivalence,
runtime owner gate, DOCX stable, PDF known-bad, and no-real-AI gates were
reproduced.

## Route inventory and owner switch

The baseline route inventory is sealed in
`docs/architecture/NORMAL_UI_IMPORT_ROUTE_INVENTORY_C2_11.md`; the production
mode contract is sealed in
`docs/architecture/PRODUCTION_IMPORT_BRIDGE_CUTOVER_CONTRACT_C2_11.md`.

All visible batch create, failed retry, and review rerun events now converge on:

```text
normal main.html event
  -> app.js runBatchRecognition
  -> NormalUiImportController.run
  -> ProductionImportBridge.run(mode=production)
  -> ImportStateMachine
  -> real batch/source context and truthful source producer
  -> normalize/project/validate/build
  -> DraftPersistenceService atomic ReviewDraft transaction
  -> repository readback verification
  -> controller applyReviewModel
```

DOCX uses the accepted DOCX-vision producer identity and producer-time
provenance contract. PDF uses the existing coordinator and unique PDF
candidate projection owner with real parser/aligner/controlled-write evidence.
The deterministic DOCX normal-UI route remains truthfully non-applicable; the
deterministic browser transport is a test-only injected Bridge port, not a
second production owner.

## Legacy owner retirement

At the baseline, `processDraftImportBatch` occupied `app.js` lines
15,612–18,106 and was called through `LegacyBatchRunCoordinator`. The complete
giant implementation, direct Vue-proxy export, legacy coordinator assembly,
legacy injected-dispatch branch, and runtime script loads were removed. No
compatibility wrapper or catch fallback remains.

The detailed static and browser-linked proof is in
`docs/architecture/LEGACY_BATCH_OWNER_RETIREMENT_AUDIT_C2_11.md`.

- legacy production call count: `0`
- legacy fallback count: `0`
- Bridge production call count: `> 0`
- normal UI review success: `> 0`
- Bridge formal write count: `0`
- app baseline/current inventory lines: `21,349 -> 19,494`
- current inventory functions: `396`
- largest current function: `parseDocxOptionsFromText`, `242` lines
- current functions over 250 lines: `0`

`processDraftImportBatchV2` remains as a 216-line unreachable migration
precursor. It is not called by a UI event, not exported by the Vue proxy, and
not used by the normal production command. Moving its remaining import-domain
responsibilities belongs to C2-12 and is not concealed as C2-11 work.

## Persistence, idempotency, progress, cancellation, and error mapping

- Production success requires an atomic ReviewDraft transaction plus verified
  batch/draft readback before the review UI is installed.
- Durable request identity is derived from batch/source/draft version; duplicate
  active clicks share one controller promise.
- A committed lost-response retry returns verified persisted review data
  without rerunning the producer or creating a second draft version.
- Cancellation is covered before source/OCR, during recognition, before
  validation, before persistence, inside the transaction, and before the UI
  result returns. Transaction cancellation rolls back every draft table.
- The post-commit UI mapping boundary is explicitly non-cancellable, preventing
  a valid committed result from being misreported as cancellation.
- State progress covers PREPARING, LOADING_SOURCE, RECOGNIZING, NORMALIZING,
  STRUCTURING, VALIDATING, BUILDING_REVIEW, PERSISTING_DRAFT, and
  WAITING_CONFIRMATION without rewind.
- Stable UI errors exclude stacks, raw model JSON, source text, credentials,
  base64 data, and temporary paths. Every failure clears busy state and has no
  legacy fallback.

## True-browser production canary

`tests/e2e/production-normal-ui-import-cutover.test.js` loaded normal
`main.html`, used the real Vue application proxy, and executed these 15 cases:

1. DOCX vision normal UI;
2. reachable DOCX question + DOCX answer chain;
3. PDF full;
4. PDF safe-partial;
5. PDF known-bad ownership failure;
6. conflicting controlled-write decisions;
7. ambiguous multiple PDF support sources;
8. raw JSON rejection;
9. formula fallback/manual review;
10. cancellation;
11. persistence failure;
12. duplicate click;
13. reload after ReviewDraft;
14. UI error recovery;
15. Bridge formal-write isolation.

Every case recorded its route, normal entry, production owner, Bridge mode,
review count, formal count, wrong attachment, raw JSON/placeholder leakage,
controlled-write bypass, legacy fallback, real API, console error, transport
count, and final UI state.

| Safety counter | Result |
| --- | ---: |
| wrong attachment | 0 |
| raw JSON leakage | 0 |
| placeholder leakage | 0 |
| controlled-write bypass | 0 |
| Formal Admission bypass | 0 |
| Bridge formal writes | 0 |
| legacy fallback calls | 0 |
| white screens | 0 |
| unexpected console errors | 0 |
| realApiCalled | false |
| underlying real API calls | 0 |

Accepted cases reached review; known-bad/conflict/ambiguity/raw-JSON,
cancellation, and persistence-failure cases failed closed with zero drafts.
PDF safe-partial acceptance was not widened.

## Tests and gates

- C2-11 required targeted files: `28/28`, duration `123.5714 ms`
- C2-11 true-browser canary: `1/1` runner test covering `15/15` scenarios,
  duration `2,038.424 ms`
- Phase 5 producer/projection regression matrix rerun: `70/70`
- Phase 5 true-browser suites plus acceptance gate: `8/8`
- runtime dependency verifier: `ok=true`, no errors or warnings
- architecture and PDF single-owner gates: `7/7`
- final full safe suite: `1,517/1,517` across `54` suites, duration
  `10,767.0848 ms`

All 11 mandatory gates passed:

1. Base Migration execution gate: `15/15`;
2. Route B hold: `6/6`;
3. batch smoke mock: `20/20`;
4. `verify:safe`: `1,517/1,517`, 54 suites, plus smoke and no-real-AI;
5. batch safety: passed;
6. PDF known-bad: `65/65`;
7. controlled-write answer ownership: `21/21`;
8. PDF master preflight: passed, `realApiCalled=false`, underlying calls `0`;
9. PDF master dry-run: passed in Chromium, `realApiCalled=false`, underlying
   calls `0`;
10. DOCX stable: `20/20`;
11. no-real-AI: passed.

Runner totals for every counted suite report failed/cancelled/skipped/todo as
`0/0/0/0`; no timeout occurred or was hidden. No real-run, AI proxy, vision
proxy, model download, or real external AI call was performed.

## Changed files

Production and runtime:

- `app.js`, `main.html`
- `qisi-normal-ui-import-controller.js`
- `qisi-production-import-bridge.js`
- `qisi-production-docx-vision-source-port.js`
- `qisi-production-pdf-sources-port.js`
- `qisi-docx-producer-identity-contract.js`
- `qisi-pdf-candidate-projection.js`
- `qisi-import-state-machine.js`
- `qisi-draft-persistence-service.js`
- `qisi-storage-repository.js`
- `architecture/layers.json`, `architecture/owners.json`
- `scripts/verify-qisi-runtime-dependencies.js`

Architecture evidence:

- `docs/architecture/NORMAL_UI_IMPORT_ROUTE_INVENTORY_C2_11.md`
- `docs/architecture/PRODUCTION_IMPORT_BRIDGE_CUTOVER_CONTRACT_C2_11.md`
- `docs/architecture/LEGACY_BATCH_OWNER_RETIREMENT_AUDIT_C2_11.md`

Tests:

- all ten required `tests/*import-cutover*`, owner, no-fallback, retirement,
  route-inventory, and production-mode files;
- `tests/e2e/production-cutover-fixtures.js` and
  `tests/e2e/production-normal-ui-import-cutover.test.js`;
- production-linked Bridge, persistence, state-machine, DOCX/PDF projection,
  runtime, architecture, shell-boundary, and historical-audit regressions
  listed by `git show --name-only 3a26001`.

The production commit contains 57 exact paths. It changed 3,453 lines and
removed 2,724 lines; the net app-shell reduction is independently measured
above rather than inferred from the whole commit.

## Frozen files and remaining limitations

These six high-risk files are byte-unchanged from the Phase 5 baseline:

- `qisi-pdf-support-controlled-write.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-answer-only-extraction.js`
- `qisi-pdf-answer-extraction-quality.js`
- `scripts/pdf-master-browser-runner.js`

Formal Admission, Route B, parser, aligner, controlled-write, and formal
repository ownership are unchanged. Remaining C2-12/C2-13 work includes moving
the unreachable V2 precursor's domain logic, converging remaining UI shell
responsibilities, and removing historical dead modules after runtime ownership
is separately proven. Those items do not create a second normal-UI production
owner at C2-11.

## Git

- start commit: `c77523c590b424a9c7f011ae2c0881ca8188f69a`
- production cutover/retirement commit:
  `3a26001409ce61221e2f491d527f52ddf1b0a869`
- branch pushed: yes
- local/tracking/live branch: equal after the evidence commit push
- working tree: clean after the evidence commit
- amend/force/merge/rebase/pull: none

## Decision

`C2_11_LEGACY_BATCH_OWNER_RETIREMENT_ACCEPTED`

Next exact action: begin C2-12 as a new independently tested, committed, pushed,
and state-recorded stage. Do not treat the residual V2 precursor as already
closed.
