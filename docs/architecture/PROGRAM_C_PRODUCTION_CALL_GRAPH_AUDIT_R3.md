# Program C Production Call Graph Audit R3

## Scope and authority

This audit starts at the real browser entry in `main.html`, follows the normal
UI event handlers in `app.js`, and checks the concrete production owners loaded
before the shell. It does not infer production reachability from test imports.

- C2-13 baseline: `576b47796140f000ca972a745c414f3e73f44f67`
- branch: `stage/app-shell-slimming-r3`
- normal UI owner: `ProductionImportBridge`
- formal-write owner: `StorageRepository.confirmDraftToQuestion`, reachable
  only through `BatchFormalSubmit` after `FormalAdmissionPolicy`
- authoritative machine-readable graph:
  `docs/architecture/owners.json` and `docs/architecture/layers.json`
- compatibility projection: `architecture/layers.json` and
  `architecture/owners.json`

## Runtime entry and load order

The production page loads contracts and repositories first, source/policy
owners next, then the PDF controlled-write/projection chain, validation,
ReviewDraft construction and persistence, state machine, Bridge, normal UI
controller, and finally `app.js`.

The architecture gate checks the following critical subsequence against the
actual script tags, not a documentation-only list:

```text
qisi-pdf-support-block-parser.js
  -> qisi-pdf-support-controlled-write.js
  -> qisi-pdf-candidate-projection.js
  -> qisi-import-validation-service.js
  -> qisi-review-draft-builder.js
  -> qisi-draft-persistence-service.js
  -> qisi-import-state-machine.js
  -> qisi-production-import-bridge.js
  -> qisi-normal-ui-import-controller.js
  -> app.js
```

Every compatibility-manifest module marked `production-wired` must be present
in the detailed owner manifest as `production` and must be loaded by
`main.html`. Every detailed production owner must be loaded before `app.js`,
except the shell itself, which must be the final entry. Deprecated and
research-only owners must be absent. A script path under `tests/` is forbidden
from the production page.

## Normal UI route graph

### DOCX deterministic and DOCX+DOCX stable

```text
main.html batch command
  -> app.js UI handler
  -> NormalUiImportController.runBatchRecognition
  -> ProductionImportBridge.run(mode = production)
  -> ImportStateMachine
  -> BatchContextService + SourceRoleClassifier
  -> DocxImportCoordinator
  -> ProductionDocxSourcePort
  -> CandidateNormalizer
  -> ImportValidationService
  -> ReviewDraftBuilder
  -> DraftPersistenceService
  -> StorageRepository draft transaction
  -> DraftPersistenceService.reloadDraftBatch
  -> app.js review-state mapping
```

The deterministic source port preserves the canonical DOCX producer identity.
The Bridge cannot call Formal Admission and cannot write a formal question.

### DOCX vision question/support

```text
ProductionImportBridge
  -> DocxImportCoordinator
  -> ProductionDocxVisionSourcePort
  -> QwenVisionSourcePort
  -> OcrQwenAdapter (source-port-owned execution)
  -> DocxProducerIdentityContract
  -> CandidateNormalizer -> validation -> ReviewDraft -> draft persistence
```

`app.js` no longer creates or executes the Qwen adapter. It calls
`QwenVisionSourcePort.createProductionOcrRuntime`; the source port owns the
transport/task-client construction and exposes bounded source operations.
Shadow DOCX vision is explicitly non-authoritative and the Bridge rejects a
shadow result that reports a formal or ReviewDraft write.

### PDF full and safe-partial

```text
ProductionImportBridge
  -> PdfImportCoordinator
  -> ProductionPdfSourcesPort
  -> PdfCandidateProjection
      -> PdfSupportBlockParser
      -> PdfSupportAligner
      -> PdfSupportControlledWrite
  -> CandidateNormalizer
  -> ImportValidationService
  -> ReviewDraftBuilder
  -> DraftPersistenceService
```

The UI shell has no reference to the PDF block parser, aligner, or
controlled-write owner. The Bridge also cannot reach controlled-write
directly; it receives only the candidate-projection port. Missing production
projection dependencies throw `pdf-production-projection-dependency-missing`.
Missing per-run projection or controlled-write evidence rejects the projection
context instead of returning an accepted empty result.

### Known-bad rejection

