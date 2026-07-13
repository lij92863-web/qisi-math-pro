# APP SHELL SLIMMING R3 — State

- Start commit: `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`
- Baseline tag: `pre-app-shell-slimming-r3-b15e6fb`
- Current branch: `stage/app-shell-slimming-r3`
- Current phase: Program C / Phase 5 resume allowed; Phase 5 not yet accepted
- Current work package: Phase 5 pre-resume safety patch complete
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
- Wave C2-6 implemented and production-wired `qisi-candidate-normalizer.js` as
  the single owner for AI wrapper cleanup, deterministic candidate selection,
  question-array contract conversion, and normalization orchestration.
- The normalizer accepts only injected production repair ports and delegates all
  malformed LaTeX JSON repair to the existing `qisi-support-repair.js` owner. It
  contains no repair command table or scanner, DOM, Vue, external transport,
  controlled-write, FormalAdmission, Repository, ownership, or formal-write
  logic.
- Strict DOCX/PDF recognition payload parsing now calls
  `Qisi.CandidateNormalizer.normalizeCandidates`; the old inline fence cleanup,
  JSON alternative generation, repair scheduling, and contract extraction were
  removed. Other legacy consumers use a thin `extractQuestionArray` delegation,
  so there is no second normalization owner in `app.js`.
- Candidate inputs and returned raw evidence are cloned and recursively frozen.
  Raw arrays, direct/nested wrappers, legal JSON escapes, malformed formula JSON,
  empty payloads, and invalid payloads are covered with the real production
  SupportRepair helper rather than a test copy.
- C2-6 failure-first began with module-not-found. The first full suite exposed
  two stale migration audits: one required the live app to retain exactly all
  318 baseline functions, and one required repair scheduling to remain in
  `app.js`. One bounded repair kept the immutable 318-row baseline map while
  enforcing a non-growing current function count and moved the callsite audit to
  the new production owner.
