# App Shell Target Modules R3

All modules are domain owners below the UI/controller layer: no DOM, no Vue, and
no direct external call except through an injected adapter or Repository. They may
compose existing controlled-write and FormalAdmission decisions but never copy
them. Route B remains research-only.

## qisi-batch-context-service.js
- Single owner: immutable batch/file/source/settings/engine context snapshots.
- Public API: `createBatchContext(command, readers)`; `validateContext(context)`.
- Allowed dependencies: source metadata readers and pure contract validators.
- Forbidden: no DOM; no Vue; no direct external call; no DB write or role guessing.
- Production-linked tests: missing/stale batch/file, duplicate/unsupported file, app coordinator injection.

## qisi-source-role-classifier.js
- Single owner: deterministic role classification from declared evidence.
- Public API: `classifySourceRoles(manifest)`.
- Allowed dependencies: file-type and manifest contract owners.
- Forbidden: no DOM; no Vue; no direct external call; no content/keyword inference.
- Production-linked tests: DOCX/PDF question/answer, ambiguous/duplicate/missing roles, app callsite.

## qisi-docx-import-coordinator.js
- Single owner: deterministic DOCX pipeline orchestration and progress.
- Public API: `runDocxImport(context, commands, signal)`.
- Allowed dependencies: DOCX pipeline, contracts, diagnostics, state machine command port.
- Forbidden: no DOM; no Vue; no direct external call; no PDF/OCR/FormalAdmission/Repository write.
- Production-linked tests: true DOCX UI-entry E2E, ordering, cancellation, stable regression.

## qisi-pdf-import-coordinator.js
- Single owner: PDF intake/page/OCR-adapter orchestration into safe-partial candidates.
- Public API: `runPdfImport(context, adapters, signal)`.
- Allowed dependencies: PDF renderer, OCR adapter registry, existing parser/aligner/controlled-write ports.
- Forbidden: no DOM; no Vue; no direct external call outside adapter; no ownership policy or Route B.
- Production-linked tests: known-bad, safe partial, cancellation, adapter unavailable, browser dry-run.

## qisi-candidate-normalizer.js
- Single owner: wrapper cleanup, normalization orchestration, contract conversion.
- Public API: `normalizeCandidates(candidates, productionHelpers)`.
- Allowed dependencies: canonical contracts and injected existing repair helpers.
- Forbidden: no DOM; no Vue; no direct external call; no repair-owner copy, ownership, or write.
- Production-linked tests: real production helper delegation, raw JSON, formula, immutable evidence.

## qisi-import-validation-service.js
- Single owner: composition of existing schema, sequence, ownership, safe-partial, and evidence validators.
- Public API: `validateImportDrafts(drafts, validatorPorts)` returning `ValidatedQuestionDraft[]`.
- Allowed dependencies: contracts, controlled-write decision port, existing validators.
- Forbidden: no DOM; no Vue; no direct external call; no validator reimplementation or FormalAdmission.
- Production-linked tests: DOCX full, PDF prefix/fail-closed, wrong attachment, rejected evidence.

## qisi-review-draft-builder.js
- Single owner: validated-draft to review-draft projection.
- Public API: `buildReviewDrafts(validatedDrafts)`.
- Allowed dependencies: review contracts and pure provenance helpers.
- Forbidden: no DOM; no Vue; no direct external call; no fabricated/washed field or formal write.
- Production-linked tests: missing/rejected fields, warnings, provenance, manual-review flag, immutability.

## qisi-draft-persistence-service.js
- Single owner: review-draft transaction lifecycle, idempotency, reload, delete, cleanup.
- Public API: `persistDraftBatch(command, repository)`; `reloadDraftBatch`; `deleteDraftBatch`.
- Allowed dependencies: injected Repository draft APIs and contracts only.
- Forbidden: no DOM; no Vue; no direct external call; no formal question write or policy decision.
- Production-linked tests: rollback, conflict, duplicate key, reload/delete-refresh, two-tab versioning.

## qisi-import-diagnostics.js
- Single owner: allowlisted import lifecycle diagnostics.
- Public API: `createImportDiagnostics(options)` with `start/record/fail/snapshot`.
- Allowed dependencies: monotonic clock and secure logger port.
- Forbidden: no DOM; no Vue; no direct external call; no private text/base64/key/raw response.
- Production-linked tests: metadata allowlist, caps, error mapping, cancellation, privacy attacks.

## qisi-import-state-machine.js
- Single owner: transition validation, progress, retry/cancel/error state.
- Public API: `createImportStateMachine({ commands, clock, retryPolicy })`.
- Allowed dependencies: pure contracts and injected command ports for the nine modules above.
- Forbidden: no DOM; no Vue; no direct external call; no hidden side effect, controlled-write, FormalAdmission, or Repository implementation.
- Production-linked tests: all designed transitions, invalid edge, AbortSignal, retry budget, true E2E orchestration.

## Dependency direction and production gate

`UI → controller → state machine → coordinators/services → existing policy →
Repository/adapter` is the only allowed direction. Every implemented module must
enter `architecture/layers.json`, load before app only when production-wired, and
have an app/controller callsite plus behavior test before the old owner is removed.
Scaffold, loaded, unit-tested, production-wired, and measured remain distinct.
