# APP SHELL SLIMMING R3 — State

- Start commit: `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`
- Baseline tag: `pre-app-shell-slimming-r3-b15e6fb`
- Current branch: `stage/app-shell-slimming-r3`
- Current phase: Program C / Phase 2 implementation in progress
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
- C2.3 defined unique owner/public API/dependency/test contracts for all ten target
  modules, with no DOM, Vue, direct external-call, or frozen-owner duplication.
- C2.3 failure-first gate began at 0/2; final design passed 2/2 and all 11
  mandatory gates passed with browser preflight/dry-run making zero real calls.
- C2.4 fixed the ordered 11-step per-wave protocol, complete evidence packet,
  three-bounded-repair stop policy, exact Git scope, rollback proof, and all 14
  wave-specific switch/removal obligations.
- C2.4 failure-first gate began at 0/3; final protocol passed 3/3 and all 11
  mandatory gates passed. Phase 1 architecture is complete without production
  behavior changes.
- Wave C2-1 implemented the side-effect-free Import State Machine with 15 frozen
  states, 28 frozen transitions, injected commands, monotonic progress, invalid
  transition rejection, AbortSignal cancellation, late-result isolation, stable
  sanitized errors, bounded retry, and data-only frozen snapshots.
- The state-machine owner is registered in both architecture manifests as a
  scaffold. It is implemented/unit-tested but not browser-loaded, app-called, or
  production-wired; no production switch or old-owner removal was attempted.
- C2-1 failure-first began with module-not-found. Final implementation/design/
  architecture targets passed 17/17 and all 11 mandatory gates passed with
  preflight/dry-run making zero real calls.
- Wave C2-2 implemented and production-wired `qisi-batch-context-service.js` as
  the single owner for immutable batch metadata, file metadata, source manifest,
  user-settings snapshot, and engine-config snapshot.
- `processDraftImportBatch` now reads source records once, delegates context
  construction to `Qisi.BatchContextService.createBatchContext`, and consumes the
  returned expected-count, recognition-mode, and source-manifest snapshots. The
  three legacy inline derivations were removed and are guarded against return.
- The service accepts an injected deterministic role reader, has no DOM, Vue,
  fetch, external API, database mutation, or formal-write access, and excludes
  raw text/content, credentials, tokens, and base64-like fields from snapshots.
- Missing batch/file, stale source, duplicate file, and unsupported type fail
  closed with stable error codes. Inputs and recursively frozen outputs remain
  independent, and production script order/runtime namespace ownership are
  machine-checked.
- C2-2 failure-first began with module-not-found. Bounded repairs addressed a
  no-write guard false positive on `Set.add`, an `app.js` growth boundary by
  injecting the role reader, and a runtime namespace convention exposed by the
  first full gate. The original runtime failures plus counterfactual attacks then
  passed 26/26.
