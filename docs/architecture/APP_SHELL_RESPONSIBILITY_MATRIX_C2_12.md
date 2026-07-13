# App Shell Responsibility Matrix — C2-12

## Audit baseline and method

- Branch: `stage/app-shell-slimming-r3`
- C2-12 start commit: `f92f8e909aa53047755f71f5b9d9d45d3e849303`
- `app.js`: 19,494 inventory lines, 396 inventory-recognized functions
- Import/review/DOCX/PDF/recognition functions: 205
- Largest function: `parseDocxOptionsFromText`, 242 lines
- Normal UI production owner: `ProductionImportBridge`
- Retired owner: `processDraftImportBatch` (absent)

This matrix combines current function inventory, template events, Vue proxy
exports, lexical callers, runtime dependency order, C2-11 Chromium traces, and
production-linked tests. Template/proxy references count as reachability even
when a function has no lexical `name(...)` caller. Conversely, an isolated
function name is not treated as a live route.

Classifications:

- A — UI shell responsibility;
- B — import-domain orchestration;
- C — validation, ownership, or policy;
- D — persistence or repository responsibility;
- E — diagnostics;
- F — dead or unreachable;
- G — unrelated application feature.

Only A, necessary E, and G may remain in `app.js` after C2-12. A UI handler may
call a unique owner but may not implement B/C/D itself.

## Setup and owner assembly blocks

| Current range | Function/block | Class | Evidence and current responsibility | Final disposition |
| --- | --- | --- | --- | --- |
| 1–19 | repository, Formal Admission, batch submit setup | A wiring | setup-only dependency injection | keep as thin construction; formal lifecycle must use the state-machine owner |
| 31–260 | `importValidationPorts` anonymous validators | C | sequence/schema/ownership/safe-partial/controlled-write policy is implemented inline | move to `qisi-import-validation-service.js`; app injects dependencies only |
| 276–298 | `draftPersistenceService` facade | A wiring | thin calls to the unique service/repository | keep or reduce; no transaction logic |
| 15,950–16,217 | Bridge ports and production adapters | B/C/D mixed | truthful producer selection, projection context, validation and persistence callbacks | move producer behavior to existing source-port owners and validation policy to its owner; keep bounded dependency assembly only |
| 16,219–16,250 | normal UI controller assembly | A | batch route lookup and review-view mapping | keep; route lookup may delegate but has no import algorithm |

## Normal batch-import UI functions

| Current range | Functions | Class | Side effects / owner boundary | Final disposition |
| --- | --- | --- | --- | --- |
| 509–523 | `batchStatusText`, `draftQuestionStatusText` | A | display labels only | keep |
| 567–815 | `showBatchToast`, `openBatchCreate`, `openBatchList`, `clearBatchDraftWorkspace`, `openBatchFilePicker`, `readFileAsDataUrl`, `queueBatchFiles`, `handleBatchFileChange`, `handleBatchDrop`, `handleBatchHomeDrop`, `togglePurposeRole`, `confirmBatchFilePurpose`, `cancelBatchFilePurpose`, `editBatchFilePurpose`, `removeBatchCreateFile` | A | visible template state and file-picker mapping | keep; storage calls must delegate |
| 817–836 | `loadBatchImportData`, `updateBatchProgress` | A/D | maps repository records into Vue state; progress write is a status-owner concern | keep only UI reload mapping; delegate every write |
| 841–979 | preview-image computed helpers, `toggleImagePositionMenu`, `copyDraftImagePlacementLatex` | A | review presentation and clipboard behavior | keep |
| 984–1,152 | editor source/projection and editor UI helpers | A | edit/view-model projection, no import acceptance | keep; producer provenance may only be changed through Formal Admission's manual-edit helper |
| 1,204–1,276 | `defaultMetaForStorage`, `createDraftImportBatch` | A/D | visible form mapping plus direct batch/file transaction | move transaction to `qisi-draft-persistence-service.js`; keep form-to-command mapping |
| 16,252–16,290 | `runBatchRecognition`, `cancelBatchRecognition`, `openBatchReview` | A | bounded controller commands and review navigation | keep |
| 16,292–17,113 | review select/edit/image/crop/review/submit/stats/dedupe/cleanup/delete handlers | A/C/D | UI mapping is valid; inline review normalization/validation and draft writes are not | keep UI commands; move C to review/validation owners and D to draft persistence owner |