- Final candidate/repair/architecture/attack targets passed 42/42, true
  DOCX/PDF import characterization passed 4/4, the full suite passed 1,296/1,296,
  and all 11 mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`.
- `app.js` is now 21,534 physical lines, 244 below the Program C baseline, with
  315 inventoried functions. Every remaining function name is still covered
  exactly once by the immutable 318-row baseline map; the three removed names
  belonged to the migrated normalization owner. `processDraftImportBatch` is
  5,108 lines and remains explicitly pending the later retirement wave.
- Wave C2-7 implemented and production-wired
  `qisi-import-validation-service.js` as the side-effect-free composition owner
  for sequence, schema, source ownership, PDF safe-partial, and controlled-write
  evidence validation ports.
- The service clones and recursively freezes inputs and outputs, requires every
  validator port, aggregates only sanitized stable failure codes, and fails
  closed on missing, throwing, malformed, or rejecting validators. It contains
  no DOM, Vue, transport, FormalAdmission, sequence-validator implementation,
  Repository, persistence, or formal-write authority.
- The injected true-import path now validates the complete draft set before the
  first review persistence call. DOCX full sequence and PDF safe-prefix remain
  accepted; raw JSON, empty prefix, invalid sequence, wrong attachment type,
  invalid schema/provenance, unsafe controlled-write evidence, and malformed
  validator output remain out of review storage.
- Existing RecognitionContracts, PdfSupportAligner, PdfSafePartialPipeline, and
  ProductionReviewValidator owners are injected rather than copied. Explicitly
  rejected PDF fields remain reviewable only for the existing prefix/manual
  review contract; the same rejected evidence remains barred from formal data
  until an actual teacher edit creates manual provenance.
- C2-7 failure-first began with module-not-found and then with the deliberately
  absent production call. A bounded repair aligned RecognitionContracts' `path`
  error coordinate with the admission owner's `field` coordinate without
  weakening either validator; the teacher-rewrite counterfactual then passed.
- Final C2-7 service/architecture targets passed 22/22, true DOCX/PDF/raw-JSON/
  wrong-attachment/teacher-rewrite browser characterization passed 5/5, the
  full suite passed 1,302/1,302, and all 11 mandatory gates passed. Browser
  preflight/dry-run recorded `realApiCalled=false` and
  `underlyingApiCallCount=0`; no PDF real-run was performed.
- `app.js` is now 21,658 physical lines, 120 below the Program C baseline, with
  315 inventoried functions and complete immutable baseline-name coverage.
  `processDraftImportBatch` remains 5,108 lines. The manifest now records 5
  layers, 35 modules, and 52 declared dependency edges with no missing target,
  cycle, upward dependency, or owner mismatch.
- Wave C2-8 implemented and production-wired `qisi-review-draft-builder.js` as
  the single pure owner for ValidatedDraft-to-ReviewDraft projection.
- The builder now owns review id/batch/version/order/status/selection/timestamp
  metadata that was previously mapped inline in the injected import path. It
  clones and recursively freezes outputs while preserving warnings, empty or
  absent optional fields, source trace, field provenance, manual-review flags,
  and rejected reason codes exactly.
- The production order is now C2-7 validation, C2-8 review projection, then the
  existing repository review persistence boundary. The old inline candidate map
  was removed. Temporary id/version/order values used only to call existing
  validators are not persisted; the builder remains the only review-record
  metadata owner in this path.
- The builder has no DOM, Vue, external transport, FormalAdmission,
  controlled-write, Repository, persistence, or formal-question-write access.
  It does not create question content, fill missing fields, change warnings,
  derive manual provenance, or convert rejected evidence into accepted data.
- C2-8 failure-first began with module-not-found. The first true browser run
  exposed one stale reference to the removed inline `drafts` variable in batch
  summary projection; one bounded repair switched it to the builder's sole
  `reviewDrafts` output without weakening validation or persistence gates.
- Final builder/validation targets passed 9/9, architecture targets passed
  20/20, true DOCX/PDF/raw-JSON/wrong-attachment/teacher-rewrite browser
  characterization passed 5/5, the full suite passed 1,306/1,306, and all 11
  mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run occurred.
- `app.js` is now 21,666 physical lines, 112 below the Program C baseline, with
  315 inventoried functions and complete immutable baseline-name coverage.
  `processDraftImportBatch` remains 5,108 lines. The manifest now records 5
  layers, 36 modules, and 53 declared dependency edges with no missing target,
  cycle, upward dependency, or owner mismatch.

- Wave C2-9 implemented and production-wired
  `qisi-draft-persistence-service.js` as the single owner for review-draft batch
  persistence, idempotency, batch association, reload, delete, and cleanup.
- The service validates batch/id/version association, duplicate draft ids,
  idempotency-key reuse, expected-version conflicts, and a metadata-only payload
  signature. Per-repository serialization and pre/post-write verification make
  two-tab conflicts deterministic while the frozen Repository remains the sole
  atomic storage implementation.
- The injected import path now calls C2-9 only after C2-7 validation and C2-8
  projection. App reload, single-batch delete, and whole-workspace cleanup also
  use the service. Reload returns an independent mutable work copy for the
  existing editor, while persistence inputs and stored records remain isolated.
- Formal question tables and FormalAdmission are outside the service API. Delete
  and cleanup remove only review tasks, review drafts, draft images, and unmatched
  answers owned by the selected batch; tests prove formal questions survive.
- C2-9 failure-first began with module-not-found and then the deliberately absent
  production persistence port. Three bounded repairs preserved the gates: stable
  Repository errors were normalized without leaking messages; reload changed
  from a recursively frozen snapshot to an independent editable clone; and the
  service stopped nesting a second transaction around Repository APIs that are
  already atomic, retaining version checks and post-write verification.
- Final C2-9 service tests passed 6/6, combined persistence/architecture targets
  passed 30/30, true DOCX/PDF/reload/delete browser characterization passed 7/7,
  the full suite passed 1,312/1,312, and all 11 mandatory gates passed. Browser
  preflight/dry-run recorded `realApiCalled=false` and
  `underlyingApiCallCount=0`; no PDF real-run occurred.
- `app.js` is now 21,683 physical lines, 95 below the Program C baseline, with
  315 inventoried functions and complete immutable baseline-name coverage.
  `processDraftImportBatch` remains 5,108 lines. The manifest now records 5
  layers, 37 modules, and 55 declared dependency edges with no missing target,
  cycle, upward dependency, or owner mismatch.

- Wave C2-10 implemented and production-wired `qisi-import-diagnostics.js` as
  the single owner for allowlisted import lifecycle diagnostics.
- Events contain only requestId, batchId, a fixed lifecycle stage, measured
  duration, a catalogued stable error code, an approved engine token, and capped
  count fields. Caller-supplied duration, unknown count keys, arbitrary error
  strings, private source text, base64, keys, filenames, and model responses are
  never copied into the event or immutable snapshot.
- Duration is derived from the injected monotonic clock and clamped against clock
  rollback and runaway values. Identifiers, counts, event volume, and engine
  tokens have explicit caps; a throwing secure logger port is isolated and cannot
  change import success, failure, or cancellation behavior.
- The injected production path now records context load, candidate production,
  safe-prefix selection, validation, review projection, and persistence. Known
  owner errors retain stable codes, AbortError maps to `import-cancelled`, and all
  arbitrary Error data maps to `import-failed` without copying the message.
- C2-10 failure-first began with module-not-found. The pure owner then passed 5/6
  tests while the deliberately absent production link remained red. Production
  wiring completed the gate; the app instance was inlined into the existing
  coordinator configuration so the frozen responsibility map stayed at 315
  functions without adding a new shell owner.
- Final diagnostics and real injected-path targets passed 7/7, architecture and
  baseline targets passed 11/11, true DOCX/PDF/admission/reload browser
  characterization passed 7/7, the full suite passed 1,319/1,319, and all 11
  mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run occurred.
- `app.js` is now 21,690 physical lines, 88 below the Program C baseline, with
  315 inventoried functions and complete immutable baseline-name coverage.
  `processDraftImportBatch` remains 5,108 lines. The manifest now records 5
  layers, 38 modules, and 58 declared dependency edges with no missing target,
  cycle, upward dependency, or owner mismatch.

- Wave C2-10.5 Phase 1 started from clean local/upstream/live commit
  `e8c2d9f29a201575638bedec9148c811c8940e1d` on
  `stage/app-shell-slimming-r3` and completed the required read-only production
  import audit without changing production code.
- The executable legacy `processDraftImportBatch` body is mapped from
  `app.js:15920` through `app.js:18444`; the frozen lexical scanner continues to
  report its conservative 5,108-line range through line 21027. Both measures are
  retained so the bridge work does not weaken the existing baseline gate.
- The decomposition identifies 20 ordered responsibilities and their inputs,
  outputs, side effects, error/cancellation behavior, current owner, target port,
  and category. The minimum shared port map covers batch/file loading, progress,
  DOCX parsing, PDF source processing, normalization, validation, review-draft
  building, persistence, and diagnostics, with output projection and failure
  reporting recorded as supplemental ports. No Category D responsibility was
  found during this audit.
- The production state map proves the current executable path ends at
  `WAITING_CONFIRMATION`; it does not invoke FormalAdmission, commit formal
  questions, or claim a completed formal-import state. The normal UI currently
  uses the injected transport only when explicitly configured and otherwise
  enters the legacy owner, which is the exact C2-10.5 bridge blocker being
  resolved in later phases.
- Phase 1 failure-first started with 0/3 because all three required architecture
  records were absent. The completed design target passed 3/3; combined design
  and migration architecture targets passed 8/8, the full suite passed
  1,322/1,322, and all 11 mandatory gates passed. Browser preflight/dry-run
  recorded `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run
  or real AI/OCR call occurred.

