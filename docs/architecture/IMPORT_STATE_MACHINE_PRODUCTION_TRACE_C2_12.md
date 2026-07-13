# Import State Machine Production Trace — C2-12

## Baseline trace

Baseline commit: `f92f8e909aa53047755f71f5b9d9d45d3e849303`.

C2-11 made `ProductionImportBridge` the only normal-UI import coordinator. A
normal create/retry/rerun command creates one `ImportStateMachine` and records:

```text
IDLE
 -> PREPARING
 -> LOADING_SOURCE
 -> RECOGNIZING (vision/PDF routes)
 -> NORMALIZING
 -> STRUCTURING
 -> VALIDATING
 -> BUILDING_REVIEW
 -> PERSISTING_DRAFT
 -> WAITING_CONFIRMATION
```

The deterministic source edge skips RECOGNIZING and enters NORMALIZING only
when that explicit producer route is selected. The normal UI currently selects
truthful DOCX vision or PDF; deterministic DOCX remains non-applicable.

`tests/import-cutover-progress.test.js` and the 15-case production Chromium
canary prove monotonic state/progress events, verified persistence/readback,
terminal cancellation, fail-closed failures, and no legacy fallback. Unknown
events are rejected by the state-machine owner.

## Baseline gap to close

Formal teacher submission currently delegates to `BatchFormalSubmit`,
`FormalAdmissionPolicy`, and the repository, but it does not drive the existing
state-machine edges:

```text
WAITING_CONFIRMATION
 -> FORMAL_ADMISSION
 -> COMMITTING
 -> COMPLETED
```

This was not a second import owner and did not bypass Formal Admission, but the
lifecycle trace was incomplete at the C2-12 baseline. The corrective wave
injects the existing state-machine owner into `BatchFormalSubmit`; no parallel
state enum or UI-local transition implementation is introduced.

## Required final invariants

- `qisi-import-state-machine.js` is the only lifecycle-transition owner.
- Bridge production owns IDLE through WAITING_CONFIRMATION.
- Explicit teacher confirmation resumes the formal lifecycle semantics through
  FORMAL_ADMISSION, COMMITTING, and COMPLETED.
- Admission rejection returns to WAITING_CONFIRMATION with no formal write.
- Repository failure produces FAILED and never reports COMPLETED.
- Cancellation is terminal before the persistence point of no return.
- Retry uses a new execution identity or the existing strict idempotency key;
  it never silently reuses mutable state.
- Import completion (`WAITING_CONFIRMATION`) is not formal completion
  (`COMPLETED`).
- UI state is a projection of owner snapshots and repository readback, not a
  second state machine.

## Final production formal trace

`BatchFormalSubmit.createBatchFormalSubmit` now requires the existing
`createImportStateMachine` port and resumes only from the explicit
`WAITING_CONFIRMATION` boundary. The state-machine factory permits only `IDLE`
and `WAITING_CONFIRMATION` initial states; arbitrary state injection fails with
`IMPORT_INITIAL_STATE_INVALID`.

Accepted teacher submission executes:

```text
WAITING_CONFIRMATION
 -> teacher-confirm -> FORMAL_ADMISSION
      FormalAdmissionPolicy.evaluateDraftAdmission
 -> admitted -> COMMITTING
      StorageRepository.confirmDraftToQuestion transaction
 -> repository-committed -> COMPLETED
```

Rejected admission executes `FORMAL_ADMISSION -> admission-rejected ->
WAITING_CONFIRMATION` and writes no formal question. A repository failure while
COMMITTING becomes terminal `FAILED`; the sanitized state snapshot contains no
repository details and never reports COMPLETED.

The normal browser production submit still enters through
`AppProxy.submitDraftQuestion`, preserves explicit teacher confirmation, and
delegates admission and the formal transaction to their existing owners.
Targeted state/admission tests passed 22/22. The real browser formal-submit and
true-import admission suite passed 5/5, including admitted Question v2,
raw-JSON rejection, wrong-attachment rejection, and field-specific manual
provenance after an actual teacher rewrite.