Review functions covered by the last row are:
`selectDraftQuestion`, `cleanSingleDraftForSave`, `markDraftFieldManual`,
`markActiveDraftUserEdited`, `updateDraftQuestionField`,
`commitDraftEditorBufferToQuestion`, `saveActiveDraftQuestion`,
`confirmDraftImages`, `deleteDraftImage`, `openSourcePageCrop`, crop pointer
handlers, `loadImageForCrop`, `saveManualCropToDraft`,
`bindUnassignedImage`, `deleteUnassignedImage`,
`validateDraftContentForReview`, `validateDraftForReview`,
`normalizeDraftQuestionBeforeSave`, `markDraftReviewed`,
`detectDraftDuplicate`, `duplicateLabel`, `submitDraftQuestion`,
`refreshBatchStats`, `openBatchSubmitSummary`,
`rerunActiveBatchRecognition`, `dedupeActiveBatchDraftsNow`,
`showUnmatchedAnswerList`, `showActiveRawText`,
`cleanupActiveBatchDisplayPollution`, `showCropNotice`,
`confirmBatchSubmit`, and `deleteBatchImport`.

## Import producer and recognition blocks

| Current range | Functions/block | Class | Reachability | Final disposition |
| --- | --- | --- | --- | --- |
| 1,286–2,064 | local conversion health/convert, AI request helpers, page OCR/vision helpers | B/E | reachable from active DOCX/PDF producer and separate manual OCR feature | move HTTP transport to `qisi-ocr-qwen-adapter.js`; producer orchestration must be owned by the DOCX/PDF source ports; retain only UI health presentation if needed |
| 2,159–5,029 | candidate cleaning, option parsing, DOCX XML/media and PDF text/layout extraction | B/C | partial active producer dependency closure plus legacy helpers | move active algorithms to CandidateNormalizer/DOCX/PDF owners; delete unreachable roots after call-graph proof |
| 5,795–9,921 | text/image/PDF recognition, figure binding, PDF render and segmentation | B/C/E | active producer dependency closure and orphaned legacy roots | same owner-directed move; no app transport or ownership logic remains |
| 9,948–13,717 | strict DOCX/PDF page recognition, support extraction, draft repair/merge | B/C/E | active strict producer plus legacy repair roots | move active strict producer behavior to DOCX/PDF port owners; delete unreachable post-import repair roots |
| 14,631–14,808 | draft problem/golden/final gate helpers | C/E | only a bounded subset is used by current UI cleanup or producer adapters | validation belongs to existing validators; UI text-only checks may remain A |
| 14,827–15,520 | deterministic DOCX/V2 normalization, image-token and visual merge helpers | B/F | most callers are the unreachable V2 precursor; deterministic normal UI is N/A | delete unreachable closure; move any still-required pure helper to existing DOCX/review owners |
| 15,521–15,736 | `processDraftImportBatchV2` | F | no template event, Vue proxy export, controller call, or runtime canary call | delete completely |
| 15,738–15,759 | `productionImportEngineHelpers` | B | active Bridge dependency bag includes app-local domain helpers | replace with owner factories; app retains thin explicit dependency injection only |
| 15,761–15,786 | `docxVisionDecisionFromCandidate` | C | active DOCX vision adapter reconstructs controlled-write decision | move to `qisi-production-docx-vision-source-port.js` |
| 15,788–15,894 | `runProductionDocxVisionImport` | B/C | active normal DOCX production route | move to the existing DOCX vision source port; no copied algorithm |
| 15,896–15,948 | `runProductionFixtureImport` | E/F(test-only) | reachable only when an injected deterministic test transport exists | move behind Bridge's explicit fixture port helper; production route cannot select it |

The named producer/recognition functions in these ranges include every current
inventory row classified as DOCX import, PDF safe-partial, recognition/images,
or batch producer behavior. The complete current name/range source is
`scripts/app-shell-responsibility-inventory.js`; this matrix deliberately
groups mutually dependent helpers by their contiguous owner extraction boundary
instead of pretending each nested one-line wrapper is an independent owner.

## Formal admission and storage-related application features

