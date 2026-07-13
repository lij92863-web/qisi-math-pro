# Program C Code Quality Audit R3

## Scope and result

This audit reviews the C2-13 production baseline
`6b1dcc81d22b0d31a0d3cd3c621b26c6bffae34b` and the Phase 6 architecture
gates. It covers `app.js`, `ProductionImportBridge`, `ImportStateMachine`,
DOCX/PDF coordinators and source ports, the batch engine, validation,
ReviewDraft builder/persistence, Formal Admission, repository, PDF projection,
and the architecture/runtime gates.

Result: no blocking code-quality defect or ownership regression was found.
No function was split solely to improve a static number.

## Static size inventory

| Owner | Lines | Detected top-level functions | Audit interpretation |
| --- | ---: | ---: | --- |
| `app.js` | 5,247 inventory lines | 172 | UI shell/composition plus unrelated G features; no Program C algorithm owner |
| `ProductionImportBridge` | 891 | 22 | one workflow owner; nested command table is the main complexity hotspot |
| `ImportStateMachine` | 167 | 7 | bounded state/transition owner |
| DOCX coordinator | 133 | 5 | bounded route coordinator |
| deterministic DOCX source port | 141 | 4 | bounded producer port |
| DOCX vision source port | 839 | 9 | question/support producer boundary; no UI/DB |
| PDF coordinator | 130 | 6 | bounded route coordinator |
| PDF production source port | 226 | 4 | bounded source/projection adapter |
| batch engine | 2,046 | 58 | existing single-domain engine; large but not a new mixed owner |
| import validation | 359 | 8 | pure validation composition |
| ReviewDraft builder | 78 | 1 | pure immutable builder |
| Draft Persistence | 638 | 14 | command, transaction delegation, and readback checks |
| Formal Admission | 583 | 9 | admission/provenance policy |
| Question Repository | 852 | 29 | unique transaction owner |
| PDF candidate projection | 1,330 | 37 | frozen single-domain projection/ownership owner |

The largest `app.js` function is the unrelated exam drag handler
`startExamPointerDrag` at 164 lines. The largest Program C UI function is
`saveManualCropToDraft` at 116 lines; `submitDraftQuestion` is 97 lines. No
shell function exceeds 250 lines. The shell has no import algorithm, PDF
controlled-write implementation, OCR adapter execution, or formal transaction.

The batch engine and PDF projection exceed 1,000 lines, but both predate Phase
6 and have one domain responsibility. Splitting either during closure would
increase regression risk in the DOCX stable/PDF frozen chains without changing
ownership. They remain explicit future maintainability hotspots, not hidden
mixed owners.

## Complexity, parameters, and mutable state

- Bridge complexity is concentrated in one per-run immutable/ephemeral data
  record and an explicit state-machine command map. It does not use module-
  global mutable import state.
- The State Machine owns its transition state inside each factory instance.
  Retry count, active token, and abort controller are instance-local.
- Source ports use dependency bags rather than expanding positional parameter
  lists. Required production functions are asserted before execution.
- PDF projection uses small pure helpers around a single projection contract.
  Its size is high, but identity, provenance, controlled-write, and comparison
  remain cohesive.
- Repository state is the database transaction, not a hidden in-memory cache.
  ReviewDraft services pass explicit version/idempotency commands.
- `app.js` Vue refs are visible UI state. They do not form a second import
  state machine or persistence truth source.

No implicit global was found in the audited production owners. Browser modules
register under the explicit `Qisi` namespace; C2-13 validates every production
namespace and load order before `app.js`.

## Branching, callbacks, and error behavior

- DOCX/PDF branch selection occurs once in the Bridge from classified source
  roles and explicit producer mode. Coordinators do not reselect UI routes.
- Bridge callbacks correspond to named state transitions. There is no callback
  chain that can bypass validation or persistence readback.
- Production factories reject missing dependencies with stable codes. Phase 6
  counterfactual tests reject missing/throwing validators, projection,
  controlled-write, persistence/repository, Formal Admission, state machine,
  classifier, and source ports.
