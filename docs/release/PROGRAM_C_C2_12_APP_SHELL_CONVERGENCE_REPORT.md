# Program C C2-12 App Shell Convergence Report

## Decision

`C2_12_APP_SHELL_CONVERGENCE_ACCEPTED`

Wave 18 completed the mandatory final C2-12 reachability and responsibility
audit. `app.js` is now a UI shell and dependency-composition root for Program C.
It no longer owns an import algorithm, acceptance/ownership policy, draft or
formal transaction, OCR transport, or audited dead production closure.

## Final owner boundary

```text
normal UI command
  -> NormalUiImportController
  -> ProductionImportBridge
  -> DOCX/PDF source owners
  -> CandidateNormalizer
  -> ImportValidationService
  -> ReviewDraftBuilder
  -> DraftPersistenceService / StorageRepository

teacher confirmation
  -> BatchFormalSubmit
  -> FormalAdmissionPolicy
  -> StorageRepository formal transaction
```

The shell constructs explicit ports and maps successful readback into Vue
state. It does not contain a fallback path. Bridge stops at review persistence
and performs zero formal writes.

## A–G responsibility result

| Class | Final result |
| --- | --- |
| A — UI shell | retained: batch-create/review/crop/confirm commands, visible state, readback mapping, dependency injection |
| B — import orchestration | `0` implementations |
| C — validation/ownership/policy | `0` implementations; thin named-owner delegation only |
| D — persistence/repository | `0` transaction or business implementations |
| E — diagnostics | retained only for local conversion, cost/progress, and visible diagnostics |
| F — dead/unreachable | `0` for the audited Program C domain |
| G — unrelated feature | retained: library, external bank, manual entry, exam/print, templates, knowledge management |

The final shell ranges and evidence are recorded in
`docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_C2_12.md`. Three direct
Dexie transactions remain in G-class external-package staging/maintenance.
They touch only `importBatches`, `externalQuestions`, and `images`; none touches
formal or ReviewDraft tables.

## Reachability and owner changes

The active implementations removed from `app.js` are now separated by
responsibility:

- browser document extraction and PDF rendering;
- visual question and support sources;
- strict question, recognition-structure, and question-content policy;
- support text and support LaTeX parsing/normalization;
- page-question parsing, question-image policy, and solution-quality policy;
- ReviewDraft normalization and image-token/LaTeX placement behavior.

Each factory requires its production ports and fails closed when a dependency
is missing. The corresponding app-local definitions were deleted. The large
unreachable legacy explicit-question merge/self-test closure and every audited
single-reference Program C helper were deleted rather than copied or retained
as a fallback. Unrelated G features were not removed to reduce the line count.

## Final metrics

| Metric | Result |
| --- | ---: |
| `app.js` total lines | 5,253 |
| detected function count | 172 |
| largest function | 164 — `startExamPointerDrag` (G) |
| largest Program C function | 116 — `saveManualCropToDraft` (A) |
| direct OCR/AI transport requests | 0 |
| explicit task-client source-port adapter callbacks | 3 |
| frozen PDF parser/aligner/controlled-write references | 0 |
| controlled-write implementations | 0 |
| PDF ownership/projection implementations | 0 |
| import-validation implementations | 0 |
| PDF projection owner delegations | 1 |
| import-validation owner delegations | 1 |
| ReviewDraft-builder delegations | 1 |
| draft-persistence command/readback delegations | 21 |
| draft transaction business logic | 0 |
| formal DB writes | 0 |
| legacy fallback | 0 |
| duplicate production owner | 0 |

`processDraftImportBatch` and `processDraftImportBatchV2` are absent. The normal
UI production owner is `ProductionImportBridge`. The 21 draft-persistence
calls are explicit UI/Bridge command and readback delegations; persistence
policy and transactions remain in the service/repository owners.

## Browser evidence

The production browser canary passed all 15 required normal-UI scenarios:

1. DOCX vision;
2. DOCX + DOCX stable main chain;
3. PDF full;
4. PDF safe-partial;
5. PDF known-bad fail-closed;
6. conflicting controlled-write decisions;
7. ambiguous support;
8. raw JSON rejection;
9. formula fallback;
10. cancellation;
11. persistence failure;
12. duplicate click;
13. ReviewDraft reload;
14. UI error recovery;
15. Bridge formal-write isolation.

The true-browser set also passed DOCX producer identity, PDF projection shadow
equivalence, true DOCX admitted-v2/reload/export, true PDF safe-partial,
field-specific teacher rewrite provenance, untouched confirmation provenance,
seeded review lifecycle/formal insertion, and command-failure UI recovery.

All browser evidence reported:

```text
wrongAttachment = 0
rawJsonLeakage = 0
placeholderLeakage = 0
controlledWriteBypass = 0
legacyFallbackCalls = 0
Bridge formal writes = 0
realApiCalled = false
consoleError = 0
```

## Verification

- focused C2-12 shell/owner, runtime-startup, and formal-submit set: 30/30;
- migrated static ownership and behavior fixtures: 334/334;
- full `node --test`: passed;
- `verify:safe`: 1,622/1,622 across 54 suites;
- Base Migration execution gate: 15/15;
- Route B hold: 6/6;
- batch mock: 20/20;
- batch safety: passed;
- PDF known-bad: 65/65;
- controlled-write answer ownership: 21/21;
- DOCX stable: 20/20;
- browser preflight: passed;
- browser dry-run: passed;
- `verify:no-real-ai`: passed;
- failed, cancelled, skipped, todo, and timeout: 0.

No real AI/OCR endpoint, `real-run`, production-data mutation, prompt/model
policy change, force, reset, pull, or rebase was used. All six frozen PDF files
remain outside the diff.