| Current range | Functions/block | Class | Current issue | Final disposition |
| --- | --- | --- | --- | --- |
| 16,881–16,957 | `submitDraftQuestion` | A/C/D | UI confirmation delegates admission, but reads draft/images directly | keep UI mapping; all read/write and lifecycle transitions delegate to BatchFormalSubmit/DraftPersistence/StateMachine owners |
| 17,343–18,209 | library/import-package/external merge functions | G with D boundary | unrelated library feature; six direct formal `db.questions.put` calls remain | retain feature, replace formal writes with repository owner calls; do not broaden Program C semantics |
| 18,292–18,405 | manual entry/OCR handlers | G | separate manual OCR feature, but one direct Qwen HTTP call and one direct formal write remain | retain UI behavior; delegate transport to OCR adapter and formal write to repository owner |
| 19,205–19,341 | custom-template/personal-knowledge storage | G | unrelated application storage | retain; not an import owner |

Package import/export, exam assembly, printing, templates, knowledge trees,
library filtering, external-bank review, and manual single-question entry are G.
They are not deleted merely to reach a line target. Their formal writes and OCR
transport still delegate to the existing owners because the hard shell boundary
is repository/transport-wide.

## Baseline hard metrics and migration waves

| Metric | C2-12 baseline | Required final |
| --- | ---: | ---: |
| app.js inventory lines | 19,494 | directional <= 12,000; otherwise explain unrelated G |
| largest function | 242 | <= 250 |
| `processDraftImportBatch` | deleted | deleted |
| `processDraftImportBatchV2` | 216 lines / unreachable | deleted |
| import-related inventory functions | 205 | only A/E wrappers remain |
| direct Qwen/DashScope transport callsites | 17 | 0 |
| direct `db.questions.put` | 6 | 0 |
| `PdfSupportAligner` references | 3 | 0 in app |
| `PdfSupportControlledWrite` references | 2 | 0 in app |
| inline field-provenance assignment/construction | 2 | manual owner call only; construction 0 |
| support-level comparisons/construction | 3 | 0 in app |
| direct ReviewDraft builder call | 1 | bounded owner call allowed only in owner assembly; business construction 0 |
| draft persistence service calls | 4 | UI command delegation only; transaction logic 0 |
| legacy fallback | 0 | 0 |
| duplicate normal-UI production owner | 0 | 0 |

Planned independent waves:

1. state-machine and production-policy port closure;
2. unreachable V2/legacy helper deletion;
3. DOCX/PDF production adapter owner extraction;
4. review/draft persistence command extraction;
5. OCR transport and formal repository boundary cleanup;
6. final reachability, duplicate-owner, browser, and metric proof.

Each wave requires characterization, one unique target owner, production
wiring, old implementation deletion, targeted tests, and its own commit before
the next wave.

## Wave 2 result: unreachable deterministic precursor retired

The unreachable `processDraftImportBatchV2` block and its app-local DOCX
deterministic parser/normalizer helpers were deleted. The existing
`qisi-production-docx-source-port.js` owner now exposes
`createProductionImportRunner`, which composes `DocxImportCoordinator` with the
same `parseDocxSource` producer boundary. `app.js` only constructs that runner
and passes it to `ProductionImportBridge`; it no longer calls the importer,
coordinator, or deterministic source parser directly.

Post-wave metrics are 18,833 `app.js` inventory lines and at most 379 detected
functions (down from 19,494 and 396). The 216-line unreachable V2 owner and all
of its deterministic/visual fallback precursor helpers are absent. This wave
does not claim that the remaining active DOCX/PDF adapters or validation policy
have moved; those are the next owner-extraction wave.

## Wave 3 result: import validation policy owner extracted

The 248-line app-local validation policy was moved into the existing
`qisi-import-validation-service.js` owner as
`createProductionValidationPorts`. Sequence, schema, attachment ownership,
safe-partial, reviewability, DOCX support evidence, and controlled-write
evidence rules are unchanged. All five real dependencies are explicit and a
missing dependency fails with
`IMPORT_PRODUCTION_VALIDATION_DEPENDENCY_REQUIRED`.

`app.js` now only injects the aligner, recognition contract, production review
validator, and safe-partial owner objects. It contains no direct validation
method call and no validation-policy builder. Post-wave inventory is 18,586
lines, 379 detected functions, and a 242-line largest function. Active DOCX/PDF
source adapter extraction remains a later wave.

