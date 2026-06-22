# BM-AUTO Full Candidate Pool

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Baseline commit: 6587941
Branch: main

## Inventory Commands

- `node scripts/base-migration-inventory.js`: passed
- `node scripts/base-migration-score.js`: passed

## Audit Policy

The score output is treated as a candidate source only. Manual BM-AUTO eligibility still rejects helpers with closure state, UI state mutation, async/network work, DOM access, DB/storage writes, PDF safety ownership, Route B, real AI/OCR, or uncertain behavior equivalence.

## Candidate Queue Decision

First accepted micro-round candidate:

- name: `findNode`
- approximate location: `app.js:229-238`
- estimatedRemovedAppLines: 10
- suggested target module: `qisi-utils.js`
- risk markers: none after manual audit
- eligible: yes
- reject reason if rejected: n/a
- migration priority: round 006

## Top 50 Candidate Pool

| # | name | approximate location | estimatedRemovedAppLines | suggested target module | risk markers | eligible | reject reason if rejected | migration priority |
|---|---|---:|---:|---|---|---|---|---|
| 1 | `syncEntryLegacyKnowledge` | `app.js:144-147` | 4 | `qisi-utils.js` | too-small | no | delta below 10 | reject |
| 2 | `buildQuestionFingerprintMaps` | `app.js:149-161` | 13 | `qisi-ui-events.js` | UI/library state coupling | no | nearby UI filtering state, not first safest candidate | later audit |
| 3 | `questionMatchesLibraryFilters` | `app.js:163-179` | 17 | `qisi-utils.js` | closure state | no | captures `librarySearchKeyword`, `libraryFilters`, and `hasText` | reject |
| 4 | `resetLibraryFilters` | `app.js:181-186` | 6 | `qisi-utils.js` | UI state mutation, too-small | no | mutates refs and filter object | reject |
| 5 | `buildKnowledgeCounts` | `app.js:188-212` | 25 | `qisi-ui-events.js` | closure state | no | reads `questions.value` and `getQuestionKnowledge` | reject |
| 6 | `getAllChildrenNames` | `app.js:222-226` | 5 | `qisi-utils.js` | nested helper, too-small | no | delta below 10 | reject |
| 7 | `findNode` | `app.js:229-238` | 10 | `qisi-utils.js` | none | yes | n/a | 006 |
| 8 | `flattenKnowledgeTree` | `app.js:259-267` | 9 | `qisi-utils.js` | too-small | no | delta below 10 | reject |
| 9 | `batchStatusText` | `app.js:273-280` | 8 | `qisi-batch-engine-v2.js` | too-small | no | delta below 10 | reject |
| 10 | `draftQuestionStatusText` | `app.js:282-287` | 6 | `qisi-review-draft-state.js` | too-small | no | delta below 10 | reject |
| 11 | `roleLabel` | `app.js:289-295` | 7 | `qisi-utils.js` | too-small | no | delta below 10 | reject |
| 12 | `rolesLabel` | `app.js:297-302` | 6 | `qisi-utils.js` | depends on `roleLabel`, too-small | no | delta below 10 | reject |
| 13 | `showBatchToast` | `app.js:331-336` | 6 | `qisi-batch-engine-v2.js` | UI state mutation, too-small | no | mutates toast refs | reject |
| 14 | `validatePageRange` | `app.js:338-351` | 14 | `qisi-utils.js` | none | yes | n/a | later |
| 15 | `openBatchCreate` | `app.js:361-386` | 26 | `qisi-batch-engine-v2.js` | UI state mutation | no | mutates batch refs and creates UI draft file row | reject |
| 16 | `openBatchList` | `app.js:388-393` | 6 | `qisi-batch-engine-v2.js` | async, too-small | no | async pipeline | reject |
| 17 | `clearBatchDraftWorkspace` | `app.js:395-424` | 30 | `qisi-review-draft-state.js` | async, DB write | no | clears IndexedDB stores | reject |
| 18 | `openBatchFilePicker` | `app.js:426` | 28 | `qisi-batch-engine-v2.js` | DOM ref click | no | triggers file input UI | reject |
| 19 | `readFileAsDataUrl` | `app.js:455-460` | 6 | `qisi-file-dispatcher.js` | async/FileReader, too-small | no | async file read | reject |
| 20 | `queueBatchFiles` | `app.js:462-516` | 55 | `qisi-batch-engine-v2.js` | async pipeline | no | file queue workflow | reject |
| 21 | `handleBatchFileChange` | `app.js:518-521` | 4 | `qisi-batch-engine-v2.js` | async, too-small | no | delegates async file queue | reject |
| 22 | `handleBatchDrop` | `app.js:523-526` | 4 | `qisi-batch-engine-v2.js` | async, event target, too-small | no | drop workflow | reject |
| 23 | `handleBatchHomeDrop` | `app.js:528-532` | 5 | `qisi-batch-engine-v2.js` | async, event target, too-small | no | drop workflow | reject |
| 24 | `togglePurposeRole` | `app.js:534-552` | 19 | `qisi-utils.js` | UI state mutation | no | mutates `pendingPurposeRoles.value` | reject |
| 25 | `confirmBatchFilePurpose` | `app.js:554-577` | 24 | `qisi-batch-engine-v2.js` | UI state mutation | no | mutates batch create state | reject |
| 26 | `cancelBatchFilePurpose` | `app.js:579-581` | 3 | `qisi-batch-engine-v2.js` | UI workflow, too-small | no | advances purpose queue | reject |
| 27 | `editBatchFilePurpose` | `app.js:583-591` | 9 | `qisi-batch-engine-v2.js` | UI state mutation, too-small | no | mutates file purpose UI state | reject |
| 28 | `removeBatchCreateFile` | `app.js:593-596` | 4 | `qisi-batch-engine-v2.js` | confirm/UI mutation, too-small | no | user confirm and state mutation | reject |
| 29 | `loadBatchImportData` | `app.js:598-606` | 9 | `qisi-batch-engine-v2.js` | async, DB read, too-small | no | IndexedDB reads | reject |
| 30 | `updateBatchProgress` | `app.js:608-614` | 7 | `qisi-batch-engine-v2.js` | async, DB write, too-small | no | IndexedDB update | reject |
| 31 | `isValidQuestionPreviewImage` | `app.js:619-623` | 5 | `qisi-review-draft-state.js` | too-small | no | delta below 10 | reject |
| 32 | `isSourcePageImageRow` | `app.js:638-647` | 10 | `qisi-utils.js` | image review policy | no | review image ownership policy, not first safest candidate | later audit |
| 33 | `toggleImagePositionMenu` | `app.js:720-730` | 11 | `qisi-utils.js` | UI state mutation | no | mutates `imagePositionMenuId.value` | reject |
| 34 | `copyDraftImagePlacementLatex` | `app.js:731-757` | 27 | `qisi-review-draft-state.js` | async/clipboard | no | async clipboard side effect | reject |
| 35 | `normalizeDraftEditorNewlines` | `app.js:762-779` | 18 | `qisi-review-draft-state.js` | none | yes | n/a | later |
| 36 | `syncActiveDraftEditorFromQuestion` | `app.js:781-795` | 15 | `qisi-review-draft-state.js` | UI state mutation | no | mutates active editor refs | reject |
| 37 | `normalizeEditorChoiceLabel` | `app.js:797-800` | 60 | `qisi-utils.js` | too-small actual function | no | score range includes adjacent function; actual helper is 4 lines | reject |
| 38 | `normalizeDraftPreviewOptions` | `app.js:858-867` | 10 | `qisi-review-draft-state.js` | none | yes | n/a | later |
| 39 | `buildDraftEditorProjection` | `app.js:869-900` | 32 | `qisi-review-draft-state.js` | depends on nested parser | no | requires moving/rewiring `splitChoiceSourceForEditor` too | reject |
| 40 | `insertDraftEditorText` | `app.js:909-932` | 24 | `qisi-review-draft-state.js` | DOM-like textarea selection, async tick | no | editor interaction workflow | reject |
| 41 | `discardActiveDraftEditorChanges` | `app.js:934-937` | 4 | `qisi-review-draft-state.js` | UI state mutation, too-small | no | mutates refs | reject |
| 42 | `draftSummaryQuestionNo` | `app.js:946-955` | 10 | `qisi-review-draft-state.js` | none | yes | n/a | later |
| 43 | `defaultMetaForStorage` | `app.js:1007-1010` | 4 | `qisi-storage-facade.js` | too-small | no | delta below 10 | reject |
| 44 | `createDraftImportBatch` | `app.js:1012-1077` | 66 | `qisi-review-draft-state.js` | async, DB write | no | creates persistent draft records | reject |
| 45 | `dataUrlToBlob` | `app.js:1079-1086` | 8 | `qisi-utils.js` | fetch/blob, too-small | no | async/network-like data conversion | reject |
| 46 | `isRunningFromFileProtocol` | `app.js:1087-1089` | 3 | `qisi-file-dispatcher.js` | DOM/location, too-small | no | browser location access | reject |
| 47 | `getLocalServiceOpenHint` | `app.js:1090-1092` | 3 | `qisi-utils.js` | too-small | no | delta below 10 | reject |
| 48 | `checkLocalDocxConvertService` | `app.js:1094-1129` | 36 | `qisi-docx-pipeline.js` | DOM, async, network | no | local service call chain | reject |
| 49 | `convertDocxRecordToPdfRecord` | `app.js:1131-1206` | 76 | `qisi-pdf-safe-partial-pipeline.js` | async, AI/OCR-adjacent conversion | no | DOCX/PDF conversion workflow | reject |
| 50 | `mimeFromFilename` | `app.js:1221-1236` | 16 | `qisi-file-dispatcher.js` | none | yes | n/a | later |

