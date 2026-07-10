# app.js Reality Report R2

## Baseline

- Lines: 22,044
- Heuristically detected top-level const functions: 319
- Async/risk-signaled functions: 77
- Low-risk candidates: 147
- Medium: 35
- High: 137
- Vue signals by textual census: 81 ref calls, 9 reactive, 41 computed, 14 watch.
- Browser/side-effect signals: 27 document references, 555 window references, 10 fetch calls.
- Domain mentions: DOCX 486, PDF 487, OCR 120, review 127, storage 31, export 33.
- Serialization: 13 JSON.parse and 50 JSON.stringify references.
- Formula rendering: 16 KaTeX mentions.
- Direct Qisi namespaces: DocxPipeline, FileDispatcher, PdfSafePartialPipeline, PdfSupportControlledWrite, ReviewDraftState, SupportRepair, UiEvents, Utils.

The existing inventory script is brace-based. The reported 5,116-line range for `processDraftImportBatch` is a conservative ownership region, not proof of a single lexical function of that size. Extraction requires call-site and AST-quality verification.

## Responsibility finding

app.js currently combines Vue state/lifecycle, DOM/UI, upload, DOCX, PDF, OCR, JSON repair, review, library, storage, export, formula rendering, AI proxy calls, and legacy compatibility. This confirms that line reduction alone is not an acceptance metric. The priority is unique ownership and production-linked coverage.

## Top 50 candidate/legacy regions

Columns record detected direct Qisi dependencies, reactive refs, side effects, directly named tests, recommended target, risk, and whether extraction is allowed before a dedicated work package.