## Wave 4 result: active DOCX vision source adapter extracted

The active DOCX vision route selection, controlled-write decision projection,
support-source matching, and support provenance application were removed from
`app.js`. `qisi-production-docx-vision-source-port.js` now owns the production
runner and delegates producer evidence normalization to the existing
`qisi-docx-producer-identity-contract.js` owner. The identity contract is now
explicit in `owners.json` and `layers.json`; neither the source port nor Bridge
reconstructs provenance independently.

`app.js` only injects the existing question and support producer transports and
role predicates. The old decision builder and support projection loop are
deleted. Post-wave inventory is 18,475 lines and 378 detected functions; the
largest function remains 242 lines. PDF adapter and fixture-port extraction are
not included in this wave.

## Wave 5 result: active PDF source adapter extracted

The active PDF role split, question/support source loops, progress mapping,
support evidence construction, projection-context assembly, and safe-partial
adapter were removed from `app.js`. `qisi-production-pdf-sources-port.js` now
owns the production runner and still has no parser, aligner, controlled-write,
UI, DB, or Formal Admission authority.

The existing `qisi-pdf-candidate-projection.js` owner now exposes a fail-closed
production context builder and privately resolves the already frozen
controlled-write, parser, and aligner owners. Consequently `app.js` contains
zero references or calls to those three high-risk PDF owners. The safe-partial
pipeline is now explicit in the architecture manifests, and import validation
resolves its lower-layer production dependencies without app-local policy.

Post-wave inventory is 18,338 lines and 378 detected functions; the largest
function remains 242 lines. The test-only fixture adapter and lower-level
OCR/vision transports remain separate later boundaries.

## Wave 6 result: injected fixture adapter extracted

The explicitly injected mock transport remains test-only and fail-closed, but
its candidate-envelope validation, expected-sequence prefix selection, and PDF
review-only projection no longer live in `app.js`. The existing
`qisi-production-import-bridge.js` owner exposes `createFixtureImportRunner`;
the shell only resolves the exact `qisi.mock-import-transport.v1` dependency
and injects the existing question-number normalizer.

The runner rejects missing or wrong transport identities and malformed
candidate envelopes before review persistence. It has no DB, Formal Admission,
UI, or real-network authority. Post-wave inventory is 18,294 lines and 378
detected functions; the largest function remains 242 lines. Lower-level
OCR/vision transport delegation and unrelated formal-repository writes remain
separate later boundaries.

## Wave 7 result: formal question table mutations delegated

All six direct `db.questions.put` callsites and the related external-merge
rollback `bulkDelete` now delegate to the existing
`qisi-storage-repository.js` owner. The repository's generic `put` preserves
the exact legacy records and ambient transaction semantics; its new
`deleteMany` operation uses Dexie `bulkDelete` where available and a tested
per-key fallback for compatible repository implementations.

No Formal Admission, controlled-write, review, or import policy changed. The
normal import route still reaches formal storage only through
`BatchFormalSubmit -> FormalAdmissionPolicy -> StorageRepository` after user
confirmation. These seven migrated callsites belong to unrelated legacy
library migration, external-bank merge/rollback, and manual-entry features;
they no longer mutate the formal table directly from the shell. Read-only
question table access and the unrelated external-bank transaction remain G.

Post-wave inventory is 18,302 lines and 378 detected functions; the eight-line
increase from Wave 6 is readable repository delegation around the rollback,
not hidden business logic. The largest function remains 242 lines. Direct
formal question table mutations in `app.js` are zero.

## Wave 8 result: Qwen proxy transport extracted

The 18 Qwen chat/OCR proxy calls and the proxy health check now delegate HTTP
routing, same-origin endpoint allowlisting, timeout/Abort handling, and batch
cost accounting to `qisi-ocr-qwen-adapter.js`. The app shell injects only the
cost callback and continues to own the existing request bodies, prompts,
response validation, retry selection, and UI diagnostics. No prompt, model,
timeout, response parser, or acceptance rule changed.

The transport accepts only `/api/ai/*` same-origin routes, rejects unknown route
kinds, and cannot be configured with a direct DashScope URL. The module is now
accurately marked production-wired while its existing candidate adapter API is
unchanged. `app.js` contains no AI proxy `fetch`, no inline timeout transport,
and no DashScope endpoint constants.

