# Import Coordinator Production Boundary R1

## Decision

The active batch-import owner remains the large `processDraftImportBatch`
workflow in `app.js`. It performs source loading, recognition, merge/repair,
review-draft construction, and Dexie persistence. It also catches execution
errors and persists the batch `failed` state itself.

This workflow is therefore classified as a legacy business-and-persistence
boundary, not as a candidate-validation boundary.

## Production naming

The UI runner now enters this workflow through `LegacyBatchRunCoordinator`.
That coordinator owns only:

- a single-run lock per batch ID;
- invocation of the existing legacy workflow;
- reading the persisted terminal batch state;
- rejecting missing, failed, or incomplete terminal state with stable codes.

Its result explicitly reports:

```text
owner = LegacyBatchRunCoordinator
boundary = legacy-business-and-persistence
validationBoundary = false
```

The previous production `ImportOrchestrator` wiring used an unconditional
`valid:true` callback after the legacy workflow had already persisted its
results. That wiring has been removed. `qisi-import-orchestrator.js` remains a
generic fail-closed module with unit coverage, but it is not the active batch
production boundary.

## Deferred debt

This package does not claim extraction of `loadBatchContext`,
`classifySourceRoles`, `produceBatchCandidates`, `validateBatchCandidates`,
`buildReviewDrafts`, or `persistReviewDrafts`. Those steps are still entangled
inside the legacy owner and require characterization plus shadow comparison
before ownership can move safely.

No report may describe the current legacy workflow as a production validation
boundary until candidate validation occurs before persistence and is covered by
production-linked tests.