- Final C2-2/design/architecture targets passed 24/24; true DOCX/PDF import
  characterization passed 4/4; the final full suite passed 1,270/1,270; and all
  11 mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`.
- `app.js` is now 21,777 lines with the same 318 inventoried function names. The
  Phase 1 responsibility report remains the immutable 21,778-line baseline map;
  its gate now freezes all 318 baseline rows while proving every current function
  name is still represented exactly once and the shell has not grown.
- Wave C2-3 implemented and production-wired `qisi-source-role-classifier.js` as
  the batch-level owner for deterministic source-role classification from only
  manifest id, file type, declared roles, and source order.
- Question/answer DOCX and PDF, explicit answer-plus-solution, full, and
  supplemental-image roles are represented as immutable data. Missing,
  duplicate, unsupported, and ambiguous role declarations fail closed with
  stable error codes; raw text and semantic keywords are never inspected.
- `processDraftImportBatch` now delegates supplemental-image exclusion,
  recognition priority, and PDF role counts to the classifier. Its old inline
  `recognitionFileRank` and repeated diagnostic filters were removed. Existing
  `FileDispatcher` remains the per-file primitive predicate owner used by later
  parsing paths.
- C2-3 failure-first began with module-not-found. The first full gate exposed a
  historical Program B audit that compared all committed `app.js` changes to the
  Program A seal, which is incompatible with Program C's authorized shell
  migration. The repaired audit still byte-freezes controlled-write,
  FormalAdmission, and Route B files and now proves the live app has no duplicate
  implementations or Route B reference.
- Final C2-3 architecture/security targets passed 57/57, true DOCX/PDF import
  characterization passed 4/4, audit/attack repair targets passed 36/36, the
  final full suite passed 1,279/1,279, and all 11 mandatory gates passed with
  browser preflight/dry-run making zero real calls.
- `app.js` is now 21,754 lines, 24 lines below the Program C baseline, with the
  same 318 inventoried function names and complete baseline-name coverage.
- Wave C2-4 implemented and production-wired `qisi-docx-import-coordinator.js`
  as the owner for deterministic multi-source DOCX ordering, injected single-file
  parsing, candidate aggregation, monotonic progress, cancellation, and stable
  sanitized error mapping.
- The coordinator rejects non-DOCX inputs and has no DOM, Vue, PDF, OCR, visual,
  controlled-write, FormalAdmission, Repository, or formal-write authority.
  Existing importer/visual helpers remain injected single-file adapters rather
  than copied implementations.
- The V2 production path now routes DOCX question sources through
  `Qisi.DocxImportCoordinator.runDocxImport`. Candidate offsets preserve the old
  cross-file draft order, progress remains an app-owned injected command, and the
  old adapter rejects multi-file calls with `DOCX_COORDINATOR_REQUIRED` so the
  coordinator cannot be bypassed.
- C2-4 failure-first began with module-not-found. Final DOCX/architecture/attack
  targets passed 51/51, true DOCX/PDF import characterization passed 4/4, DOCX
  stable passed 20/20, the full suite passed 1,284/1,284, and all 11 mandatory
  gates passed with browser preflight/dry-run making zero real calls.
- `app.js` is now 21,768 lines, 10 lines below the Program C baseline, with the
  same 318 inventoried function names and complete baseline-name coverage.
- Wave C2-5 implemented and production-wired `qisi-pdf-import-coordinator.js`
  for deterministic PDF-only V2 intake, injected engine execution, page-level
  progress, AbortSignal boundaries, sanitized adapter errors, and immutable
  safe-partial candidate contracts.
- The coordinator delegates candidate status to the existing
  `PdfSafePartialPipeline` port and contains no parser, aligner, controlled-write,
  FormalAdmission, answer-ownership, storage, UI, or Route B implementation.
- `qisi-batch-engine-v2.js` now emits page-completion events and checks the
  coordinator signal before/after render, text/layout extraction, page OCR, and
  page publication. Coordinator cancellation codes propagate rather than being
  converted into manual fallback drafts; a completed late page is ignored after
  the next signal boundary.
- The V2 production path routes all-PDF engine inputs through
  `Qisi.PdfImportCoordinator.runPdfImport`; the prior engine remains an injected
  adapter, and mixed non-PDF/PDF engine inputs retain their legacy combined path
  to avoid breaking cross-source matching. No parser/aligner/controlled-write
  owner was moved.
- C2-5 failure-first began with module-not-found. A first implementation passed
  behavior tests but was blocked at 21,795 app lines; the port assembly was
  compacted without removing any gate or dependency, restoring the shell bound.
  Final PDF/architecture/attack targets passed 35/35, true DOCX/PDF import
  characterization passed 4/4, known-bad passed 65/65, the full suite passed
  1,290/1,290, and all 11 mandatory gates passed with no real calls.
- `app.js` is now 21,777 lines, one line below the Program C baseline, with the
  same 318 inventoried function names and complete baseline-name coverage.

## Pending

- Phase 2 Waves C2-6–C2-14, then attacks, audits, benchmark, CTO review, and seal.

## Blockers / limitations

- Upload-to-review, switch p50/p95, draft persist, formal submit, reload, export,
  image/IndexedDB size, and repeated-run memory growth do not yet have a stable
  Program C baseline harness; Phase 6 may only compare metrics measured under the
  same harness and conditions.
- Static regex counts are reproducible lexical measures, not proof of runtime
  reachability or permission to delete a call site.

## Next exact action

Commit and push C2-5, then begin Wave C2-6 Candidate Normalizer with
failure-first tests for production-helper delegation, raw JSON and formula
wrappers, immutable evidence, and prohibition of repair-owner duplication.