Post-wave inventory is 18,269 lines and 377 detected functions; the largest
function remains 242 lines. Direct OCR/AI HTTP transport in `app.js` is zero.
The remaining request/prompt producer functions are active legacy source
producers, not a second HTTP transport owner; their reachability and final
disposition remain subject to C2-12/C2-13 owner proof.

## Wave 9 result: strict visual source producer shell extracted

The strict visual source preparation and file-level producer orchestration now
belong to the existing `qisi-batch-engine-v2.js` owner through
`createStrictVisualQuestionProducer`. PDF sources and DOCX virtual-PDF sources
share that one producer instance. Its page render contract, image-source
handling, render timing, prepared-page recognition payload, diagnostics, and
fail-closed error identity are characterized without changing recognition,
repair, validation, prompt, or model-selection policy.

The app shell now assembles this engine owner with the existing render,
prepared-page recognition, role, diagnostic, and clock ports. The former inline
`prepareStrictVisualPages` and `processStrictVisualQuestionFile` implementations
are deleted, and no independent source preparation fallback remains. The
lower-level prepared-page recognition algorithm is still active app-local B
behavior and remains explicitly pending; this wave does not claim C2-12
acceptance.

Post-wave inventory is 18,188 `app.js` lines and 376 detected functions; the
largest function remains 242 lines. Both former inline owner definitions are
absent, and the six frozen PDF high-risk files remain byte-unchanged from the
C2-12 baseline.

## Wave 10 result: prepared-page recognition orchestration extracted

The existing batch engine now owns the prepared-page recognition lifecycle via
`createStrictVisualPreparedPagesRecognizer`: bounded page concurrency, source
page trace, figure-locator coordination, item merge, validation calls,
targeted choice/solution repair, gap diagnostics, progress completion, and the
stable result envelope. The validator, recognition producer, figure policy,
repair producer, and option checks remain injected existing owners/functions;
none of their acceptance or prompt behavior was copied or changed.

The 406-line app-local `recognizeStrictQuestionsFromPreparedPages` algorithm is
deleted. The shell constructs the engine recognizer from explicit ports and
passes that callable to the Wave 9 file producer. Characterization covers the
success envelope, page trace, progress, fatal validation, targeted repair, and
missing-port fail-closed behavior. Browser production-cutover and same-producer
shadow equivalence remain unchanged.

Post-wave inventory is 17,817 `app.js` lines and 375 detected functions; the
largest function remains 242 lines. Lower-level recognition, repair, DOCX
conversion/reconciliation, and support producer algorithms remain active
app-local B responsibilities and keep C2-12 pending.

## Wave 11 result: DOCX vision question-source producer extracted

The existing `qisi-production-docx-vision-source-port.js` now owns the DOCX
question-source lifecycle through `createQuestionSourceProducer`: explicit
question-skeleton extraction and validation, conflict fail-closed handling,
DOCX-to-virtual-PDF conversion, invocation of the shared strict visual engine,
skeleton reconciliation, diagnosable failure snapshots, final validation, and
DOCX source trace projection. The importer, converter, strict engine,
reconciler, and validator remain explicit production ports.

The former 560-line app-local failure-snapshot and
`processDocxByLocalConvertAndStrictVision` block is deleted. The shell only
assembles the source producer and maps the source-port input. Characterization
covers authoritative skeleton success, converted-source identity, conflicting
skeleton rejection, mismatch diagnostics, and missing-port fail-closed
behavior; normal-UI production and DOCX vision shadow browser evidence remain
equal.

Post-wave inventory is 17,273 `app.js` lines and 375 detected functions; the
largest detected function remains 242 lines. The remaining DOCX support-source
producer and lower-level converter/reconciler algorithms are still pending B
responsibilities.

## Wave 12 result: DOCX vision support-source producer extracted

The existing `qisi-production-docx-vision-source-port.js` now owns the DOCX
answer/solution source lifecycle through `createSupportSourceProducer`: DOCX
input validation, virtual-PDF conversion, sequential rendering, strict
prepared-page recognition, empty/malformed/coverage fail-closed checks,
original DOCX source-trace projection, and cancellation checks around every
awaited producer boundary. The production runner continues to own exact
question-number attachment and declared support-source order.

