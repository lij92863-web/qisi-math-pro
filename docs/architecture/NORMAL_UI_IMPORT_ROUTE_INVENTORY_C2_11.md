# Normal UI Import Route Inventory — C2-11

## Audit baseline

- Branch: `stage/app-shell-slimming-r3`
- Baseline commit: `c77523c590b424a9c7f011ae2c0881ca8188f69a`
- Normal UI entry: the Vue application returned by `app.js`
- User-visible production owner at baseline: `processDraftImportBatch`, invoked
  through `LegacyBatchRunCoordinator`
- Bridge status at baseline: browser-loaded and production-capable at module
  level, but not constructed or called by `app.js`

This inventory is based on the actual template events, application call graph,
runtime dependency registry, Phase 5 browser traces, and production-linked
tests. A function name by itself is not treated as reachability evidence.

## Reachable UI commands

| routeId | UI event | entry function | Reachability evidence | Baseline owner | C2-11 migration decision |
| --- | --- | --- | --- | --- | --- |
| `batch-create-auto-run` | “创建识别任务” | `createDraftImportBatch` → timer → `runBatchRecognition` | `main.html` create button and `app.js` timer | legacy coordinator → `processDraftImportBatch` | switch to the production Bridge controller |
| `batch-list-retry` | failed-task “重新识别” | `runBatchRecognition(batch.id)` | `main.html` failed task button | legacy coordinator → `processDraftImportBatch` | switch to the same production Bridge controller; no fallback |
| `batch-review-rerun` | review “重新识别” | `rerunActiveBatchRecognition` → `runBatchRecognition` | `main.html` review button | legacy coordinator → `processDraftImportBatch` | switch to the same production Bridge controller; preserve review navigation |
| `app-proxy-run` | browser/programmatic normal application command | `AppProxy.runBatchRecognition` | Phase 5 Chromium tests call the real Vue proxy | legacy coordinator → legacy or injected path | retain as the production-linked test entry, but route only through Bridge |
| `legacy-direct-call` | no template event | `AppProxy.processDraftImportBatch` | exported by the Vue proxy but not referenced by `main.html` | giant legacy owner | remove from the public proxy and delete or reduce the function to a non-domain compatibility wrapper |

There is no separate quick-import, resume-import, historical compatibility, or
hidden production feature flag in the template. Reload resumes persisted review state through
`loadBatchImportData`; it does not resume an interrupted recognition command.
`InjectedImportTransport` is reachable only through the legacy coordinator and
the browser harness. It is a test transport, not a separate production owner;
C2-11 must move deterministic test fixtures behind Bridge ports and remove the
legacy dispatch branch.

## Source and safety routes

Required scenario labels covered below: PDF full; PDF safe-partial; PDF known-bad; PDF conflict; PDF ambiguity; raw JSON; formula fallback; cancellation; retry; duplicate submission; unsupported file type; mixed source.