| Function | Lines | Direct deps | Reactive state | Side effects/signals | Direct test name match | Target | Risk | This round |
|---|---|---|---|---|---|---|---|---|
| `processDraftImportBatch` | 16287-21402 (5116) | DocxPipeline,PdfSupportControlledWrite,ReviewDraftState,Utils | activeBatchId,activeDraftEditorBuffer,activeDraftEditorDirty,activeDraftEditorOriginal,activeDraftEditorQuestionId | DOM,AI/OCR/fetch,controlled-write,async | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `parseDocxOptionsFromText` | 2723-2964 (242) | Utils | hit | DOM | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `recognizeExamPageStructuredWithQwen` | 6666-6904 (239) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `recognizeDocxRenderedPageQuestionsWithQwen` | 10203-10404 (202) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `processDraftImportBatchV2` | 16104-16285 (182) | ReviewDraftState,Utils | activeBatchId,activeDraftQuestionId,batchImportMode | DOM,async | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `repairPageChoiceAndSolutionDetailsWithVision` | 6493-6664 (172) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-support-repair.js` | high | not until dedicated WP |
| `loadPreconvertedDocxPageImages` | 9339-9506 (168) | closure/helpers | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `extractTextFromDraftFile` | 4120-4265 (146) | DocxPipeline,Utils | none detected | DOM,async | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `repairFinalDraftDetailsOnImage` | 12860-12996 (137) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `mergeQuestionItemsWithFallback` | 2291-2424 (134) | Utils | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `bindRecognizedQuestionFigures` | 6945-7072 (128) | Utils | none detected | DOM,async | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `renderPdfPageWithRetries` | 7243-7366 (124) | closure/helpers | none detected | DOM,async | no direct name match | `qisi-pdf-safe-partial-pipeline.js` | high | not until dedicated WP |
| `repairDocxOptionsFromTextEvidence` | 3178-3297 (120) | DocxPipeline,Utils | none detected | DOM | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `parseOptionsFromBlock` | 2594-2711 (118) | Utils | none detected | DOM | no direct name match | `qisi-support-parser.js` | high | not until dedicated WP |
| `openPrintWindow` | 21619-21732 (114) | closure/helpers | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `applyFinalVisionPatchesToDrafts` | 13034-13137 (104) | Utils | none detected | DOM | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `extractPdfLayoutWithPdfJs` | 4018-4118 (101) | Utils | none detected | DOM,async | no direct name match | `qisi-pdf-safe-partial-pipeline.js` | high | not until dedicated WP |
| `fillDocxOptionsOnly` | 3046-3146 (101) | Utils | none detected | DOM | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `recognizeAnswerSolutionImageWithQwen` | 12296-12395 (100) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `recognizePdfStructuredWithQwen` | 9154-9253 (100) | Utils | none detected | DOM,async | no direct name match | `qisi-pdf-safe-partial-pipeline.js` | high | not until dedicated WP |
| `validateVisualQuestionItems` | 9641-9740 (100) | Utils | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `mergeAiQuestionsWithLocalMarkdown` | 3341-3438 (98) | Utils | none detected | DOM,AI/OCR/fetch | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `normalizeDocxImporterDraftForV2` | 15810-15902 (93) | closure/helpers | none detected | DOM | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `mergeStrictQuestionItemsByNumber` | 9763-9848 (86) | Utils | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `convertDocxRecordToPdfRecord` | 1040-1115 (76) | closure/helpers | none detected | AI/OCR/fetch,async | no direct name match | `qisi-pdf-safe-partial-pipeline.js` | high | not until dedicated WP |
| `getCurrentQuestionBlockFromPageText` | 3440-3515 (76) | Utils | none detected | DOM | no direct name match | `qisi-pdf-support-block-parser.js` | high | not until dedicated WP |
| `repairDraftAnswersWithQwen` | 12709-12778 (70) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `extractOptionsFromCurrentBlockOnly` | 3517-3586 (70) | Utils | none detected | DOM | no direct name match | `qisi-pdf-answer-only-extraction.js` | high | not until dedicated WP |
| `optionCountForGolden` | 9508-9575 (68) | Utils | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `parseInlineAnswerSolutionBlocks` | 4896-4962 (67) | Utils | none detected | DOM | no direct name match | `qisi-support-parser.js` | high | not until dedicated WP |
| `createDraftImportBatch` | 921-986 (66) | Utils | batchCreateFiles,batchCreateWarning,batchExpectedQuestionCount,batchImportMode | DOM,async | no direct name match | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `buildDocxMediaMaps` | 3751-3816 (66) | DocxPipeline | none detected | DOM,async | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `runBatchDocxGoldenCheck` | 14884-14947 (64) | Utils | none detected | DOM,AI/OCR/fetch | no direct name match | `qisi-batch-engine-v2.js` | high | not until dedicated WP |
| `splitPageMarkdownIntoQuestionBlocks` | 2531-2592 (62) | Utils | none detected | DOM | no direct name match | `qisi-pdf-support-block-parser.js` | high | not until dedicated WP |
| `normalizeEditorChoiceLabel` | 712-771 (60) | ReviewDraftState | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `parseQuestionItemsFromText` | 4355-4413 (59) | SupportRepair,Utils | none detected | DOM | no direct name match | `qisi-support-parser.js` | high | not until dedicated WP |
| `normalizeQuestionType` | 2138-2195 (58) | Utils | none detected | DOM | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `recognizeSingleQuestionRepairWithQwen` | 12550-12606 (57) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-support-repair.js` | high | not until dedicated WP |
| `extractPdfTextWithPdfJs` | 3961-4016 (56) | Utils | none detected | DOM,async | no direct name match | `qisi-pdf-safe-partial-pipeline.js` | high | not until dedicated WP |
| `queueBatchFiles` | 396-450 (55) | closure/helpers | batchCreateFiles,batchCreateWarning,pendingPurposeFile,pendingPurposeQueue | async | no direct name match | `qisi-batch-engine-v2.js` | medium | not until dedicated WP |
| `recognizePageMarkdownWithQwen` | 1554-1607 (54) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `recognizeImageQuestionJsonWithQwen` | 6438-6491 (54) | Utils | none detected | DOM,AI/OCR/fetch,async | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `mergeDocxVisualDraftIntoXmlDraftForV2` | 15503-15555 (53) | DocxPipeline | none detected | DOM,AI/OCR/fetch | review-draft-state.test.js | `qisi-review-draft-state.js` | high | not until dedicated WP |
| `parseNumberedSolutionBlocks` | 4842-4894 (53) | Utils | none detected | DOM | no direct name match | `qisi-support-parser.js` | high | not until dedicated WP |
| `assertQwenResponseOk` | 1215-1266 (52) | closure/helpers | none detected | async | no direct name match | `qisi-utils.js` | medium | not until dedicated WP |
| `docxPageLikeImages` | 9273-9322 (50) | closure/helpers | none detected | async | no direct name match | `qisi-docx-pipeline.js` | medium | not until dedicated WP |
| `applyQuestionRepair` | 12608-12657 (50) | SupportRepair,Utils | none detected | DOM | no direct name match | `qisi-support-repair.js` | high | not until dedicated WP |
| `recognizeTextQuestionsWithQwen` | 6188-6236 (49) | closure/helpers | none detected | AI/OCR/fetch,async | no direct name match | `qisi-utils.js` | high | not until dedicated WP |
| `fillOptionsFromDocxVisualOnly` | 2996-3044 (49) | Utils | none detected | DOM | no direct name match | `qisi-docx-pipeline.js` | high | not until dedicated WP |
| `splitQuestionBlocksByNumber` | 4305-4353 (49) | Utils | none detected | DOM | review-draft-state.test.js | `qisi-pdf-support-block-parser.js` | high | not until dedicated WP |

## Extraction decision

- No high-risk region may move during Phase 0.5 or Phase 1.
- Storage, library, review, export, and import orchestration receive dedicated Phase 2 packages.
- OCR/Qwen helpers require adapter and shadow boundaries first.
- Frozen PDF safety owners require the high-risk protocol.
- Any low-risk extraction still needs a production-linked test and runtime/browser gate where applicable.
