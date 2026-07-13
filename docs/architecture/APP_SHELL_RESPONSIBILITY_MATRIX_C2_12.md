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
