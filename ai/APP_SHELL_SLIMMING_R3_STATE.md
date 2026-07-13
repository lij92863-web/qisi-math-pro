# APP SHELL SLIMMING R3 — State

- Start commit: `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`
- Baseline tag: `pre-app-shell-slimming-r3-b15e6fb`
- Current branch: `stage/app-shell-slimming-r3`
- Current phase: Program C / Phase 1 architecture in progress
- Status updated: 2026-07-13 Asia/Shanghai

## Entry conditions

- Program B decision: `OCR_QUALITY_R1_ACCEPTED_WITH_LIMITATIONS`.
- Program B main/tag seal: verified at the start commit.
- Local main, origin/main, live main, Program B work branch, and peeled Program B
  tag were equal; both comparison logs and the working tree were empty.
- Program A FormalAdmission/repository and Program B OCR boundaries remain frozen
  owners for Program C.
- DOCX stable, PDF safe partial plus manual review, controlled-write, and Route B
  hold remain mandatory invariants.
- Real OCR/API and model-download authority flags remain absent.

## Phase 0 baseline

- Created and pushed annotated baseline tag
  `pre-app-shell-slimming-r3-b15e6fb`.
- Created and pushed `stage/app-shell-slimming-r3` from sealed Program B main.
- `app.js`: 21,778 lines; 318 inventory-recognized top-level functions.
- Largest function: `processDraftImportBatch`, 5,132 lines
  (15,984–21,115), high risk.
- Direct DB mutation invocation lines: 87; direct DB member references: 159;
  direct formal `db.questions.put` sites: 6.
- Direct OCR/vision owner invocation sites: 11.
- Explicit parser/repair/align invocation lines: 69.
- In-app `exportQuestionBankPackage` implementation: 41 lines.
- Browser baseline harness added for same-condition Phase 6 comparison.
- Seven-run browser medians: cold start 4,983.914 ms, DOMContentLoaded
  2,436.8 ms, load 4,456.3 ms, JS heap used 14,979,876 bytes, JS heap total
  36,306,944 bytes.
- Manifest graph: 5 layers, 28 modules, 28 dependency edges, 0 missing targets,
  0 cycles, 0 upward violations, and 0 owner-source mismatches.
- No OCR, upload, recognition, formal write, model download, or PDF real-run was
  performed by baseline measurement.
- Phase 0 failure-first baseline gate began at 0/2. Final baseline, browser
  harness, code-boundary, and architecture targets passed 10/10.
- All 11 mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`; `verify:safe` included the
  live local browser baseline harness.
- C2.1 added a deterministic responsibility inventory and generated a complete
  318-row `app.js` map. Every row records name/range/lines, domain, all lexical
  callers, function/Qisi dependencies, reactive state, side effects, named tests,
  target module, extraction risk, and migration wave.
- C2.1 explicitly freezes controlled-write, FormalAdmission, Repository, Route B,
  and Program B OCR policy owners. Planning classifications do not authorize
  extraction or deletion.
- C2.1 failure-first gate began at 0/3; final map/inventory gates passed 3/3 and
  all 11 mandatory gates passed with browser modes making zero real calls.
- C2.2 defined all 15 lifecycle states and 28 explicit transitions. Every edge
  records trigger, precondition, injected action, output, recoverability, stable
  error code, and cancellation behavior; unspecified transitions fail closed.
- The state object has no hidden side effects. Retry budget, idempotency,
  compare-and-swap versioning, AbortSignal behavior, rollback receipts, manual
  review, and the non-cancellable repository commit boundary are explicit.
- C2.2 preserves controlled-write, FormalAdmission, Repository, PDF manual review,
  and privacy owners. Failure-first gate began at 0/3; final design passed 3/3 and
  all 11 mandatory gates passed with zero real calls.

## Pending

- Phase 1 target modules and wave-by-wave migration protocol.
- Phases 2–8 implementation, attacks, audits, benchmark, CTO review, and Git seal.

## Blockers / limitations

- Upload-to-review, switch p50/p95, draft persist, formal submit, reload, export,
  image/IndexedDB size, and repeated-run memory growth do not yet have a stable
  Program C baseline harness; Phase 6 may only compare metrics measured under the
  same harness and conditions.
- Static regex counts are reproducible lexical measures, not proof of runtime
  reachability or permission to delete a call site.

## Next exact action

Commit and push C2.2, then define C2.3 target-module public APIs, dependency
direction, ownership, DOM/Vue/external-call prohibitions, and production-linked
test obligations.
