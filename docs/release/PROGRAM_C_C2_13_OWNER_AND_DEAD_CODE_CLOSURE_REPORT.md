# Program C C2-13 Owner and Dead Code Closure Report

## Decision

`C2_13_OWNER_AND_DEAD_CODE_CLOSURE_ACCEPTED`

C2-13 closes the production ownership graph with machine-readable owners and
layers, a runtime-linked architecture gate, a fail-closed dependency gate, and
a production call-graph audit. No real AI/OCR endpoint or production data was
used.

## Machine-readable architecture

The authoritative detailed manifests are:

- `docs/architecture/owners.json` (`qisi.program-c-owners.r3`);
- `docs/architecture/layers.json` (`qisi.program-c-layers.r3`).

They contain 68 owners across five layers. Every owner records `ownerId`,
`module`, `layer`, `responsibilities`, `allowedCallers`,
`allowedDependencies`, `forbiddenDependencies`, `productionEntry`,
`writeAuthority`, and `status`. The status vocabulary is limited to
`production`, `shadow`, `research-only`, `deprecated`, and `removed`.

The existing `architecture/layers.json` and `architecture/owners.json` remain
as compatibility projections for earlier gates. C2-13 expanded them for the
C2-12 owner modules, corrected the non-production status of the old
coordinator/injected/comparator artifacts, and cross-checks their production
claims against the detailed manifests and the real page runtime.

Results:

- duplicate production responsibility: 0;
- owner IDs missing from a layer: 0;
- upward allowed dependency: 0;
- allowed/forbidden dependency overlap: 0;
- production manifest entry absent from runtime: 0;
- deprecated/research/test entry present in runtime: 0.

## Owner boundary correction

The C2-12 shell no longer performed AI transport, but it still created the
Qwen adapter/task client and invoked two task-client operations as source-port
callbacks. C2-13 moved that execution boundary into
`QwenVisionSourcePort.createProductionOcrRuntime`.

After the change:

- `app.js` contains no `Qisi.OcrQwenAdapter` reference;
- `app.js` contains no `qwenTaskClient.ocrText/chatText/chatJson` execution;
- `QwenVisionSourcePort` validates the adapter, mode, and document-source
  dependencies and owns production task-client construction;
- existing visual question/support owners continue receiving only the bounded
  task-client port they already require;
- transport/model/request ownership remains in the adapter/source-port layers.

Formal-submit dependency errors now carry the stable code
`BATCH_FORMAL_SUBMIT_DEPENDENCY_REQUIRED`, so missing Formal Admission,
repository, and state-machine dependencies are machine-testable and fail
closed.

## Architecture gate coverage

`tests/c2-13-owner-runtime-closure.test.js` verifies behavior and reachability,
not only file presence:

1. all required owners, fields, layers, status values, responsibility
   uniqueness, and dependency direction;
2. detailed owner, compatibility manifest, actual script load, and critical
   load-order agreement;
3. UI-to-adapter/parser/controlled-write/formal-DB, Bridge-to-formal-DB,
   coordinator-to-UI, repository-to-UI, and validator-to-persistence edges;
4. deprecated, Route B, test-only, legacy fallback, old comparator, and removed
   V2 reachability;
5. missing validator, projection/controlled-write, persistence/repository,
   Formal Admission, state machine, classifier/source, DOCX vision, PDF source,
   and Bridge dependencies.

The focused architecture and boundary set passes 65/65, including runtime
namespace/load validation and Qwen source/adapter tests.

## Dead-code and reachability audit

The audit used the real `main.html` scripts, App setup exports/template
bindings, production namespace references, compatibility/detailed manifests,
`git grep`, focused unit tests, and browser call traces.

| Audit class | Evidence and disposition |
| --- | --- |
| old import helpers | `processDraftImportBatch` and its V2 form are absent; no legacy fallback selector/caller remains |
| old owners | legacy coordinator, injected path, and old orchestrator retained only for historical/counterfactual tests; marked `deprecated`, not production-loaded |
| old comparator | `ImportEquivalenceNormalizer` exists only as a deprecated test artifact; no production reference |
| stale flags/selectors | Bridge `production/shadow` is an explicit contract; DOCX shadow is non-writing; no legacy migration selector exists |
| fallback routers | no legacy catch/fallback route in shell, controller, Bridge, or production page |
| Route B | research contract test only; prohibited production implementation absent |
| old V2 | removed owner symbols are absent; `QisiBatchEngineV2` and image-token `ForV2` names are live production data/engine contracts, not the removed import owner |
| unused exports | C2-12 owner factories are production-called; pure prompt/document-source APIs are internally used and intentionally public for alternate source ports; `summarizeDraftStatus` remains a historical base-migration test API and is not claimed as a production responsibility |
| duplicate error mapper | typed errors remain local to their domain; Bridge `safeCode` only sanitizes external error codes and is not a second business error mapper |
| dead template/CSS | audited Program C batch commands are returned by App setup and exercised by the normal-UI browser suite; no Program C orphan binding was found |
| orphan scripts | server-only `qisi-local-server.js`/`qisi-temp-job-manager.js` are startup dependencies; benchmark/audit scripts are explicit tooling; OCR scaffold and base-migration facade files are test-only and not production-loaded |
| test-only production export | production page contains no `tests/` path; fixture imports are reachable only through the Bridge fixture helper under explicit injected test transport |

No file was deleted merely because it lacked a browser script tag. Historical
test artifacts, server-only modules, and research/scaffold modules have live
non-production callers, so they were classified and made unreachable rather
than deleted without proof.

## Production call graph

`docs/architecture/PROGRAM_C_PRODUCTION_CALL_GRAPH_AUDIT_R3.md` traces:

- normal DOCX and DOCX+DOCX stable;
- DOCX vision question/support;
- PDF full and safe-partial;
- known-bad rejection;
- ReviewDraft persistence/reload/manual edit;
- teacher confirmation, Formal Admission, and repository commit.

The Bridge has zero formal writes. `app.js` has zero formal DB writes. The only
formal graph is `BatchFormalSubmit -> FormalAdmissionPolicy ->
StorageRepository.confirmDraftToQuestion`.

## Verification summary

- focused C2-13/architecture tests: 9/9;
- focused shell/architecture/normal-UI/Qwen/runtime set: 65/65;
- full safe suite: 1,627/1,627 across 54 suites;
- complete browser E2E group: 17/17, including all 15 normal UI scenarios;
- mandatory Program C gates: 11/11 passed in the prescribed order;
- failed, cancelled, skipped, todo, and timeout: 0;
- `wrongAttachment`, raw JSON, placeholder, controlled-write bypass, legacy
  fallback, Bridge formal write, and app formal DB write counters: 0;
- `realApiCalled = false`.

All six frozen PDF files remain outside the diff. No force/reset/pull/rebase,
real-run, real AI/OCR call, direct IndexedDB mutation, or production-data
operation was performed.

## Remaining non-production artifacts

The repository still contains explicitly classified test/scaffold/research
artifacts for earlier Base Migration and OCR experiments. They have no normal
UI production caller or write authority. Removing them would delete active
historical/counterfactual tests and is not required for the Program C
production graph closure.
