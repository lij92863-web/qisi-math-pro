# BM-AUTO Full Candidate Pool Update After Round 006

Updated: after Round 008 (commit `2d0be80`)
Current app.js lines: 23026

---

## Already migrated helpers

| Round | Helper | Target Module | Commit |
|-------|--------|---------------|--------|
| 001 | cleanRecognizedText | qisi-utils.js | 6150a63 |
| 002 | mathSignalCount | qisi-utils.js | 3f2de64 |
| 003 | extractRelevanceTokens | qisi-utils.js | 8ba5d36 |
| 004 | finalChoiceAnswerText | qisi-utils.js | f6a6a3f |
| 005 | cleanFormulaOcrText | qisi-utils.js | 5cf30ad |
| 006 | findNode | qisi-utils.js | ca51b17 |
| 007 | validatePageRange | qisi-utils.js | 6af7057 |
| 008 | normalizeDraftPreviewOptions | qisi-utils.js | 2d0be80 |

---

## Top 50 eligible candidates (post Round 008)

| # | Name | Score | Lines | Module | Risk |
|---|------|-------|-------|--------|------|
| 1 | normalizeEditorChoiceLabel | 98 | 60 | qisi-utils.js | low |
| 2 | parseAnswerItemsFromText | 98 | 49 | qisi-support-parser.js | low |
| 3 | parseNumberedSolutionBlocks | 98 | 53 | qisi-support-parser.js | low |
| 4 | extractDocxQuestionBlockByNumber | 94 | 45 | qisi-docx-pipeline.js | low |
| 5 | extractDocxTableTextFallback | 94 | 55 | qisi-docx-pipeline.js | low |
| 6 | debugDocxXmlStructure | 94 | 51 | qisi-docx-pipeline.js | low |
| 7 | ommlChildren | 94 | 46 | qisi-utils.js | low |
| 8 | extractQuestionArray | 94 | 46 | qisi-pdf-answer-only-extraction.js | low |
| 9 | tryRepairedCandidate | 94 | 70 | qisi-support-repair.js | low |
| 10 | splitMergedRecognizedItems | 94 | 45 | qisi-utils.js | low |
| 11 | isLikelyRealQuestionFigure | 90 | 35 | qisi-utils.js | low |
| 12 | buildDraftImagePlacementCode | 90 | 35 | qisi-review-draft-state.js | low |
| 13 | attachDraftImageTokensIntoStemsForV2 | 86 | 35 | qisi-review-draft-state.js | low |
| 14 | repairDraftChoiceOptionsFromCachedFileText | 83 | 33 | qisi-review-draft-state.js | low |
| 15 | alignSupportItemsSafely | 82 | 32 | qisi-support-parser.js | low |
| 16 | replaceQisiImageTokensForLatex | 82 | 32 | qisi-utils.js | low |
| 17 | extractImageTokenIds | 80 | 30 | qisi-pdf-answer-only-extraction.js | low |
| 18 | parseTextOptionsFromDocxQuestionText | 80 | 27 | qisi-docx-pipeline.js | low |
| 19 | buildQuestionNumberGapWarning | 79 | 26 | qisi-ui-events.js | low |
| 20 | normalizeBareLatexForDisplaySpan | 79 | 26 | qisi-utils.js | low |
| 21 | buildKnowledgeCounts | 78 | 25 | qisi-ui-events.js | low |
| 22 | openBatchFilePicker | 77 | 28 | qisi-batch-engine-v2.js | low |
| 23 | attachSourceTraceToDraftQuestion | 77 | 28 | qisi-review-draft-state.js | low |
| 24 | extractPlainTextFromDocxOptionXmlFragment | 76 | 27 | qisi-docx-pipeline.js | low |
| 25 | mergeDocxVisualOptionsForV2 | 76 | 27 | qisi-docx-pipeline.js | low |
| 26 | openBatchCreate | 75 | 26 | qisi-batch-engine-v2.js | low |
| 27 | parseDocxRelationshipMap | 75 | 23 | qisi-docx-pipeline.js | low |
| 28 | convertDocxImporterDraftToRecognitionItem | 75 | 26 | qisi-review-draft-state.js | low |
| 29 | mergeDocxVisualDraftsByQuestionNumberForV2 | 75 | 26 | qisi-review-draft-state.js | low |
| 30 | extractImageRelationshipIdsFromXml | 74 | 25 | qisi-pdf-answer-only-extraction.js | low |
| 31 | attachSinglePdfPageTrace | 74 | 25 | qisi-pdf-safe-partial-pipeline.js | low |
| 32 | docxVisualTextIsBetterForV2 | 74 | 25 | qisi-docx-pipeline.js | low |
| 33 | confirmBatchFilePurpose | 72 | 24 | qisi-batch-engine-v2.js | low |
| 34 | isFatalQwenServiceError | 72 | 20 | qisi-utils.js | low |
| 35 | findVisualItemForQuestion | 72 | 20 | qisi-utils.js | low |
| 36 | inferExpectedQuestionCount | 72 | 24 | qisi-utils.js | low |
| 37 | repairChoiceOptions | 70 | 22 | qisi-support-repair.js | low |
| 38 | reconcileAnswerWithSolution | 70 | 22 | qisi-utils.js | low |
| 39 | appendImageTokensToStemForV2 | 70 | 22 | qisi-utils.js | low |
| 40 | normalizeBareLatexForDisplayOptions | 70 | 19 | qisi-utils.js | low |
| 41 | normalizeDraftEditorNewlines | 69 | 18 | qisi-review-draft-state.js | low |
| 42 | extractAssistantText | 69 | 21 | qisi-pdf-answer-only-extraction.js | low |
| 43 | attachPdfPageTrace | 69 | 21 | qisi-pdf-safe-partial-pipeline.js | low |
| 44 | findUploadedVisualCompanionForDocx | 69 | 18 | qisi-docx-pipeline.js | low |
| 45 | summarizeStrictPageItems | 69 | 21 | qisi-utils.js | low |
| 46 | batchFinalGateBetterText | 69 | 21 | qisi-batch-engine-v2.js | low |
| 47 | ensureLatexPackage | 68 | 20 | qisi-utils.js | low |
| 48 | normalizeBareLatexForDisplayTextBody | 68 | 17 | qisi-utils.js | low |
| 49 | shouldMatchByOrder | 67 | 16 | qisi-utils.js | low |
| 50 | normalizeFigureBbox | 67 | 16 | qisi-utils.js | low |

---

## Migration priority notes

- Candidates in qisi-utils.js are preferred (already has migrated helpers)
- Candidates with dependencies only on already-migrated functions are preferred
- Candidates with dependencies on other app.js functions need careful audit
- DOM/DB/AI/OCR/async dependencies = reject
