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

This is not a second import owner and does not bypass Formal Admission, but the
lifecycle trace is incomplete for C2-12. The gap must be closed by injecting the
existing state-machine owner into `BatchFormalSubmit`; no parallel state enum or
UI-local transition implementation is permitted.

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

The final section of this document will be updated with production call traces
and test counts after the formal lifecycle is wired and browser-verified.
