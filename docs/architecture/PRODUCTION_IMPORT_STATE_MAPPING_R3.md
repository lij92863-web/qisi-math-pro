# Production Import State Mapping R3

## Review-only boundary

The ProductionImportBridge owns one import-to-review run. It ends after the
repository confirms an atomic review-draft transaction. Teacher confirmation and
formal insertion remain separate Program A owners.

The bridge MUST NOT enter `FORMAL_ADMISSION`.
The bridge MUST NOT enter `COMMITTING`.
The bridge MUST NOT enter `COMPLETED`.

Its successful terminal handoff is `WAITING_CONFIRMATION`.

## Common prefix

```text
IDLE
  -- start/loadBatchAndFiles --> PREPARING
PREPARING
  -- prepared/create context + classify roles --> LOADING_SOURCE
```

The `start` command validates the batch id and reserves no formal-write token.
The `prepared` command calls BatchContextService and SourceRoleClassifier on the
loaded immutable snapshot. Missing/duplicate/ambiguous roles fail before parsing.

## DOCX branch

```text
LOADING_SOURCE
  -- deterministic-source-loaded/parseDocxSource --> NORMALIZING
NORMALIZING
  -- normalized/normalizeCandidates --> STRUCTURING
```

The `deterministic-source-loaded` command invokes the real DocxImportCoordinator,
which in turn invokes the single real `parseDocxSource` port. No recognition state
or OCR call is invented for deterministic DOCX. The coordinator output is the
only input to normalization.

## PDF branch

```text
LOADING_SOURCE
  -- recognition-source-loaded/processPdfSources --> RECOGNIZING (PDF only)
RECOGNIZING
  -- recognition-complete/release isolated candidates --> NORMALIZING
NORMALIZING
  -- normalized/normalizeCandidates --> STRUCTURING
```

The PDF command invokes PdfImportCoordinator and the existing production engine
adapter with the state-machine AbortSignal. PdfSupportControlledWrite and the
safe-partial owner remain authoritative. A late result after abort is discarded.

## Shared review pipeline

```text
STRUCTURING
  -- structured/projectImportOutput --> VALIDATING
VALIDATING
  -- validation-complete/validateCandidates --> BUILDING_REVIEW
BUILDING_REVIEW
  -- review-built/buildReviewDrafts --> PERSISTING_DRAFT
PERSISTING_DRAFT
  -- draft-transaction-committed/persistReviewDraftBatch --> WAITING_CONFIRMATION
```

`projectImportOutput` may only perform characterized deterministic projection and
image association. Validation must complete before ReviewDraftBuilder and before
the first persistence call. Persistence failure maps to `FAILED` only after the
repository rollback result is known. Success returns batch/draft reload tokens and
does not invoke FormalAdmission.

## Cancellation and failure mapping

| State | Cancellation/failure requirement |
| --- | --- |
| PREPARING | abort before any source side effect; stable preparation failure |
| LOADING_SOURCE | close/discard source snapshot; no draft exists |
| RECOGNIZING (PDF only) | abort engine/coordinator; ignore late request result |
| NORMALIZING | discard derived candidates |
| STRUCTURING | discard unvalidated projection |
| VALIDATING | publish no accepted result |
| BUILDING_REVIEW | discard unpersisted ReviewDraft values |
| PERSISTING_DRAFT | require repository rollback proof or committed idempotent result |
| WAITING_CONFIRMATION | cancellation cannot delete formal data and invokes no formal owner |

Diagnostics observes transitions through the allowlisted run-scoped port. State,
diagnostics, repository status and UI progress are separate effects; no command
may hide a fallback to legacy after a side effect.

## Production-switch gate

This mapping becomes production-wired only after both DOCX and PDF browser runs
use the normal UI without `InjectedImportTransport`, isolated legacy/bridge DBs
produce canonical equivalence, and the single normal callsite selects the bridge.
Until then the state machine remains honestly `scaffold`.
