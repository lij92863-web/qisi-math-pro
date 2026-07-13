# Import State Machine R3

## Contract boundary

The machine owns import lifecycle state and transition validation only. It has no
hidden side effects in its state object. Every action is an injected command that
returns a typed output; the machine records state/progress/error metadata after the
command resolves. It never implements parsing, OCR transport, controlled-write,
FormalAdmission, Repository transactions, or UI rendering.

One run has an immutable `runId`, `batchId`, input manifest digest, settings/engine
snapshot, retry budget, monotonic transition sequence, and AbortSignal. Reusing an
idempotency key returns the existing completed/persisted result or rejects a
conflicting manifest. An invalid transition fails closed with
`IMPORT_INVALID_TRANSITION` and does not run an action or mutate state.

## States

| State | Owner-visible meaning | Progress | Cancellation/retry rule |
| --- | --- | ---: | --- |
| IDLE | no active run | 0 | start only; no retry |
| PREPARING | validate command, snapshot settings and manifest | 2 | cancellable; retry from clean snapshot |
| LOADING_SOURCE | load declared files through source owner | 10 | cancellable; discard partial buffers |
| RECOGNIZING | invoke injected DOCX/PDF/adapter coordinator | 25 | AbortSignal required; retry only within budget |
| NORMALIZING | convert candidate contracts without ownership decisions | 45 | cancellable; candidate remains isolated |
| STRUCTURING | deterministic structure orchestration | 55 | cancellable; no fabricated fields |
| VALIDATING | compose schema/sequence/ownership/safety owners | 65 | cancellable; fail closed |
| BUILDING_REVIEW | create review-only drafts and warnings | 75 | cancellable; rejected fields stay rejected |
| PERSISTING_DRAFT | repository-owned review draft transaction | 85 | cancellation requires rollback proof |
| WAITING_CONFIRMATION | manual review required; no formal write | 90 | user may cancel or request admission |
| FORMAL_ADMISSION | invoke existing source-aware policy | 94 | cancellable before commit token; rejection returns to review |
| COMMITTING | repository transaction owns formal commit | 98 | not cancellable after transaction begins |
| COMPLETED | committed/persisted terminal result | 100 | immutable result; reset creates a new run |
| CANCELLED | recoverable terminal cancellation | retained | reset or bounded retry with a new attempt |
| FAILED | stable error terminal state | retained | retry only when error policy and budget allow |

## Transition table