| routeId | Source/roles | Producer at baseline | Phase 5 evidence | Progress/cancel/error | Persistence/formal write | Bridge status at baseline | Migration decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docx-vision-question` | DOCX `question` or `full` | DOCX rendered to PDF, then vision AI | same-producer normal-UI/Bridge shadow equivalence | legacy progress patches; no UI cancellation token; catch writes failed status | legacy writes ReviewDraft; formal writes 0 | shadow source port only | add explicit Bridge production vision route using the existing producer identity contract and real controlled-write evidence |
| `docx-vision-question-support` | DOCX question + DOCX answer (or solution) | rendered-PDF vision plus support alignment | Phase 5 proves producer identity, not a full production cutover | legacy progress and error mapping; cancellation incomplete | legacy ReviewDraft transaction; formal writes 0 | no complete production route | production Bridge must preserve role order and producer-time provenance; missing controlled-write fails closed |
| `docx-deterministic` | DOCX parsed by XML importer | no reachable normal-UI production route at baseline | explicitly N/A in Phase 5; isolated deterministic source port is covered | coordinator cancellation/progress tested | isolated port has no write authority | module support exists | remain N/A for the normal UI; it may be used only when an explicit production route is later introduced and equivalence is supplied |
| `pdf-full` | PDF question/full, optionally PDF support | vision/text engine → parser/aligner → controlled-write → shared projection | Phase 5 browser and node equivalence | legacy progress; catch failure; no complete external cancellation | ReviewDraft transaction; formal writes 0 | production module path exists | route through Bridge PDF coordinator and unique projection owner |
| `pdf-safe-partial` | PDF question + partial support | same PDF chain with prefix/safe-partial result | Phase 5 accepted | same as PDF full | ReviewDraft only | supported by Bridge | preserve the exact accepted prefix; never widen |
| `pdf-known-bad` | ownership mismatch/gap/rewind | fail-closed parser/aligner/controlled-write | Phase 5 and mandatory known-bad gates | failure is diagnostic | no accepted ReviewDraft/formal write | supported as rejection | both production entry and Bridge fail closed |
| `pdf-conflict` | conflicting controlled-write decisions | controlled-write conflict | Phase 5 counterfactual | stable failure required | zero writes | supported as rejection | fail closed; no legacy retry |
| `pdf-ambiguity` | multiple support sources/ambiguous roles | source classifier/controlled-write ambiguity | Phase 5 counterfactual | stable failure required | zero writes | supported as rejection | fail closed; no content inference |
| `raw-json` | raw transport JSON candidate | producer boundary rejects | Phase 5 counterfactual | stable malformed-result failure | zero writes | supported as rejection | fail closed before normalization/persistence |
| `formula-fallback` | valid candidate with formula fallback | producer plus manual-review projection | Phase 5 counterfactual | normal progress | ReviewDraft only | supported | keep `manualReviewRequired=true`; no placeholder leakage |
| `image-question` | JPG/PNG/WEBP marked as question | legacy vision branch | no Phase 5 equivalence or legal producer-time canonical contract | legacy only | legacy ReviewDraft possible | unsupported | remove from batch-import picker/role assignment for C2-11; image upload remains available in the separate OCR/manual UI |
| `text-full` | TXT or paste-text shortcut | legacy text recognition | no Phase 5 equivalence or legal producer-time canonical contract | legacy only | legacy ReviewDraft possible | unsupported | remove from the production batch-import route; it is not allowed to bypass the canonical producer contract |
| `supplemental-image` | image with `supplemental_image` role plus a supported primary source | evidence-only attachment | indirect legacy coverage | follows primary route | no independent draft/formal write | selected as supplemental context | retain only as evidence for a supported DOCX/PDF primary route |
| `mixed-docx-pdf` | mixed source: active DOCX and PDF primary sources | legacy mixed orchestration | no same-producer Phase 5 equivalence | legacy only | legacy may write | Bridge explicitly rejects | keep reachable only as an explicit stable unsupported-route error; no partial processing |
| `unsupported-extension` | unsupported file type: `.doc`, archive, executable, unknown | none | UI upload guard | rejected before task creation | zero writes | not invoked | retain upload rejection |

## State and lifecycle routes

| routeId | Baseline behavior | Required C2-11 behavior |
| --- | --- | --- |
| `cancel-before-source` | no normal UI cancellation token | explicit abort signal; no processing or writes |
| `cancel-during-recognition` | internal helpers may observe abort but normal entry owns none | state-machine cancellation, late result discarded, zero writes |
| `cancel-before-validation` | not externally reachable | abort checked before validator |
| `cancel-before-persistence` | not externally reachable | abort checked before transaction |
| `cancel-during-persistence` | repository transaction owns rollback | atomic rollback/readback failure, no partial draft |
| `retry-after-failure` | failed button invokes legacy again | new Bridge production request; no legacy fallback |
| `duplicate-click` | legacy coordinator in-memory lock | duplicate submission shares the production controller lock plus persistence idempotency |
| `lost-response-retry` | not proven | stable request identity and readback-based idempotent success |
| `reload-review` | `loadBatchImportData` reloads persisted drafts | Bridge success only after transaction and readback; reload matches returned view model |

## DOCX deterministic N/A recheck

The baseline normal UI has no deterministic DOCX production dispatch. All
three visible UI commands reach `runBatchRecognition`, whose baseline
coordinator calls `processDraftImportBatch`; the accepted Phase 5 Chromium
trace records `source.format=docx`, `producer.mode=vision-ai`, and route
`docx-rendered-to-pdf-vision`. The XML importer is reachable through the unused
`processDraftImportBatchV2` precursor and isolated source-port tests, not from a
normal UI event. Therefore deterministic DOCX remains truthfully N/A for the
baseline cutover and must not be compared with the vision route.

## Inventory gate

C2-11 may proceed only after the production controller makes every retained
normal UI command call `ProductionImportBridge` in explicit production mode,
the DOCX vision and PDF routes use their truthful producers, unsupported and
mixed routes fail before persistence, and the direct legacy proxy entry is
removed. Browser evidence, not this inventory alone, must prove the final
runtime call counts.

## Final cutover disposition

The inventory was rechecked after the entry switch against the template,
runtime dependency registry, application proxy, production controller, and the
15-case Chromium canary. The retained UI events now have this single reachable
command graph:

```text
create/retry/rerun button
  -> runBatchRecognition
  -> NormalUiImportController.run
  -> ProductionImportBridge.run(mode=production)
  -> truthful DOCX-vision or PDF producer
  -> normalize -> project -> validate -> build ReviewDraft
  -> DraftPersistenceService transaction -> repository readback
  -> applyReviewModel
