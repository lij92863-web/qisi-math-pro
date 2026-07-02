# BM-AUTO Long Run 2 Round 3 Real Migration

Stage: BMR3 / BMG3
Branch: main
Start commit: 43355d16c9f7f20d004214e36385b608374397d8

## Candidate

- Inventory source: LR1 generated `.bm_auto_inventory_long_run_2.json` and `.bm_auto_score_long_run_2.json`; summarized in `docs/refactor/BM_AUTO_LONG_RUN_2_CANDIDATE_QUEUE.md`.
- Selected group: `qisi-review-draft-state.js`
- Moved helpers:
  - `normalizeDraftEditorNewlines`
  - `syncActiveDraftEditorFromQuestion`
  - `draftSummaryQuestionNo`
  - `draftRawOptionSourceCandidates`
  - `repairDraftChoiceOptionsFromCachedFileText`
  - `finalDraftNeedsOptionVisionRepair`
  - `convertDocxImporterDraftToRecognitionItem`
  - `mergeDocxVisualDraftsByQuestionNumberForV2`
  - `buildDraftImagePlacementCode`
  - `shouldInlineDraftImageInStemForV2`
  - `attachDraftImageTokensIntoStemsForV2`

## Preflight

- Working tree was clean at round start.
- Local and `origin/main` were equal at `43355d16c9f7f20d004214e36385b608374397d8`.
- Fixed-line/context scan found no review-draft-state specific fixed-line fixtures. After migration, display-cleaner residual audit tests were updated because the app.js residual cleaner callsite baseline changed from 40 to 39.
- No DOM, DB, async, AI, OCR, controlled-write, or Route B helper group was selected.
- No forbidden file was modified.

## Migration

- Source: `app.js`
- Target: `qisi-review-draft-state.js`
- Existing target module: yes
- Old app.js helper definitions removed: yes
- app.js calls new module explicitly: yes
- App delta: 22384 -> 22191 lines, delta -193

## Execution Verification

`node scripts/base-migration-verify-execution.js --before .bm_auto_round_3_app_before.js --after app.js --module qisi-review-draft-state.js --old-names normalizeDraftEditorNewlines,syncActiveDraftEditorFromQuestion,draftSummaryQuestionNo,draftRawOptionSourceCandidates,repairDraftChoiceOptionsFromCachedFileText,finalDraftNeedsOptionVisionRepair,convertDocxImporterDraftToRecognitionItem,mergeDocxVisualDraftsByQuestionNumberForV2,buildDraftImagePlacementCode,shouldInlineDraftImageInStemForV2,attachDraftImageTokensIntoStemsForV2`

- Classification: REAL_MIGRATION
- beforeLines: 22384
- afterLines: 22191
- delta: -193
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests

| Gate | Result |
| --- | --- |
| `node --check app.js` | passed |
| `node --check qisi-review-draft-state.js` | passed |
| `node --test tests/review-draft-state.test.js` | passed, 12 tests |
| `node --test tests/qisi-app-display-cleaners-r3-*.test.js` targeted set | passed, 60 tests |
| `node --test tests/base-migration-execution-gate.test.js` | passed, 15 tests |
| `node --test tests/pdf-route-b-hold.test.js` | passed, 6 tests |
| `npm.cmd run smoke:batch:mock` | passed, 20 tests |
| `npm.cmd run verify:safe` | passed, 828 full tests plus smoke and no-real-ai |
| `npm.cmd run verify:batch-safety` | passed |
| `npm.cmd run verify:pdf-known-bad` | passed, 65 tests |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | passed, 21 tests |
| `node scripts/pdf-master-browser-runner.js preflight` | passed, `realApiCalled=false` |
| `node scripts/pdf-master-browser-runner.js dry-run` | passed, `realApiCalled=false` |
| `npm.cmd run verify:docx-stable` | passed, 20 tests |

## Diff Scope

- `app.js`: 62 insertions, 255 deletions
- `qisi-review-draft-state.js`: 417 insertions, 20 deletions
- `tests/review-draft-state.test.js`: 227 insertions, 3 deletions
- `tests/qisi-app-display-cleaners-r3-candidate-ranker.test.js`: residual baseline updated to 39
- `tests/qisi-app-display-cleaners-r3-field-mutation-map.test.js`: residual baseline updated to 39
- `tests/qisi-app-display-cleaners-r3-freeze-register.test.js`: residual baseline updated to 39
- `tests/qisi-app-display-cleaners-r3-ownership-audit.test.js`: residual baseline updated to 39
- `tests/qisi-app-display-cleaners-r3-ownership-trace.test.js`: residual baseline updated to 39
- `tests/qisi-app-display-cleaners-r3-proof-builder.test.js`: residual baseline updated to 39
- `tests/qisi-app-display-cleaners-r3-residual-proof.test.js`: residual baseline updated to 39

## Safety

- Real AI/OCR calls: no
- `pdf-master-browser-runner.js real-run`: not run
- Production/local data mutation: no
- Forbidden files touched: no
- PDF support controlled-write/aligner/parser modules touched: no
- DOCX stable gate: passed

## Decision

CONTINUE.

Next stage: BMR4 may start only after this round is committed, pushed, working tree is clean, and local/remote are equal.
