# BM-AUTO Long Run 2 Candidate Queue

## Start Commit
215dc63989560e07e2f49af6fda6922bda4f05f0

## Excluded Already Migrated Functions

BMR1:
- `repairChoiceOptions`
- `tryRepairedCandidate`

BMR2:
- `extractDocxQuestionBlockByNumber`
- `extractDocxTableTextFallback`
- `parseDocxRelationshipMap`
- `mimeFromDocxMediaPath`
- `debugDocxXmlStructure`
- `extractPlainTextFromDocxOptionXmlFragment`
- `splitDocxParagraphsForOptionMap`
- `findUploadedVisualCompanionForDocx`
- `docxVisualTextIsBetterForV2`
- `mergeDocxVisualOptionsForV2`

## Candidate Queue

| Rank | Candidate | Target Module | Score | Estimated Lines | Risk | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `extractImageTokenIds`, `extractImageRelationshipIdsFromXml`, `extractAssistantText`, `extractQuestionArray`, `extractLatexFragmentsForCheck` | `qisi-pdf-answer-only-extraction.js` | 75 | 136 | low | SKIP: target file forbidden in Long Run 2 |
| 2 | `alignSupportItemsSafely`, `parseAnswerAndSolutionItemsFromText` | `qisi-support-parser.js` | 73 | 45 | low | SKIP: parser migration forbidden |
| 3 | `normalizeDraftEditorNewlines`, `syncActiveDraftEditorFromQuestion`, `draftSummaryQuestionNo`, `draftRawOptionSourceCandidates`, `repairDraftChoiceOptionsFromCachedFileText`, `finalDraftNeedsOptionVisionRepair`, `convertDocxImporterDraftToRecognitionItem`, `mergeDocxVisualDraftsByQuestionNumberForV2`, `buildDraftImagePlacementCode`, `shouldInlineDraftImageInStemForV2`, `attachDraftImageTokensIntoStemsForV2` | `qisi-review-draft-state.js` | 72 | 247 | low | BMR3 candidate: allowed target, review draft state priority |
| 4 | `attachPdfPageTrace`, `attachSinglePdfPageTrace` | `qisi-pdf-safe-partial-pipeline.js` | 72 | 46 | low | SKIP: target module not in Long Run 2 allowed target list and PDF support area is forbidden by candidate rules |
| 5 | `openBatchCreate`, `openBatchFilePicker`, `confirmBatchFilePurpose`, `batchFinalGateMeaningfulOption`, `batchFinalGateMergeImages`, `batchFinalGateBetterText` | `qisi-batch-engine-v2.js` | 71 | 135 | low | SKIP for now: target module not in Long Run 2 allowed target list; batch engine is broader than preferred batch-orchestrator target |
| 6 | `buildQuestionFingerprintMaps`, `buildKnowledgeCounts`, `buildQuestionNumberGapWarning`, `buildAnswerGrid`, `buildNotice` | `qisi-ui-events.js` | 70 | 92 | low | SKIP: target module not in Long Run 2 allowed target list and UI events can involve event-boundary risk |
| 7 | `questionMatchesLibraryFilters`, `togglePurposeRole`, `isSourcePageImageRow`, `toggleImagePositionMenu`, `normalizeEditorChoiceLabel`, `toLineEvidence`, `optionHasSubstance`, `shouldMatchByOrder`, `findVisualItemForQuestion`, `decodeXmlEntitiesSafe`, `ommlChildren`, `ommlToLatex`, `mergeImageListsById`, `reconcileAnswerWithSolution`, `stripAiCodeFence`, `splitMergedRecognizedItems`, `optionQualityScore`, `isRealQuestionFigureImageRow`, `inferExpectedQuestionCount`, `summarizeStrictPageItems`, `getPageImage`, `runCase`, `appendMissingImageTokensForV2`, `normalizeImagePlacementDuplicates`, `replaceQisiImageTokensForLatex`, `ensureLatexPackage`, `ensureImagePackagesForLatex`, `isSourcePageImageForStemTokenV2`, `appendImageTokensToStemForV2`, `removeImageTokenFromStemForV2`, `normalizeBareLatexForDisplaySpan`, `normalizeBareLatexForDisplayTextBody`, `normalizeBareLatexForDisplayOptionLine`, `normalizeBareLatexForDisplayText`, `normalizeBareLatexForDisplayOptions`, `escapeHtml` | `qisi-utils.js` | 67 | 679 | low | SKIP: target module not in Long Run 2 allowed target list; group is too broad for one safe round |
| 8 | `mimeFromFilename`, `fileBaseNameForMatch` | `qisi-file-dispatcher.js` | 60 | 27 | low | QUEUE: allowed target, file dispatch priority |
| 9 | `repairCommonLatexOcrErrors` | `qisi-pdf-answer-extraction-quality.js` | 56 | 10 | low | SKIP: target file forbidden and OCR area forbidden |

## Skip Rules

- Skip any target listed in the task forbidden files.
- Skip parser, aligner, controlled-write, runner, Route B, AI/OCR, PDF support, DOM rendering, DB write, async pipeline, event binding body, and main orchestration candidates.
- Skip functions already migrated in BMR1 or BMR2.
- Skip candidate groups whose target module is not permitted by Long Run 2 unless a later task explicitly expands the allowed target list.
- Prefer review draft state, review view model, batch input normalization, file/role dispatch, storage summary, UI renderer pure view model, and support repair pure helpers.

## Planned Order

1. BMR3: review draft state helper group in `qisi-review-draft-state.js`.
2. BMR4+: rebuild inventory/score after each successful round and re-evaluate remaining allowed candidates.