- Wave C2-10.5 Phase 2 added the pure layer-0
  `qisi-import-equivalence-normalizer.js` owner. It canonicalizes isolated DB
  entity identifiers while preserving their associations and ignores only
  request ids, timestamps, and progress-event time. Source order, draft order,
  content, images, warnings, rejected evidence, ownership, controlled-write,
  prefix, batch state, and file parse state remain comparison inputs.
- The comparison contract returns `EXACT`, `SAFE_REFINEMENT`, or
  `NOT_EQUIVALENT`. DOCX differences can never be safe refinements. PDF
  refinement requires explicit independently approved evidence covering every
  difference, can only remove a suffix or clear answer/solution fields with
  rejected provenance, cannot add drafts or broaden file state, and cannot alter
  protected question content or associations.
- Three executable shadow-contract specifications fix the required isolated DB
  names, seed-only-batch/files boundary, no pre-seeded review draft, no
  `InjectedImportTransport`, and DOCX/PDF/known-bad canonical expectations. They
  are not recorded as true browser equivalence: Phase 5 must replace their
  in-memory contract snapshots with normal-UI legacy/bridge browser runs against
  two real isolated IndexedDB databases.
- Phase 2 failure-first produced four file-level failures because the normalizer
  owner was absent. The completed equivalence and E2E-contract targets passed
  12/12; combined equivalence and architecture targets passed 20/20, the full
  suite passed 1,334/1,334 with no failed, skipped, or todo tests, and all 11
  mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run or real
  AI/OCR call occurred.