```

`processDraftImportBatch` and its application-proxy export are absent. Neither
`qisi-legacy-batch-run-coordinator.js` nor
`qisi-injected-import-transport.js` is loaded by `main.html`. The deterministic
browser fixture is resolved only as an injected runtime dependency and still
executes through the same controller and Bridge production state sequence; it
does not create a second UI owner or a production source route.

| Route group | Current owner/producer | Progress and cancellation | Error and persistence | Production-linked proof | Final decision |
| --- | --- | --- | --- | --- | --- |
| create, retry, review rerun | `NormalUiImportController` -> `ProductionImportBridge` | monotonic state-machine progress; shared AbortSignal; busy released in `finally` | stable sanitized error; atomic ReviewDraft transaction and readback; formal write 0 | `normal-ui-import-production-owner.test.js`, `production-normal-ui-import-cutover.test.js` | retained and switched |
| DOCX vision; DOCX question + answer | Bridge -> production DOCX vision port -> producer identity/provenance owner | recognition cancellation discards late output | producer-time provenance and controlled-write required; ReviewDraft only | Phase 5 same-producer browser plus C2-11 scenarios 1-2 | retained and switched |
| DOCX deterministic | no normal-UI production route | N/A | N/A | Phase 5 route-identity evidence and current proxy graph | remains truthfully N/A |
| PDF full, safe-partial, formula fallback | Bridge -> PDF coordinator -> unique PDF projection owner | all Bridge stages cancellable until the transaction point of no return | real controlled-write/ownership/sequence evidence; safe prefix not widened | C2-11 scenarios 3-4 and 9; PDF shadow suite | retained and switched |
| PDF known-bad, conflict, ambiguous support, raw JSON | same Bridge boundary, fail closed before ReviewDraft persistence | busy released; retry remains available | stable rejection; writes 0; no fallback | C2-11 scenarios 5-8 | retained as explicit rejection |
| cancellation, persistence failure, duplicate, lost response/reload, retry | controller plus Bridge state/persistence owners | cancellation boundaries and duplicate active-run lock are explicit | rollback, idempotency/readback, and retry are production tested | C2-11 scenarios 10-14 and cutover unit tests | retained and switched |
| image/TXT quick batch import | no longer accepted by the batch picker | N/A | rejected before a batch production command | template accept list and route-inventory gate | removed from this production path; separate manual/OCR UI unaffected |
| mixed DOCX/PDF, unsupported extension | Bridge preflight or upload guard | no producer work | stable unsupported error; writes 0 | route-inventory and no-fallback tests | retained only as fail-closed rejection |
| resume import | persisted review reload through `loadBatchImportData` | no recognition resume | read-only ReviewDraft reload | C2-11 scenario 13 | outside recognition owner, retained |
| historical direct/proxy/feature-flag route | no UI event and no runtime script dependency | N/A | N/A | retirement tests plus Chromium legacy counters | removed/unreachable |

Final runtime counters from the ordinary application entry are: Bridge
production calls greater than zero, normal-UI review successes greater than
zero, legacy production calls 0, legacy fallback calls 0, formal writes 0,
wrong attachments 0, raw-JSON leakage 0, placeholder leakage 0, and
`realApiCalled=false`.
