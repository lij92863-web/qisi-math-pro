# Legacy Batch Owner Retirement Audit — C2-11

## Scope and baseline

- Branch: `stage/app-shell-slimming-r3`
- C2-11 start commit: `c77523c590b424a9c7f011ae2c0881ca8188f69a`
- Retired production owner: `processDraftImportBatch`
- Baseline source range: `app.js` lines 15,612–18,106, immediately before
  baseline `runBatchRecognition` at line 18,107
- Baseline runtime coordinator: `LegacyBatchRunCoordinator`
- Accepted Phase 5 invariant: normal DOCX vision and PDF producers already had
  same-producer canonical shadow equivalence; deterministic DOCX remained
  non-applicable to the normal UI.

At the baseline, every visible create/retry/rerun command reached
`runBatchRecognition`, then the legacy coordinator, then the giant owner. The
giant owner selected engines, orchestrated parsing/alignment/controlled-write,
constructed provenance/support/review records, and persisted review drafts.
The Bridge was shadow-only from the normal UI perspective.

## Removed production graph

```text
main.html batch event
  -> app.js runBatchRecognition
  -> LegacyBatchRunCoordinator.run
  -> app.js processDraftImportBatch
       -> source/engine switch
       -> parser/aligner/controlled-write orchestration
       -> candidate provenance/support projection
       -> validation and ReviewDraft construction
       -> draft persistence and UI mutation
```

The entire `processDraftImportBatch` implementation was removed rather than
copied. Its public Vue-proxy entry, legacy coordinator construction, injected
legacy dispatch, and main-page script dependencies were removed with it. There
is no compatibility wrapper and no catch branch that retries through the old
owner.

## Current production graph

```text
main.html create/retry/rerun event
  -> app.js runBatchRecognition
  -> qisi-normal-ui-import-controller.js
  -> qisi-production-import-bridge.js (explicit production mode)
  -> ImportStateMachine
  -> BatchContextService + SourceRoleClassifier
  -> one truthful source route
       DOCX: ProductionDocxVisionSourcePort + producer identity owner
       PDF:  ProductionPdfSourcesPort + PDF coordinator/projection owner
  -> CandidateNormalizer
  -> ImportOutputProjectionService
  -> ImportValidationService
  -> ReviewDraftBuilder
  -> DraftPersistenceService
  -> StorageRepository atomic transaction
  -> reload/readback verification
  -> controller applyReviewModel
```

The Bridge stops in `WAITING_CONFIRMATION`. It has no Formal Admission command
and no formal-question repository write. Failure is returned through a stable
sanitized code; the controller releases busy state and never invokes a second
owner.

## Runtime and production-call proof

`tests/e2e/production-normal-ui-import-cutover.test.js` boots normal
`main.html`, calls the same Vue proxy used by the template, and does not seed a
final ReviewDraft. Its 15 cases exercise DOCX vision, DOCX question+answer, PDF
full/safe-partial/known-bad/conflict/ambiguity, raw JSON, formula fallback,
cancellation, persistence failure, duplicate click, reload, error recovery,
and formal-write isolation.

The captured evidence establishes:

| Counter | Result |
| --- | ---: |
| Bridge production calls | > 0 |
| normal UI review successes | > 0 |
| legacy production calls | 0 |
| legacy fallback calls | 0 |
| Bridge formal writes | 0 |
| wrong attachments | 0 |
| raw JSON leakage | 0 |
| placeholder leakage | 0 |
| controlled-write bypass | 0 |
| real API calls | 0 |
| white screens / unexpected console errors | 0 |

This is runtime proof supplemented by static architecture gates; it is not a
grep-only retirement claim.

## Persistence, cancellation, and retry proof

- The controller shares duplicate clicks for one batch and uses a stable
  source-version/request identity.
- The Bridge returns success only after atomic ReviewDraft persistence and
  verified repository readback.
- A lost-response/reload retry with the committed identity returns the same
  persisted review without a second producer execution.
- Cancellation is checked before source work, during recognition, before
  validation, before persistence, and within the repository transaction.
- Transaction-time cancellation rolls back every review table. Once the
  verified committed result reaches the UI mapping boundary it is explicitly
  non-cancellable, so a valid commit cannot be reported as cancelled.
- Persistence failure, cancellation, malformed producer output, unsupported
  route, and validation failure have no partial draft, no formal write, and no
  legacy fallback.

## Residual code classification

`processDraftImportBatchV2` remains in `app.js` at C2-11. It is a 216-line
unreachable migration precursor: it has no template event, is not exported by
the Vue proxy, and is not called by `runBatchRecognition`. It is not the normal
UI production owner. Moving its remaining import-domain behavior is the
separate C2-12 shell-convergence obligation.

`qisi-legacy-batch-run-coordinator.js` may remain as a historical module until
C2-13 dead-code closure, but it is not loaded by `main.html` and has no current
application callsite. The same is true of the legacy injected transport script;
the C2-11 deterministic browser fixture is injected directly behind a Bridge
port and cannot select a second production owner.

## Frozen and safety boundaries

The six frozen PDF files are byte-unchanged. Parser, aligner,
controlled-write, Formal Admission, Route B, and formal repository owners were
not weakened or moved. The PDF safe-partial acceptance range was not expanded,
and the DOCX stable route remains green.

## Retirement decision

The normal UI has one production import coordinator,
`ProductionImportBridge`; `processDraftImportBatch` is deleted; legacy
production and fallback runtime counts are zero; ReviewDraft success is proven;
formal writes remain zero.

`C2_11_LEGACY_BATCH_OWNER_RETIREMENT_ACCEPTED`