- Wave C2-10.5 Phase 3 extracted the first shared production port,
  `BatchContextService.loadBatchAndFiles`. It composes only the existing
  `StorageRepository.get/findBy` reads with the existing context builder,
  preserves repository source order and the legacy missing-batch no-op, returns
  independent batch/file records, and has no write, UI, FormalAdmission,
  external transport, OCR, or vision authority.
- The port fails closed on missing repository/files, retains repository error
  identity, and checks cancellation before and between its two reads. The legacy
  production entry now calls the shared port; its inline batch/file table reads
  were deleted. The initial processing status write remains deliberately inline
  for the later progress/status port, so this commit does not mix domains.
- Diff audit exposed that the newly allowed storage dependency was still present
  in the same manifest entry's forbidden list. A strengthened architecture gate
  failed on the overlap, the manifest was corrected without weakening the state
  machine boundary, and the complete mandatory gate set was rerun afterward.
- The load-port failure-first target began at 1/7 with six failures for the
  absent API and still-inline production reads. Final load/context/architecture
  targets passed 25/25, the full suite passed 1,341/1,341 with no failed,
  skipped, or todo tests, and all 11 mandatory gates passed. Browser
  preflight/dry-run recorded `realApiCalled=false` and
  `underlyingApiCallCount=0`; no PDF real-run or real AI/OCR call occurred.
- `app.js` is now 21,689 physical lines with 315 inventoried functions and
  complete immutable baseline-name coverage. The conservative lexical metric
  for `processDraftImportBatch` is now 5,107 lines. The manifest records 39
  modules and 59 declared dependency edges with no missing target, cycle,
  upward dependency, or owner mismatch.

- Wave C2-10.5 Phase 3 extracted the second shared production port,
  `ProductionDocxSourcePort.parseDocxSource`. It is the sole single-source
  adapter that invokes the existing `QisiBatchImporter.parseDocxFile`, projects
  importer drafts through caller-supplied conversion and acceptance policies,
  and returns the importer images, unmatched answers, and warnings without
  reimplementing the importer or DOCX visual-enhancement algorithms.
- Both the V2 `DocxImportCoordinator` adapter and the normal legacy DOCX path now
  call the same production port. The two former direct importer invocations were
  deleted from `app.js`; caller-specific behavior remains outside the port so V2
  still accepts deterministic media/formula-placeholder drafts while the legacy
  path retains its original text-content predicate and fallback behavior.
- Missing or malformed ports and malformed importer output fail closed with
  stable codes. Importer errors retain identity for the existing coordinator
  mapping and legacy text fallback, AbortSignal is checked before and after the
  importer and projection, and the legacy V2 missing-importer warning, Array
  callback coordinates, source order, and warning values are characterized for
  strict output equivalence.