The former app-local `processStandaloneDocxSupportByVision` implementation is
deleted. The shell only assembles the producer from existing converter,
renderer, recognition, diagnostic, and clock ports, then forwards the source,
required evidence kinds, expected question numbers, and cancellation signal.
Characterization covers answer-only, solution-only, answer+solution, missing or
malformed evidence, conflict, source identity/order, cancellation, missing
ports, and ownership mismatch. The normal-UI browser canary remains green with
all attachment, leakage, bypass, fallback, formal-write, and real-API counters
at zero.

Post-wave inventory is 16,981 `app.js` lines and 375 detected functions; the
largest detected function remains 242 lines. All six frozen PDF high-risk files
remain byte-unchanged. Lower-level DOCX conversion/reconciliation and other
remaining B responsibilities stay pending for Wave 13 inventory and proof.

## Wave 13 result: DOCX converter/reconciler owners closed

The active local conversion health/request/result lifecycle moved to the new
single-purpose `qisi-docx-converter.js` owner. The active authoritative
question-skeleton filtering, ordering, missing/outside diagnostics, trace
projection, and conflict rejection moved to
`qisi-docx-vision-reconciler.js`. Both lower-layer owners use explicit ports,
are architecture-registered and production-loaded, and have no UI, database,
controlled-write, persistence, or Formal Admission authority. Question and
support producers now forward cancellation into conversion; the question path
also checks cancellation around strict production and reconciliation.

The former app-local converter and skeleton reconciler are absent. A separate
586-line DOCX text-option parse/fill/repair closure was classified C/D after
identifier, export, proxy, controller, and runtime-entry inspection found no
root caller. It was deleted rather than copied. The deletion removed one naked
display-cleaner residual callsite, so the live static proof inventory is now 26
instead of 27; all 26 remain audited and none became replacement-allowed.

Post-wave inventory is 16,144 `app.js` lines and 363 detected functions. The
largest detected function is 239 lines. Focused tests, two browser suites, all
11 mandatory gates, DOCX stable, PDF known-bad, and Route B hold are green; all
safety counters and real API calls remain zero. ReviewDraft command/persistence
ownership is the next conditional audit and has not been claimed complete.

## Wave 14 result: ReviewDraft command/persistence boundary closed

The conditional audit was applicable. Reachable review UI handlers still
created the initial batch/file transaction and directly read or wrote
`draftImportBatches`, `draftImportFiles`, `draftQuestions`, and `draftImages`
for edits, status transitions, image confirmation/deletion/binding/cropping,
duplicate marking, statistics, cleanup, and formal-submit preparation.

The existing `qisi-draft-persistence-service.js` owner now exposes bounded
create, draft-command, and image-command ports. They validate association,
optimistic version, idempotency, submitted-draft immutability, cancellation,
and readback before returning. The existing repository remains the only
transaction owner; its batch replacement now rechecks the expected persistence
version inside the transaction. The shell builds commands, maps successful
readback to UI state, and on failure visibly restores the stored editor state.
It has no catch-and-fallback database route.

Static ReviewDraft table references and draft-table transactions in `app.js`
are now zero. Formal question writes remain isolated from review persistence.
Failure-first command tests finish at 6/6, browser UI error recovery passes,
the 15-case normal-UI canary remains green, and `verify:safe` passes 1,585/1,585
across 54 suites. All 11 mandatory gates pass with zero failed, cancelled,
skipped, todo, timeout, or real API call.

Post-wave inventory is 16,286 `app.js` lines and 363 detected functions. The
largest detected function remains 239 lines. The increase from Wave 13 records
explicit UI command/error/readback mapping in place of terse direct Dexie
operations; no new business owner or function above 250 lines was added.
Decision: `REVIEW_DRAFT_COMMAND_PERSISTENCE_BOUNDARY_ACCEPTED`. Manual edit,
provenance, validation, duplicate policy, and Formal Admission lifecycle remain
an independent conditional Wave 15 audit.

## Wave 15 result: manual provenance and formal lifecycle closed

The conditional audit was applicable. `app.js` directly assigned
`fieldProvenance`, the Formal Submit owner exposed the construction helper, and
click-only confirmation set global manual-edit flags. Image edit commands also
changed formal content without field-scoped review evidence.

