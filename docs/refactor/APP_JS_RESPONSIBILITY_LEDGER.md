# app.js Responsibility Ledger

## Purpose
Track the continued reduction of app.js responsibilities toward orchestration only.

## Migration History
| Stage | Commit | Target Module | Functions Moved | App.js Delta |
| --- | --- | --- | --- | --- |
| BM24 | a7b8a89 | qisi-file-dispatcher.js | 7 batch role helpers | -19 |
| BMR1 | 72520cc | qisi-support-repair.js | 2 support repair helpers | -63 |
| BMR2 | 215dc63 | qisi-docx-pipeline.js | 10 DOCX pipeline helpers | -338 |
| BMR3 | 9202f99 | qisi-review-draft-state.js | review draft state helper group | -193 |
| BMR4 | 3eca489 | qisi-utils.js | questionMatchesLibraryFilters | -10 |
| BMR5 | 8ee1b47 | qisi-ui-events.js | buildQuestionNumberGapWarning | -27 |
| BMR6 | 3b2ed34 | qisi-ui-events.js | buildKnowledgeCounts | -26 |
| BMR7 | 359c0a2 | qisi-utils.js | 6 bare LaTeX display helpers | -88 |
| BMR8 | 7e7980e | qisi-pdf-safe-partial-pipeline.js | attachPdfPageTrace, attachSinglePdfPageTrace | -45 |
| BMR9 | c154d30 | qisi-docx-pipeline.js | decodeXmlEntitiesSafe, stripXmlTagsForDocxText | -15 |
| BMR10 | 3034083 | (none) | no eligible candidate | 0 |

## Functions Moved Details
BM24:
- getBatchFileRoles
- batchHasRole
- batchHasQuestionRole
- batchHasAnswerRole
- batchHasSolutionRole
- batchIsFullRole
- batchIsSupplementalImage

BMR1:
- repairChoiceOptions
- tryRepairedCandidate

BMR2:
- extractDocxQuestionBlockByNumber
- extractDocxTableTextFallback
- parseDocxRelationshipMap
- mimeFromDocxMediaPath
- debugDocxXmlStructure
- extractPlainTextFromDocxOptionXmlFragment
- splitDocxParagraphsForOptionMap
- findUploadedVisualCompanionForDocx
- docxVisualTextIsBetterForV2
- mergeDocxVisualOptionsForV2

BMR3:
- review draft state helper group

BMR4:
- questionMatchesLibraryFilters

BMR5:
- buildQuestionNumberGapWarning

BMR6:
- buildKnowledgeCounts

BMR7:
- normalizeBareLatexExpressionForDisplay
- normalizeBareLatexForDisplaySpan
- normalizeBareLatexForDisplayTextBody
- normalizeBareLatexForDisplayOptionLine
- normalizeBareLatexForDisplayText
- normalizeBareLatexForDisplayOptions

BMR8:
- attachPdfPageTrace
- attachSinglePdfPageTrace

BMR9:
- decodeXmlEntitiesSafe
- stripXmlTagsForDocxText

BMR10:
- (none — no eligible candidate; see BM_AUTO_ROUND_10_NO_ELIGIBLE_CANDIDATE.md)

## Current Rule
app.js should move toward orchestration only.
Business helpers should migrate into qisi-* modules only when REAL_MIGRATION
criteria are met.

## Final HEAD After BMR10
0dff497cb53f291732e63b005055b3df42c5e1c1 (POST-BMR10 final summary)

## Status
BM-AUTO automatic long run frozen after BMR10. No automatic BMR11.

## Still Forbidden
- controlled-write migration without explicit user task
- parser / aligner migration without explicit user task
- Route B production integration
- AI/OCR real calls
- A4 remaining callsite migration without manual review
- BMR11 continuation without explicit user confirmation after POST-BMR10 halt