- C2-13 added `BATCH_FORMAL_SUBMIT_DEPENDENCY_REQUIRED` to the remaining
  message-only formal-submit dependency errors.
- Domain-local error constructors are not duplicate business mappers. Bridge
  `safeCode` only sanitizes external error codes before diagnostics/UI mapping.

The audited catch-and-ignore sites are narrow and intentional:

1. a cancellation request may arrive in a state with no cancel edge;
2. diagnostics failure cannot replace the primary import failure;
3. status-report failure cannot replace the primary stable failure;
4. optional conservative parsing/normalization attempts may fail and leave a
   field rejected/missing.

No ignored exception turns a failed dependency, validation, transaction, or
Formal Admission decision into success.

## Defaults and boolean state

There is no permissive `valid: true`, identity projection, empty accepted
result, or legacy catch fallback for a missing production dependency.

The remaining booleans are contract state, not unstructured boolean soup:

- `manualReviewRequired`, `ownershipValid`, and controlled-write acceptance
  are persisted evidence fields;
- `persistenceActive` prevents cancellation from interrupting an atomic
  transaction;
- `shadow` and `production` are explicit execution modes;
- safe-partial is never equivalent to complete/admitted.

## Identity, transaction boundary, retry, and cancellation

- source IDs, batch IDs, source order, producer route, decision ID, request ID,
  version, and idempotency key are explicitly validated.
- ReviewDraft transactions are owned by `StorageRepository` and invoked only by
  `DraftPersistenceService`/Bridge commands.
- Formal question transactions are owned by
  `StorageRepository.confirmDraftToQuestion` and invoked through
  `BatchFormalSubmit` after Formal Admission.
- duplicate request IDs replay idempotently or conflict; they do not create a
  second draft/formal row.
- cancellation is checked before source work, between state transitions, and
  before persistence. Once an atomic persistence transaction is active, it is
  allowed to complete rather than creating a partial write.
- readback matching closes response-loss and stale-view ambiguity.

## Security and diagnostics

- Import diagnostics use the secure logger/sanitized codes and counts.
- No production owner logs API keys, local private paths, raw uploaded bytes,
  or formal question content as a failure diagnostic.
- the Phase 6 browser harness blocks `/api/ai/**` and unapproved external
  requests; all benchmark/test evidence has `realApiCalled = false`.
- repository/UI rendering boundaries remain escaped and KaTeX stays
  `trust: false` in the existing security suite.

## Production/test divergence and dead exports

- fixture import is reachable only through the explicit Bridge fixture helper
  and an injected test transport. Normal UI selects `mode: production`.
- Route B is a research test artifact and has no production script.
- shadow OCR/DOCX execution has zero write authority and is rejected if it
  reports a write.
- deprecated coordinator/injected/comparator modules have historical test
  callers but no production caller.
- pure prompt/document-source exports are internally used and remain supported
  source-port APIs, not hidden production alternatives.
- `summarizeDraftStatus` remains a Base Migration historical test API and is
  not represented as a production responsibility in the detailed owner graph.

No stale comment or V2 name was found to re-enable the removed owner.
`QisiBatchEngineV2` and image-token helpers ending in `ForV2` are live schema
and engine contracts; `processDraftImportBatchV2` is absent.

## Architecture gate quality

The architecture gate combines:

- detailed owner/layer schema and responsibility uniqueness;
- compatibility-manifest dependency direction and cycle detection;
- actual `main.html` script reachability/order;
- namespace/runtime startup analysis;
- static forbidden-edge scans;
- missing-dependency execution attacks;
- real normal-UI browser traces.

It therefore does not reduce architecture verification to file existence or a
manually maintained string list. Missing files, late owners, duplicate owners,
undefined namespaces, deprecated/test-only runtime entries, and cross-layer
implementation edges are independently rejected.

## Conclusion

The main maintainability risks are the existing batch engine, PDF projection,
and Bridge command table sizes. They are single owners with strong behavior
gates, not duplicated or mixed responsibilities. No Phase 6 refactor is
justified solely by those static sizes. The production graph is suitable for
engineering closure.