| ID | From | To | Trigger | Precondition | Action | Output | Recoverability | Error code | Cancellation behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | IDLE | PREPARING | start | no active run; manifest supplied | validate command and reserve run/idempotency key | immutable run envelope | restart only before side effects | IMPORT_START_INVALID | abort before reservation leaves IDLE |
| T02 | PREPARING | LOADING_SOURCE | prepared | manifest/settings/engine snapshots valid | classify explicit source roles and build context | BatchContext | retry from PREPARING | IMPORT_CONTEXT_INVALID | AbortSignal discards snapshot |
| T03 | LOADING_SOURCE | RECOGNIZING | recognition-source-loaded | source digest matches context and OCR/PDF path declared | call injected recognition coordinator | RecognitionCandidate set | bounded retry by stable error policy | IMPORT_RECOGNITION_START_FAILED | abort cancels coordinator and temp work |
| T04 | LOADING_SOURCE | NORMALIZING | deterministic-source-loaded | deterministic DOCX candidate exists | pass candidate to normalizer | source candidates | retry load without duplicate draft | IMPORT_SOURCE_LOAD_FAILED | abort discards candidate buffers |
| T05 | RECOGNIZING | NORMALIZING | recognition-complete | requestId/version match and candidate contract valid | freeze recognition evidence and release transport | isolated candidates | bounded recognition retry | IMPORT_RECOGNITION_FAILED | late results ignored after abort |
| T06 | NORMALIZING | STRUCTURING | normalized | wrapper/contract cleanup valid | invoke structure coordinator | normalized candidates | retry from original candidates | IMPORT_NORMALIZATION_FAILED | abort preserves no partial normalized owner |
| T07 | STRUCTURING | VALIDATING | structured | deterministic structure output contract valid | freeze evidence/provenance for validators | structured drafts | retry structure without writes | IMPORT_STRUCTURE_FAILED | abort discards unvalidated drafts |
| T08 | VALIDATING | BUILDING_REVIEW | validation-complete | every draft has explicit accepted/rejected decision | collect ValidatedQuestionDraft array | validated drafts and warnings | invalid data requires manual/source correction | IMPORT_VALIDATION_FAILED | abort produces no review draft |
| T09 | BUILDING_REVIEW | PERSISTING_DRAFT | review-built | missing/rejected fields and provenance retained | build ReviewDraft array | review drafts | rebuild from validated drafts | IMPORT_REVIEW_BUILD_FAILED | abort produces no persistence command |
| T10 | PERSISTING_DRAFT | WAITING_CONFIRMATION | draft-transaction-committed | repository confirms atomic idempotent write | publish draft ids and reload token | persisted review batch | repository retry by idempotency key | IMPORT_DRAFT_PERSIST_FAILED | abort before commit rolls back; after commit returns id |
| T11 | WAITING_CONFIRMATION | FORMAL_ADMISSION | teacher-confirm | manual review complete and version current | request existing FormalAdmission decision | admission decision | rejection is recoverable in review | IMPORT_CONFIRMATION_STALE | abort leaves persisted review intact |
| T12 | FORMAL_ADMISSION | COMMITTING | admitted | fresh valid decision matches exact draft/context | create repository commit command | immutable commit token | retry by idempotency key only | IMPORT_ADMISSION_REJECTED | abort allowed before commit token dispatch |
| T13 | COMMITTING | COMPLETED | repository-committed | transaction and post-read verification succeed | publish confirmed question ids | terminal result | idempotent readback only | IMPORT_COMMIT_FAILED | not cancellable after transaction begins |
| T14 | PREPARING | CANCELLED | cancel | abort requested | release reservation | cancellation receipt | reset/retry allowed | IMPORT_CANCELLED_PREPARING | immediate |
| T15 | LOADING_SOURCE | CANCELLED | cancel | abort requested | close readers and delete owned temp jobs | cancellation receipt | reset/retry allowed | IMPORT_CANCELLED_LOADING | wait for cleanup acknowledgment |
| T16 | RECOGNIZING | CANCELLED | cancel | abort requested | abort adapter/coordinator request | cancellation receipt | retry consumes retry budget | IMPORT_CANCELLED_RECOGNITION | late response ignored by requestId |
| T17 | NORMALIZING | CANCELLED | cancel | abort requested | discard derived candidates | cancellation receipt | reset/retry allowed | IMPORT_CANCELLED_NORMALIZING | immediate at item boundary |
| T18 | STRUCTURING | CANCELLED | cancel | abort requested | discard unvalidated structure | cancellation receipt | reset/retry allowed | IMPORT_CANCELLED_STRUCTURING | immediate at item boundary |
| T19 | VALIDATING | CANCELLED | cancel | abort requested | stop validation batch | cancellation receipt | reset/retry allowed | IMPORT_CANCELLED_VALIDATING | no accepted result published |
| T20 | BUILDING_REVIEW | CANCELLED | cancel | abort requested | discard unpersisted ReviewDraft values | cancellation receipt | reset/retry allowed | IMPORT_CANCELLED_REVIEW_BUILD | immediate at item boundary |
| T21 | PERSISTING_DRAFT | CANCELLED | cancel | transaction has not committed | request repository rollback and verify absence | rollback receipt | retry after rollback proof | IMPORT_CANCELLED_PERSISTING | terminal only after rollback proof |
| T22 | WAITING_CONFIRMATION | CANCELLED | cancel | no formal commit active | mark run cancelled; retain separately managed draft per policy | cancellation receipt | new attempt may reuse source context | IMPORT_CANCELLED_REVIEW | immediate; no formal data change |
| T23 | RECOGNIZING | FAILED | command-failed | stable coordinator error received | map error without raw content | failure receipt | retry only for allowlisted transient error | IMPORT_RECOGNITION_FAILED | cancellation wins if abort occurred first |
| T24 | PERSISTING_DRAFT | FAILED | transaction-failed | rollback/atomicity result known | map repository failure and verify no partial write | failure receipt | retry by same idempotency key | IMPORT_DRAFT_PERSIST_FAILED | abort and failure share rollback proof |
| T25 | FORMAL_ADMISSION | WAITING_CONFIRMATION | admission-rejected | policy returns valid rejection | attach field decisions for manual review | review warnings | teacher may edit and reconfirm | IMPORT_ADMISSION_REJECTED | no formal commit exists |
| T26 | FAILED | PREPARING | retry | error allowlisted; retry budget remains; no partial write | increment attempt and rebuild immutable context | new attempt envelope | bounded by retry budget | IMPORT_RETRY_EXHAUSTED | cancellation before restart yields CANCELLED |
| T27 | CANCELLED | IDLE | reset | cleanup/rollback receipt verified | clear active run reference | idle acknowledgment | new run allowed | IMPORT_RESET_UNSAFE | no action while cleanup incomplete |
| T28 | COMPLETED | IDLE | reset | terminal result recorded and no active transaction | release UI run reference only | idle acknowledgment | new run uses new runId | IMPORT_RESET_UNSAFE | completed data is never rolled back by reset |

## Invariants and ownership

- No hidden side effects are permitted in the state object or transition table.
- State updates are monotonic per transition sequence and use compare-and-swap on
  the active run version; two tabs cannot advance the same version.
- Progress may stay equal but never decreases. Terminal states cannot transition
  except through the explicit reset/retry rows above.
- Retry budget is fixed in the run envelope. Retry never changes source digest,
  settings, engine version, evidence, or idempotency identity silently.
- controlled-write continues to decide machine acceptance of PDF/AI fields.
- FormalAdmission continues to decide source-aware formal eligibility.
- Repository continues to own draft/formal transactions, rollback, idempotency,
  and post-write verification.
- PDF remains safe partial with manual review required. No transition upgrades
  rejected/missing ownership or synthesizes fields.
- Cancellation is an explicit transition with a receipt, not an exception hidden
  by a broad catch. COMMITTING is not cancellable once its transaction begins.
- Error metadata is allowlisted: runId, batchId, stage, duration, stable code,
  engine id/version, and counts; never private text, base64, key, or raw response.

## Implementation entry gate

C2-1 implementation must encode this table as data, reject all unspecified edges,
keep the state object side-effect-free, inject commands, and prove cancellation,
retry, progress, error mapping, and invalid transition behavior before any
production wiring.
