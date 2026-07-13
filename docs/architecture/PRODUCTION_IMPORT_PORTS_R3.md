# Production Import Ports R3

## Classification rules

- A: an existing callable production owner can be reused directly.
- B: the behavior is still trapped in the old app function and must be moved once,
  with the old inline implementation deleted in the same commit.
- C: the owner exists, but the real normal production callsite is not wired.
- D: stop; do not create a second algorithm.

Category D exists: no. This is a read-only conclusion, not permission to assume a
port works; every B/C port still needs characterization and a one-port switch.

## Minimum bridge ports

| Port | Class | Existing source/owner | Required action | Contract and side effects |
| --- | --- | --- | --- | --- |
| loadBatchAndFiles | A | StorageRepository `get/findBy`; BatchContextService | inject repository facade; no direct DB in bridge | returns independent batch/files in source order; no UI mutation |
| reportProgress | B | `app.js:720–726`, scattered legacy status writes | move repository progress/status patch to one owner; leave UI callback in shell | monotonic bounded progress, explicit batch/file status, stable failure |
| parseDocxSource | B | `app.js:15598–15717` plus QisiBatchImporter; DocxImportCoordinator consumes it | move adapter once, delete app implementation, keep importer algorithm untouched | one declared DOCX source to drafts/images/warnings; AbortSignal; no direct persistence |
| processPdfSources | C | PdfImportCoordinator + QisiBatchEngineV2 `processBatchV2` | wire the existing engine through an explicit adapter; no duplicate parser/aligner/write | ordered PDF sources to safe-partial candidates/images/warnings; controlled-write remains existing owner |
| normalizeCandidates | A | CandidateNormalizer `normalizeCandidates` | inject current API and SupportRepair helper ports | immutable canonical candidates; no ownership or persistence |
| validateCandidates | A | ImportValidationService `validateImportDrafts` | inject existing five validation ports | fail closed; schema/sequence/ownership/safe-partial/controlled-write decisions retained |
| buildReviewDrafts | A | ReviewDraftBuilder `buildReviewDrafts` | inject current API | preserves missing/rejected/manual/warning metadata; no formal write |
| persistReviewDraftBatch | A | DraftPersistenceService `persistDraftBatch` | inject repository-backed facade | atomic idempotent review-only write, version conflict, rollback |
| recordDiagnostics | A | ImportDiagnostics `createImportDiagnostics` | create one run-scoped instance and inject its four methods | allowlisted metadata only; logger failure cannot affect import |

## Required supplemental shared ports

The minimum list does not erase two behaviors explicitly required by equivalence.
They are extracted only if their characterization proves a move is possible.

| Port | Class | Reason | Required action |
| --- | --- | --- | --- |
| projectImportOutput | B | legacy final dedupe, image association, unmatched and batch counts affect persisted equality | move one bounded projection at a time; old branch calls it first, then bridge calls the same owner |
| reportImportFailure | B | file/batch failure status and sanitized error mapping are scattered | move status mapping only; state-machine policy and UI toast remain separate |

## Ownership and dependency constraints

The bridge may compose these ports but may not implement their algorithms. It has
no DB object, DOM/Vue state, FormalAdmission, Route B, parser/aligner clone,
controlled-write clone, JSON repair table, OCR policy, or hidden fallback.

Port extraction order is load, DOCX, PDF, progress/error, output projection, then
persistence wiring. A/B/C is re-evaluated after every commit. If any needed
behavior becomes D, work stops before production modification.