- The port has no DB, UI, Vue, FormalAdmission, external transport, OCR, vision,
  controlled-write, or fallback authority. It is production-loaded before the
  coordinator/app and registered as the unique owner in both architecture
  manifests; the production port map now classifies `parseDocxSource` as A.
- Failure-first began with the new port test failing at file load because the
  module did not exist. The first mandatory Base Migration run exposed a
  synthetic-fixture false positive caused by splitting `window.Qisi.Utils` from
  its method dot across lines; restoring the established call formatting fixed
  the fixture without changing the gate. The final targeted DOCX/runtime/
  architecture set passed 41/41, Base Migration passed 15/15, the full suite
  passed 1,349/1,349 with no failed, skipped, or todo tests, and all 11 mandatory
  gates passed after the final equivalence audit.
- Browser preflight/dry-run recorded `realApiCalled=false` and
  `underlyingApiCallCount=0`; no PDF real-run or real AI/OCR call occurred.
  `app.js` is now 21,694 physical lines with 315 inventoried functions and
  complete immutable baseline-name coverage. The conservative lexical metric
  for `processDraftImportBatch` is 5,114 lines. The manifest records 40 modules
  and 60 declared dependency edges with no missing target, cycle, upward
  dependency, or owner mismatch.

- Wave C2-10.5 Phase 3 extracted the third shared production port,
  `ProductionPdfSourcesPort.processPdfSources`. It is the minimal adapter that
  forwards the coordinator's batch, already ordered PDF sources, AbortSignal,
  page-progress callback, and existing helper set to the existing
  `QisiBatchEngineV2.processBatchV2` owner.
- The PDF-only V2 production route now calls the shared port from
  `PdfImportCoordinator`; the former inline engine adapter was deleted. Engine
  result identity is preserved and malformed-result validation remains solely
  in the existing coordinator, so this extraction does not change the old
  stable coordinator error classification or create a second result gate.
- Invalid/non-PDF/duplicate/cross-batch sources and a missing engine port fail
  closed before engine entry. Engine errors retain identity for coordinator
  sanitization, cancellation stops before engine entry and discards a late
  result, and the caller's helper object is not mutated. The adapter owns no
  parser, aligner, controlled-write, answer ownership, DB, UI, FormalAdmission,
  Route B, or persistence logic.
- Failure-first began with the new port test failing at file load because the
  module did not exist. Final PDF-port/coordinator/runtime/architecture targets
  passed 29/29, Base Migration passed 15/15, the full suite passed
  1,356/1,356 with no failed, skipped, or todo tests, and all 11 mandatory gates
  passed. Browser preflight/dry-run recorded `realApiCalled=false` and
  `underlyingApiCallCount=0`; no PDF real-run or real AI/OCR call occurred.
- `app.js` remains 21,694 physical lines with 315 inventoried functions and
  complete immutable baseline-name coverage. The conservative lexical metric
  for `processDraftImportBatch` remains 5,114 lines. The manifest records 41
  modules and 61 declared dependency edges with no missing target, cycle,
  upward dependency, or owner mismatch.

- Wave C2-10.5 Phase 3 extracted the fourth shared production port,
  `ProductionImportStatusPort`, with the same-domain `reportProgress` and
  `reportImportFailure` commands. Progress and outer failure status persistence
  now use the existing StorageRepository update/find ports instead of direct
  draft-import table calls in the app adapters.
- `reportProgress` preserves the legacy rounding/coercion and 0..100 bound,
  caller status, and update time, and returns the exact patch for the existing
  Vue reactive list update. That reactive apply remains in `app.js`; the status
  owner has no DOM, Vue, toast, reload, or other UI authority.
- `reportImportFailure` preserves the V2 behavior of marking both the batch and
  all discoverable files failed, including best-effort file lookup, while the
  legacy path still marks only the batch failed. UI toast/reload, fatal-service
  wording, state-machine policy, and ImportDiagnostics remain separate caller
  concerns. Repository failures retain their existing identity.