Known-bad, ambiguous, discontinuous, rewind, conflicting, raw-JSON, ownership,
and provenance failures stop in projection, normalization, or validation. The
state machine enters a typed failed/cancelled state. Draft persistence is not
entered after a failed validation step, and no formal owner is reachable.

## ReviewDraft lifecycle

```text
Bridge persistence command
  -> DraftPersistenceService.persistReviewDraftBatch
  -> StorageRepository.persistReviewDraftBatch transaction
  -> DraftPersistenceService.reloadDraftBatch readback

review reload/manual edit/image command
  -> app.js UI command mapping
  -> DraftPersistenceService command
  -> StorageRepository draft tables
  -> readback and version/idempotency verification
```

`DraftPersistenceService` is the single ReviewDraft persistence owner. The
validator has no persistence/repository reference. Missing repository methods,
version, batch identity, or idempotency keys fail closed with typed errors.

## Teacher confirmation and formal admission

```text
app.js submitDraftQuestion / confirmBatchSubmit
  -> BatchFormalSubmit.submit
  -> ImportStateMachine(WAITING_CONFIRMATION)
  -> FormalAdmissionPolicy.evaluateDraftAdmission
  -> StorageRepository.confirmDraftToQuestion
  -> repository transaction and readback
```

The shell maps the teacher command and displays the result but contains no
`db.questions.put/add/bulkPut/delete` call. `ProductionImportBridge` contains
no Formal Admission, formal repository, or question-table reference. Missing
policy, formal repository method, or state-machine factory throws
`BATCH_FORMAL_SUBMIT_DEPENDENCY_REQUIRED`.

## Forbidden edge results

| Forbidden edge | Gate evidence | Result |
| --- | --- | --- |
| UI -> OCR adapter execution | no `Qisi.OcrQwenAdapter` or task-client execution in `app.js` | closed |
| UI -> PDF parser/aligner/controlled-write | namespace/static scan plus owner manifest | closed |
| UI -> formal DB | no formal table mutation in `app.js` | closed |
| Bridge -> formal DB / Formal Admission | Bridge static scan and browser isolation | closed |
| coordinator/source port -> UI | DOM/Vue/AppProxy scan over DOCX/PDF owners | closed |
| repository -> UI | DOM/Vue/AppProxy scan | closed |
| validator -> persistence | persistence/repository/transaction scan | closed |
| deprecated owner -> production | detailed/compatibility/runtime cross-check | closed |
| Route B -> production | research test artifact only; no production script | closed |
| test-only adapter -> production | no `tests/` script path in `main.html` | closed |
| missing dependency -> permissive result | counterfactual factory tests | closed |
| manifest -> runtime mismatch | two-manifest and real script-order gate | closed |

## Retirement and non-production reachability

- `processDraftImportBatch` and `processDraftImportBatchV2` are removed.
- `qisi-legacy-batch-run-coordinator.js`, `qisi-injected-import-path.js`, and
  `qisi-import-orchestrator.js` are deprecated historical/test artifacts and
  have no production caller.
- `qisi-import-equivalence-normalizer.js` is the retired shadow comparator and
  has no production caller.
- Route B exists only as the research contract test
  `tests/pdf-answer-only-ai-pass.test.js`; the prohibited production Route B
  implementation remains absent.
- Local/shadow OCR owners are loaded only for explicit shadow capability. They
  have no controlled-write, persistence, Formal Admission, or formal-write
  authority.

## Fail-closed dependency evidence

The C2-13 dependency gate attacks missing Bridge ports, validator,
controlled-write/projection dependencies, draft repository, formal policy,
formal repository, state-machine factory, source classifier input, DOCX vision
source ports, and PDF production source ports. Each case throws/rejects a typed
error. No case returns `valid: true`, an identity projection, a no-op command,
or an empty accepted result.

The PDF answer-extraction quality helper remains an optional conservative
enricher inside controlled-write: if it is absent in the browser, enrichment is
skipped and no answer is promoted because of its absence. It is not a required
controlled-write owner and cannot create an accepted decision.

## Audit conclusion

The normal UI import graph converges on one production Bridge, stops at
ReviewDraft persistence, and reaches the formal repository only through the
separate teacher-confirmation graph. No legacy, Route B, test-only, or missing-
dependency fallback route is production-reachable.
