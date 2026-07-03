# BM-AUTO Round 10 No Eligible Candidate

## Stage
BMR10

## Inventory / Score
- inventory file: .bm_auto_inventory_round_10.json
- score file: .bm_auto_score_round_10.json

## Reason
After BMR9 completed, all remaining eligible candidates have blocking issues:

| Group | Score | Lines | Blocker |
| --- | --- | --- | --- |
| openBatchCreate group (6 funcs) | 71 | 135 | Vue reactive state access (batchImportMode, batchUploadInput refs); openBatchFilePicker calls batchUploadInput.value?.click() |
| qisi-utils mega-group (26 funcs) | 66 | 464 | Too large for single round; most functions have transitive dependencies on app.js functions not in qisi-utils |
| buildQuestionFingerprintMaps group (3 funcs) | 64 | 41 | Vue reactive state access (coreFingerprintMap.value, examConfig.*, selectedExamTemplate.value) |
| mimeFromFilename group (2 funcs) | 60 | 27 | No app.js callers — would fail appCallsNewModule verifier check |

Individual checks on all 37 eligible functions (safe module, >=10 lines) confirm the same blockers:
- Batch engine candidates: tightly coupled to Vue template refs and reactive state
- qisi-utils candidates: transitive dependencies on normalizeQuestionKey, escapeImageIdForRegExp, mergeStemWithOptions, and other app.js-only functions
- UI event candidates: access Vue reactive state directly
- File dispatcher candidates: defined but never called from within app.js

No candidate satisfies all BMR requirements simultaneously.

## Skipped Candidates (individual, top 10 by score)
| Candidate | Score | Module | Reason |
| --- | --- | --- | --- |
| ommlChildren | 94 | qisi-utils.js | Tightly coupled to ommlFirst/ommlText cluster; ommlText not eligible |
| splitMergedRecognizedItems | 94 | qisi-utils.js | Depends on mergeStemWithOptions, parseQuestionItemsFromText, normalizeQuestionType, prepareQuestionRecognitionText — all app.js-only |
| replaceQisiImageTokensForLatex | 82 | qisi-utils.js | No app.js callers (def only, 1 occurrence) |
| openBatchFilePicker | 77 | qisi-batch-engine-v2.js | Calls batchUploadInput.value?.click() — Vue template ref |
| openBatchCreate | 75 | qisi-batch-engine-v2.js | Modifies batchImportMode.value, batchCreateTypeHint.value — Vue refs |
| confirmBatchFilePurpose | 72 | qisi-batch-engine-v2.js | Calls openNextPendingPurposeFile() — app.js-only function |
| findVisualItemForQuestion | 72 | qisi-utils.js | Calls normalizeQuestionKey — app.js-only function |
| inferExpectedQuestionCount | 72 | qisi-utils.js | No app.js callers (def only, 1 occurrence) |
| reconcileAnswerWithSolution | 70 | qisi-utils.js | Depends on multiple app.js-only helper functions |
| batchFinalGateBetterText | 69 | qisi-batch-engine-v2.js | Pure helper but tightly coupled to batchFinalGateText, batchFinalGateBadCharCount, batchFinalGateLatexSignalCount — all app.js-only |

## Decision
STOP_NO_ELIGIBLE_CANDIDATE

No BMR10 migration performed. Proceeding to POST-BMR10 final gate and summary.