- Failure-first began with the new status-port test failing at file load because
  the module did not exist. The first full suite reached 1,362/1,363: the sole
  failure was the code-quality scanner treating a test stub named
  `createRepository` as a copied high-risk production owner. One bounded test-
  only rename fixed the false positive without changing production code or the
  gate. Final status/coordinator/code-quality/runtime/architecture targets
  passed 31/31, the full suite passed 1,363/1,363 with no failed, skipped, or
  todo tests, and all 11 mandatory gates passed.
- Browser preflight/dry-run recorded `realApiCalled=false` and
  `underlyingApiCallCount=0`; no PDF real-run or real AI/OCR call occurred.
  `app.js` is now 21,684 physical lines with 315 inventoried functions and
  complete immutable baseline-name coverage. The conservative lexical metric
  for `processDraftImportBatch` is now 5,112 lines. The manifest records 42
  modules and 63 declared dependency edges with no missing target, cycle,
  upward dependency, or owner mismatch.

- Wave C2-10.5 Phase 3 extracted the bounded deterministic output/image
  projection into `ProductionImportOutputPort.projectImportOutput`. The shared
  owner preserves the legacy same-source/question grouping, quality ordering,
  complementary field and evidence merge, warning merge, final source/question
  ordering, update clock, removed-id mapping, draft-image rebinding, and orphan
  image rejection. It returns sanitized diagnostic rows while the existing app
  adapter retains console presentation.
- V2 final persistence, legacy final persistence, and the manual active-batch
  gate now pass draft images through the same production owner and consume its
  rebound image result. The two intermediate legacy gates use the same draft
  projection without image input. Image-token attachment, unmatched evidence,
  batch counters, UI state, and persistence remain in their previous owners.
- The former inline quality, merge, dedupe, and image-rebinding implementation
  was deleted from `app.js` in the same work package. Only the two thin legacy-
  named adapters remain for call-site stability and inventory coverage. The new
  layer-2 owner has no DB, DOM/Vue, persistence, FormalAdmission,
  controlled-write, Route B, external transport, or OCR invocation authority;
  the production port map now classifies `projectImportOutput` as A.
- Failure-first began with the output-port target failing at file load because
  the owner did not exist. Six characterization tests now cover stronger-
  candidate selection, complementary evidence/image preservation, source
  isolation and order, media-only options, deterministic helper fallbacks,
  authority boundaries, production delegation, and deletion of the old core.
  A final static audit found that an expression-body adapter obscured the next
  function from the responsibility scanner; one behavior-neutral formatting
  repair restored complete inventory visibility before every gate was rerun.