`ReviewController` now owns explicit single-field, multi-field, and v-model
manual-edit commands. Only a named changed formal field receives manual
provenance; untouched deterministic or controlled-write evidence is preserved
exactly. Confirmation changes review state only and provenance display no
longer infers manual evidence from global flags. The shell has zero direct
`fieldProvenance` assignments and no formal-table mutation.

`BatchFormalSubmit` now exposes only the Formal Submit command. It evaluates
Formal Admission before calling the repository and supports a stable
pre-repository cancellation. The state machine records
`FORMAL_ADMISSION -> CANCELLED`; cancellation at that boundary performs zero
formal writes. Admission rejection, repository failure, duplicate confirmation,
and two-tab conflict remain covered by the existing owner tests. Bridge formal
writes remain zero.

Failure-first Wave 15 tests finish at 6/6. The real-browser suite proves both
single-field teacher rewrite and untouched click-only confirmation through the
normal import UI and formal transaction. `verify:safe` passes 1,592/1,592
across 54 suites, all 11 mandatory gates pass, and all safety/real-API counters
remain zero. The six frozen PDF files are unchanged.

Post-wave inventory is 16,301 `app.js` lines and 362 detected functions. The
largest detected function remains 239 lines. Decision:
`MANUAL_REVIEW_PROVENANCE_FORMAL_LIFECYCLE_ACCEPTED`. Remaining OCR/Vision
transport and producer ownership is the independent conditional Wave 16 audit.

## Wave 16 result: OCR/Vision transport and strict producer ownership closed

The conditional audit was applicable. The shell still contained 18 direct
Qwen proxy requests plus model selection, request/response protocol handling,
OCR engine selection, and a reachable strict-page source producer. The Qwen
adapter now owns endpoint/model/payload/response/timeout/cancellation behavior;
the new Qwen vision source port owns strict question and document/formula/manual
OCR source behavior; the batch engine remains the strict file/prepared-page
producer owner.

`app.js` now has zero direct proxy request, AI endpoint fetch, model identity,
OCR task selection, production mock identity, and inline strict producer
definitions. Missing ports and malformed responses fail closed. Caller
cancellation is propagated through render, page recognition, figure/repair
ports, and support evidence, with late results rejected before merge. Browser
fixtures use only the explicit test registry slot and cannot become a
production fallback.

The unreachable legacy OCR/Vision recognition and repair closure was removed,
reducing the live display-cleaner residual inventory from 26 to 12 callsites.
Post-wave inventory is 13,226 `app.js` lines and 305 detected functions. The
largest function is the unrelated 164-line `startExamPointerDrag`; the largest
remaining Program C function is the 146-line `extractTextFromDraftFile`.
Focused tests pass 59/59, `verify:safe` passes 1,607/1,607 across 54 suites,
and all 11 mandatory gates and browser canaries pass with real-API counts at
zero. Decision: `APP_OCR_TRANSPORT_OWNER_ZERO_ACCEPTED`. Wave 17 remains an
independent conditional D-boundary audit.

## Wave 17 result: storage and formal repository boundary closed

The conditional audit was applicable. The shell still called formal question
repository mutations for manual create/edit/delete and safe migration, while
external merge and undo retained a `questions` transaction, rollback
snapshots, and restoration loops. Manual image blobs were also written before
the question instead of in the question transaction.

`LibraryService` now owns question save/replace/soft-delete, version-aware safe
LaTeX migration, and atomic external merge/undo commands. It delegates every
table operation and transaction to `StorageRepository`, verifies committed
readback, rejects malformed/duplicate/stale commands, and preserves Blob and
soft-delete state. The shell maps UI data into commands and reloads the
committed state; it has no formal repository mutation call, question-table
transaction, rollback loop, or direct migration mutation.

The formal ReviewDraft route remains Formal Admission followed by the formal
repository transaction, and Bridge formal writes remain zero. Read-only audit,
backup, and Stage-0 diagnostics are E/G. The three remaining direct Dexie
transactions are unrelated G-class external-package staging/maintenance and
touch neither formal nor draft tables; Wave 18 must classify their reachability
without deleting unrelated product behavior.

Focused lifecycle tests pass 58/58; the full suite passes 1,614/1,614 across 54
suites; the 15-case normal-UI canary and six true-import browser tests pass.
All 11 mandatory gates pass with safety and real-API counters at zero. The six
frozen PDF files are unchanged.

