# Legacy Batch Owner Decomposition R3

## Scope and range truth

The normal UI call at `app.js:196` reaches `processDraftImportBatch` when no
test-only `InjectedImportTransport` exists. Its executable declaration starts at
`app.js:15920` and closes at `app.js:18444`. The frozen lexical inventory reports
5,108 lines (`15920–21027`) because its conservative function scanner crosses the
closing brace and includes later setup functions. Both numbers remain recorded:
the former is the removal range; the latter is the reproducible frozen metric.

`processDraftImportBatchV2` at `app.js:15719–15918` is a non-default precursor.
It directly uses DB tables and some new coordinators, but the normal callsite does
not call it. It is not a bridge, production switch, or equivalence proof.

## Responsibility ledger

`Yes/partial` under Production-wired means an owner is live elsewhere, not that
the normal legacy call has been replaced. `Move without copy` is permission only
after the named characterization is red/green in a single-port package.

| Responsibility | Legacy range | Direct dependencies | Reactive dependency | DB side effect | Current owner | Production-wired | Still trapped | Move without copy | Characterization |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| batch/file loading | 15921–15950 | `db.draftImportBatches`, `db.draftImportFiles`, BatchContextService | `activeRecognitionMode`, `batchDefaultMeta` | reads batch/files; updates batch processing state | StorageRepository + BatchContextService | Yes/partial | direct reads and initial status remain | Yes: replace with injected repository port, delete direct range | missing batch/files, immutable load, stale source, initial state |
| source role classification | 15953–15990 | SourceRoleClassifier, legacy role helpers | none | none | SourceRoleClassifier | Yes | legacy filtering/skip projection remains | Yes: call owner and remove local projection | every declared role, duplicate/missing/ambiguous role, order |
| DOCX parsing | 16603–16920 and 17412–17745 | local convert, QisiBatchImporter, DOCX companion finder, Qwen helper ports | `batchDefaultMeta` | repeated file parseStatus writes | DocxImportCoordinator; parse adapter remains in app | Coordinator yes; adapter no | parser adapter and fallback tree remain | Yes, one parse port at a time; remove source range in same commit | deterministic DOCX content/options/images, adapter error, abort, no real AI |
| PDF page processing | 16937–17409 | `processPdfFilePageByPage`, PdfImportCoordinator precursor, PDF.js/render helpers | recognition mode/cost counters | file status writes during pages | PdfImportCoordinator + QisiBatchEngineV2 | Yes/partial | legacy per-page orchestration remains | Only through existing engine/coordinator adapter; no algorithm copy | page order/progress, render error, abort, safe result shape |
| OCR/vision calls | 16611–17723 | strict vision, page vision, text/answer recognition, timeout helpers | recognition mode/cost counters | indirect file status and error writes | existing OCR helpers/QisiBatchEngineV2; Program B policy frozen | Partial | adapter assembly and retry selection remain | Move adapter assembly only; never copy OCR algorithms | engine request count, timeout, cancellation, sanitized error, no-real-ai |
| normalization | 17935–17977 (plus candidate cleanup 16075–16460) | CandidateNormalizer, Utils cleaners, provenance helper | none | mutates in-memory drafts | CandidateNormalizer + existing Utils owners | Yes/partial | final legacy normalization loop remains | Yes only by routing cloned candidates through owner and deleting inline branch | canonical fields, raw evidence isolation, no post-repair wash |
| structure | 17769–17933 | `mergeDraftRecognition`, final dedupe gate | none | mutates in-memory draft order/warnings | coordinator outputs; projection remains legacy | No single bridge port | merge/projection remains | Yes as bounded output projection port; stop if owner composition is insufficient | draft count/order, source order, unmatched, warning equality |
| sequence validation | 15999–16072, 16461–16533, 17208–17364 | support aligner, question contract checks | none | none | ImportValidationService with PdfSupportAligner port | Yes/partial | legacy contract registration/gates remain | Wire existing validators; do not recreate sequence algorithm | gap, duplicate, rewind, external expected numbers |
| ownership validation | 17121–17364 and 17834–17911 | ProductionReviewValidator, source trace, field decisions | none | none | ImportValidationService + ProductionReviewValidator | Yes/partial | legacy warning/application loop remains | Wire owner and remove only duplicate decision projection | wrong attachment, rejected/manual provenance, no answer washing |
| safe-prefix | 16208–16267 and 17189–17364 | PdfSafePartialPipeline, PdfSupportAligner | none | none | PdfImportCoordinator + PdfSafePartialPipeline | Yes/partial | legacy fail-closed state and fused-number sets remain | Call existing owner; move only result projection | prefix/full/fail-closed, missing/gap/rewind, known-bad |
| controlled-write | 17189–17364 | PdfSupportControlledWrite, parser, aligner | none | none | PdfSupportControlledWrite | Yes and frozen | invocation/result projection remains, algorithm does not | Wire same owner; never move or edit algorithm | accepted/rejected fields, reasons, evidence, Route B hold |
| review draft projection | 17804–17977 and 18336–18399 | ReviewDraftBuilder, legacy merge/final gate | none | prepares records later persisted | ReviewDraftBuilder | Yes/partial | legacy metadata/output projection remains | Route validated drafts to builder; bounded projection port for images/status | warnings, missing/rejected/manual fields, IDs ignored only canonically |
| image handling | 16534–16564 and 17978–18335 | crop/bind helpers, ReviewDraftState, final rebind gate | none inside owner | prepares draftImages; crop helpers may allocate browser resources | ReviewDraftState + QisiBatchEngineV2; no complete bridge port | Partial | association/final projection remains | Move bounded projection/association port, never copy crop algorithms | association IDs, order, unassigned state, orphan cleanup, abort |
| draft persistence | 18400–18418 | direct Dexie transaction and bulk operations | none | deletes/replaces drafts/images; updates batch | DraftPersistenceService + StorageRepository | Yes elsewhere | normal legacy transaction remains | Replace with service call; delete direct transaction in same commit | rollback, idempotency, two-tab version, reload/delete, no formal write |
| batch/file status | 15950, 16573–17759, 18336–18418, 18434–18438 | direct batch/file table updates | list refresh reads status | many batch/file updates | StorageRepository; status port absent | Partial | status policy remains scattered | Move one status/progress port; preserve exact legacy states | processing/review/failed, per-file success/failure, partial error |
| progress | 16587–16590, 16616–17621, 17768–18236 | `updateBatchProgress` (`app.js:720–726`) | mutates `batchImportBatches.value` | updates batch progress | no domain owner; UI adapter plus repository needed | No | DB + reactive update coupled in app | Yes: repository progress port plus separate UI callback, no reactive move | monotonic values, stage mapping, callback failure, cancellation |
| cancellation | no explicit legacy edge; helper timeouts/AbortSignal only | fetch timeout and coordinator signals | none | no rollback receipt | ImportStateMachine + coordinators | State machine scaffold | real legacy run has no end-to-end cancellation | Wire state machine; do not simulate legacy cancellation | abort before/after source, late result ignored, no partial drafts |
| diagnostics | 15924, 15978–15988, 16665–18432 | console/batch debug/PDF diagnostic helpers | cost counter state | may read status snapshots; no intended writes | ImportDiagnostics | Yes elsewhere | private legacy logging remains | Wire allowlisted diagnostics; delete only migrated lifecycle logging | request/batch/stage/duration/engine/counts, privacy attacks |
| UI side effects | 18419–18423 and 18440–18441 | load list, toast, active UI state indirectly | batch lists, active batch/review mode via callers | reload reads after writes | app shell event adapter | Yes as UI | completion/failure UI remains inside owner | Move out to caller after bridge result; never move refs into service | success/failure toast, reload, selected draft, browser no-white-screen |
| error/retry | per-file catches 16665–17759; outer catch 18424–18443 | fatal error classifier, fallback helpers, status updates | cost counters and toast | file/batch failure writes | ImportStateMachine error state + explicit ports | Partial/scaffold | fallback and status mapping remain scattered | Extract stable error/status adapter per port; no hidden fallback | fatal/transient mapping, max retries, rollback, sanitized message |

## Call-graph conclusion

The bridge cannot lawfully remove the legacy body yet. Two bounded production
ports are still trapped (`parseDocxSource`, `reportProgress`), PDF adapter wiring
is not a normal callsite, and output/image projection needs one bounded shared
port. None requires copying an algorithm based on this audit. If a characterization
shows otherwise, C2-10.5 stops under its explicit stop condition.