- Final targeted output/responsibility/baseline tests passed 11/11, the full
  suite passed 1,369/1,369 with no failed, skipped, or todo tests, and all 11
  mandatory gates passed on the final code shape. Browser preflight/dry-run
  recorded `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run
  or real AI/OCR call occurred.
- `app.js` is now 21,289 physical lines with 299 inventoried functions and
  complete immutable baseline-name coverage. The conservative lexical metric
  for `processDraftImportBatch` is 5,114 lines. The manifest records 43 modules
  and 64 declared dependency edges with no missing target, cycle, upward
  dependency, or owner mismatch.

- Wave C2-10.5 Phase 3 completed the production review-draft persistence
  wiring through the existing `DraftPersistenceService` and
  `StorageRepository` owners. The new service-level
  `persistReviewDraftBatch` port loads the current batch and, when omitted by
  the caller, current file records; it derives the existing optimistic version
  and idempotency key before delegating to the established locked
  `persistDraftBatch` transaction path.
- The repository transaction primitive now includes `draftImages` in the same
  atomic replacement as drafts, files, and the batch. Image batch association
  and duplicate ids fail before persistence. An explicitly supplied empty image
  set clears stale images, while older low-level callers that omit `images`
  retain their previous image rows and pre-image metadata signature exactly.
- V2 final persistence, legacy final persistence, and manual active-batch
  dedupe now call the same service facade. Their former direct draft/image DB
  transactions were deleted. V2 still supplies its all-success file projection;
  legacy and manual paths retain the current per-file parse states. Batch
  counters, unmatched answers, error text, and unassigned-image counting remain
  caller projections, and FormalAdmission remains outside review persistence.
- Failure-first began at 0/5 because the production port and its three call
  sites did not exist. The first implementation reached 3/5; one bounded repair
  forwarded the already-validated image set from service to repository. A later
  compatibility counterfactual proved that unconditional `images:null` would
  conflict with an upgrade-era idempotent replay, so image metadata is now added
  to signatures only for explicit image-aware commands. The old signature and
  old image rows replay unchanged.
- Final persistence/storage tests passed 15/15 and the broader persistence,
  output, review, responsibility, architecture, and runtime target passed
  46/46. The full suite passed 1,375/1,375 with no failed, skipped, or todo
  tests, and all 11 mandatory gates passed. Browser preflight/dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run or real
  AI/OCR call occurred.
- `app.js` is now 21,286 physical lines with 299 inventoried functions and
  complete immutable baseline-name coverage. The conservative lexical metric
  for `processDraftImportBatch` is 5,110 lines. The manifest remains at 43
  modules and 64 declared dependency edges with no missing target, cycle,
  upward dependency, or owner mismatch.

- Wave C2-10.5 Phase 4 added the real layer-3
  `ProductionImportBridge` workflow owner. It composes only injected production
  owners for the state machine, batch/file context, role classification,
  deterministic DOCX and safe-partial PDF coordination, candidate normalization,
  output projection, validation, review construction, atomic draft persistence,
  progress/failure status, and sanitized diagnostics.
- The bridge drives the existing explicit DOCX and PDF state paths and stops at
  `WAITING_CONFIRMATION`; it never performs FormalAdmission or a formal write.
  Mixed attachment types, missing/duplicate context, raw JSON output, malformed
  source results, sequence gaps, ownership mismatch, missing ports, persistence
  failure, cancellation/late output, and diagnostic privacy attacks all fail
  closed with stable errors before unsafe persistence.
- No `processDraftImportBatch` logic was copied or deleted. The bridge owns no
  DB, DOM/Vue, external transport, OCR invocation, parser/aligner,
  controlled-write, Route B, silent legacy fallback, or FormalAdmission
  authority. It is browser-loaded and registered as a layer-3 `scaffold`; the
  normal UI still uses the legacy path until real browser shadow equivalence is
  proven and Phase 6 explicitly switches it.
- Failure-first began with the bridge module absent (0/1 file-level target). The
  first implementation reached 10/11; one bounded test-contract repair retained
  the existing state-machine distinction between duplicate context
  (`IMPORT_START_INVALID`) and missing source role (`IMPORT_CONTEXT_INVALID`).
  Final bridge tests passed 12/12, the combined owner/architecture target passed
  95/95, and the full suite passed 1,387/1,387 with no failed, skipped, or todo
  tests. All 11 mandatory gates passed in order. Browser preflight/dry-run
  recorded `realApiCalled=false` and `underlyingApiCallCount=0`; no PDF real-run
  or real AI/OCR call occurred.
- `app.js` remains behaviorally unchanged in this work package. The manifest now
  records 44 modules and 78 declared dependency edges with no missing target,
  cycle, upward dependency, or owner mismatch.

## Pending

- The PDF candidate projection corrective package started from clean pushed
  commit `7c854d9516f86cf030deed1c22df6229f002a15b`. The legacy projection audit and
  production-linked characterization were independently tested, committed, and
  pushed as `1ed14fcf9a5bef324ad3674392d8e575a18c13bc`.
- The shared `qisi-pdf-candidate-projection.js` owner was implemented,
  browser-loaded, independently gated, committed, and pushed as
  `f07b0341b10c0292aaae82e996029bc340756d14`. It consumes the real
  controlled-write result and fails closed for missing source mode,
  controlled-write, alignment, ownership, sequence, schema, or strict PDF-AI
  field evidence.
- The corrective production wiring is complete in the working package. The
  normal `processDraftImportBatch` path retains the actual parser/aligner and
  controlled-write results and delegates final PDF candidate projection to the
  shared owner. `ProductionPdfSourcesPort` builds the V2 context through that
  owner, and `ProductionImportBridge` requires and calls the same injected
  `projectPdfCandidates` port. The bridge remains an overall layer-3 scaffold;
  this package does not switch the normal UI entry.
- The old app-local fused/field warning projection and its mutable maps were
  deleted in the same change that activates the shared owner. Parser, aligner,
  controlled-write, OCR, persistence, UI, and DOCX logic stayed in their
  existing owners. All six package-frozen high-risk files remain unmodified.
- Production-linked projection/Bridge/runtime/architecture targets passed
  107/107. The true Chromium shadow started from normal `main.html` and passed
  DOCX deterministic, PDF full, PDF prefix/safe-partial, PDF missing-answer,
  and PDF ownership-known-bad cases with zero canonical differences, wrong
  attachments, raw-JSON leakage, placeholders, controlled-write bypass, or
  real AI/OCR requests.
- The first `verify:safe` run correctly exposed that deleting five app-local
  warning callsites made the old display-cleaner residual baseline stale
  (39 expected versus 34 present). One bounded audit-only correction froze the
  new count at 34 and added a guard proving the deleted PDF projection cannot
  return. The complete display-cleaner R3 audit then passed 81/81.
- On the corrected final code shape, `verify:safe` passed the full suite at
  1,419/1,419 with no failure, skipped, todo, or timeout. All 11 mandatory
  gates passed; PDF browser preflight and dry-run recorded
  `realApiCalled=false` and `underlyingApiCallCount=0`. DOCX stable passed
  20/20, PDF known-bad passed 65/65, controlled-write ownership passed 21/21,
  Base Migration passed 15/15, and Route B hold passed 6/6. No real-run was
  performed.
- Shared-owner wiring, old inline projection removal, and browser shadow evidence
  were committed and pushed as
  `2a2b4043927c4583679d34613524e0538788861a`. Local, tracked remote, and live
  remote branch hashes were equal, both comparison logs were empty, and the
  working tree was clean after the push.
- The bounded corrective decision is
  `PDF_PROJECTION_OWNER_CORRECTION_ACCEPTED`; the evidence report is
  `docs/release/PDF_PROJECTION_OWNER_CORRECTION_R3.md`. Phase 5 browser
  equivalence may resume. C2-11 through C2-14, attacks, audits, benchmark, CTO
  review, and seal remain blocked until Phase 5 itself is accepted.
- The Phase 5 pre-resume safety patch verified all four review findings before
  code changes, then corrected raw-JSON provenance rebuilding, per-field
  canonical provenance comparison, ambiguous multi-support inputs, and
  duplicate accepted controlled-write conflicts in the existing unique
  `qisi-pdf-candidate-projection.js` owner. No frozen file, validator, normal UI
  entry, or FormalAdmission path changed.
- The expanded true-browser shadow passed all eight required cases with zero
  canonical differences for accepted behavior and zero wrong attachments, raw
  JSON leakage, placeholders, controlled-write bypass, review persistence for
  negative cases, formal writes, or real API calls. The full suite passed
  1,434/1,434, all 11 mandatory gates passed, and preflight/dry-run made zero
  underlying API calls. Evidence is sealed in
  `docs/release/PHASE5_PRE_RESUME_SAFETY_PATCH_R1.md`.
- Decision: `PHASE5_PRE_RESUME_SAFETY_PATCH_ACCEPTED`;
  `PHASE_5_RESUME_ALLOWED`; `PHASE_5_NOT_YET_ACCEPTED`;
  `C2_11_PROHIBITED`.

## Blockers / limitations

- Upload-to-review, switch p50/p95, draft persist, formal submit, reload, export,
  image/IndexedDB size, and repeated-run memory growth do not yet have a stable
  Program C baseline harness; Phase 6 may only compare metrics measured under the
  same harness and conditions.
- Static regex counts are reproducible lexical measures, not proof of runtime
  reachability or permission to delete a call site.

## Next exact action

Resume Phase 5 browser equivalence. Do not enter C2-11 until Phase 5 itself is
accepted.