Post-wave inventory is 13,167 `app.js` lines and 305 detected functions. The
largest function remains the unrelated 164-line `startExamPointerDrag`; the
largest remaining Program C function remains the 146-line
`extractTextFromDraftFile`. Decision:
`APP_STORAGE_FORMAL_REPOSITORY_BOUNDARY_ACCEPTED`. Wave 18 remains the final
independent C2-12 UI-shell reachability and metric audit.

## Wave 18 final responsibility matrix

The final inventory contains 5,253 lines and 172 detected functions. Every
Program C function and assembly block was reclassified against the A–G model:

| Current range | Responsibility | Class | Final evidence |
| --- | --- | --- | --- |
| 1–213 | repository/service construction and thin command facades | A wiring | calls named owners; no transaction or policy implementation |
| 214–332 | library/knowledge view-model helpers and batch labels | A/G | UI state and unrelated library presentation only |
| 333–1,066 | batch-create, file-purpose, review editor, and draft command UI | A | maps visible state to owner commands; no import algorithm |
| 1,068–1,178 | local-convert presentation, transport construction, cost diagnostics | A/E wiring | AI proxy request ownership remains in `OcrQwenAdapter`; three task-client callbacks are explicit source-port injection |
| 1,179–2,008 | focused source/policy/Bridge owner assembly | A wiring | parser, projection, validation, ReviewDraft, and persistence operations delegate to named owners |
| 2,013–2,935 | normal-UI controller, review commands, crop UI, confirmation, summaries | A | controller commands and UI/readback projection only |
| 2,937–5,253 | library, external-bank, manual-entry, exam, print, template, and knowledge features | G with bounded E | outside Program C; retained without restoring formal-table or AI transport ownership |

Final Program C class result:

| Class | Final result |
| --- | --- |
| A | retained UI commands, view-model mapping, and explicit dependency assembly |
| B | `0` import orchestration implementations |
| C | `0` policy implementations; named owner calls exist only as thin assembly/delegation |
| D | `0` transaction or repository business implementations |
| E | bounded local diagnostics and cost/progress presentation |
| F | `0` audited Program C dead or unreachable functions |
| G | retained unrelated product behavior; three remaining Dexie transactions touch only external-package tables |

The former active browser document, PDF render, visual-support, strict-question,
recognition-structure, support-text/LaTeX, question-content/image, page-parser,
solution-quality, visual-question, and review-normalization implementations now
live in focused owner modules. The app-local definitions and the audited dead
legacy merge/self-test closure are absent. Missing required ports fail closed.

## Final hard metrics

| Metric | C2-12 start | Wave 17 | Wave 18 final |
| --- | ---: | ---: | ---: |
| `app.js` lines | 19,494 | 13,167 | 5,253 |
| detected functions | 396 | 305 | 172 |
| largest function | 242 | 164 | 164 (`startExamPointerDrag`, G) |
| largest Program C function | 242 | 146 | 116 (`saveManualCropToDraft`, A) |
| direct AI proxy requests | 17 | 0 | 0 |
| frozen PDF parser/aligner/controlled-write references | 5 | 0 | 0 |
| direct formal DB writes | 6 | 0 | 0 |
| direct draft-table transaction logic | present | 0 | 0 |
| legacy fallback | 0 | 0 | 0 |
| duplicate normal-UI production owner | 0 | 0 | 0 |

Owner-delegation callsites are recorded separately from implementation
ownership: one PDF projection delegation, one import-validation delegation, one
ReviewDraft-builder delegation, and 21 draft-persistence command/readback
delegations. These are explicit Bridge/UI ports; none contains the delegated
policy or transaction. `processDraftImportBatch` and
`processDraftImportBatchV2` are both absent. The normal UI owner is
`ProductionImportBridge`.

Wave 18 verification passed the 15-scenario normal-UI browser canary, true
DOCX/PDF import, review edit/reload/error recovery, formal confirmation, full
1,622-test safe suite, and all 11 mandatory gates. Wrong attachment, raw JSON,
placeholder leakage, controlled-write bypass, legacy fallback, Bridge formal
write, real API call, failed, cancelled, skipped, todo, and timeout counts are
zero. Final decision: `C2_12_APP_SHELL_CONVERGENCE_ACCEPTED`.
