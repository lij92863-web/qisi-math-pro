# BM-AUTO Remaining Candidate Register After BMR10

## Stage
POST-BMR10 Remaining Candidate Audit

## Source Documents
- docs/refactor/BM_AUTO_ROUND_10_NO_ELIGIBLE_CANDIDATE.md
- docs/refactor/BM_AUTO_BMR9_BMR10_SUMMARY.md
- scripts/base-migration-inventory.js (read-only, rerun not attempted)
- scripts/base-migration-score.js (read-only, rerun not attempted)

## Current HEAD
0dff497cb53f291732e63b005055b3df42c5e1c1

## Summary
- BMR10 classification: STOP_NO_ELIGIBLE_CANDIDATE
- no eligible candidate: yes (honest stop)
- total individual candidates checked: 37
- total group candidates checked: 4
- automatic migration frozen: yes

## Candidate Categories

| Category | Count | Meaning | Action |
| --- | ---: | --- | --- |
| Vue refs / reactive state | ~15 | depends on Vue/app state | manual design required |
| Transitive app.js dependencies | ~12 | candidate depends on app.js-only functions | dependency extraction required first |
| No app.js callers | ~3 | function already not called from app.js or irrelevant | do not migrate |
| Forbidden module / boundary | 0 | touches controlled-write/parser/aligner/runner/AI/OCR/Route B/etc. | forbidden |
| Delta below threshold | ~5 | app.js reduction < 10 | skip unless grouped safely |
| A4 related | ~2 | related to A4 partial callsites/wrappers | manual review only |
| Other | ~0 | explain | explain |

## Candidate Table

### Group Candidates (checked in BMR10)

| Candidate | Type | Suggested Target | Blocker | Evidence | Future Action | Safe to Auto-Migrate? |
| --- | --- | --- | --- | --- | --- | --- |
| openBatchCreate group (6 funcs) | group | qisi-batch-engine-v2.js | Vue reactive state access (batchImportMode, batchUploadInput refs); openBatchFilePicker calls batchUploadInput.value?.click() | Score 71, 135 lines | Manual design: extract Vue-independent logic first | no |
| qisi-utils mega-group (26 funcs) | group | qisi-utils.js | Too large for single round; most functions have transitive dependencies on app.js functions not in qisi-utils | Score 66, 464 lines | Dependency extraction required first; break into sub-groups | no |
| buildQuestionFingerprintMaps group (3 funcs) | group | qisi-utils.js | Vue reactive state access (coreFingerprintMap.value, examConfig.*, selectedExamTemplate.value) | Score 64, 41 lines | Manual design: decouple from Vue state | no |
| mimeFromFilename group (2 funcs) | group | qisi-utils.js | No app.js callers — would fail appCallsNewModule verifier check | Score 60, 27 lines | Do not migrate | no |

### Individual Candidates (top 10 by score, from BMR10 skip list)

| Candidate | Type | Suggested Target | Blocker | Evidence | Future Action | Safe to Auto-Migrate? |
| --- | --- | --- | --- | --- | --- | --- |
| ommlChildren | individual | qisi-utils.js | Tightly coupled to ommlFirst/ommlText cluster; ommlText not eligible | Score 94 | Manual review of OMML math cluster as a whole | no |
| splitMergedRecognizedItems | individual | qisi-utils.js | Depends on mergeStemWithOptions, parseQuestionItemsFromText, normalizeQuestionType, prepareQuestionRecognitionText — all app.js-only | Score 94 | Dependency extraction required first | no |
| replaceQisiImageTokensForLatex | individual | qisi-utils.js | No app.js callers (def only, 1 occurrence) | Score 82 | Do not migrate | no |
| openBatchFilePicker | individual | qisi-batch-engine-v2.js | Calls batchUploadInput.value?.click() — Vue template ref | Score 77 | Manual design: refactor Vue ref dependency | no |
| openBatchCreate | individual | qisi-batch-engine-v2.js | Modifies batchImportMode.value, batchCreateTypeHint.value — Vue refs | Score 75 | Manual design: refactor Vue ref dependency | no |
| confirmBatchFilePurpose | individual | qisi-batch-engine-v2.js | Calls openNextPendingPurposeFile() — app.js-only function | Score 72 | Dependency extraction required first | no |
| findVisualItemForQuestion | individual | qisi-utils.js | Calls normalizeQuestionKey — app.js-only function | Score 72 | Dependency extraction required first | no |
| inferExpectedQuestionCount | individual | qisi-utils.js | No app.js callers (def only, 1 occurrence) | Score 72 | Do not migrate | no |
| reconcileAnswerWithSolution | individual | qisi-utils.js | Depends on multiple app.js-only helper functions | Score 70 | Dependency extraction required first | no |
| batchFinalGateBetterText | individual | qisi-batch-engine-v2.js | Pure helper but tightly coupled to batchFinalGateText, batchFinalGateBadCharCount, batchFinalGateLatexSignalCount — all app.js-only | Score 69 | Dependency extraction required first | no |

### Additional Individual Candidates (from BMR10 full 37 scan)

| Candidate | Type | Suggested Target | Blocker | Evidence | Future Action | Safe to Auto-Migrate? |
| --- | --- | --- | --- | --- | --- | --- |
| ensureLatexPackage | individual | qisi-utils.js | Interconnected with normalizeImagePlacementDuplicates (app.js-only) | LaTeX helper cluster | Manual review of LaTeX helper cluster | no |
| ensureImagePackagesForLatex | individual | qisi-utils.js | Interconnected with normalizeImagePlacementDuplicates (app.js-only) | LaTeX helper cluster | Manual review of LaTeX helper cluster | no |
| escapeImageIdForRegExp | individual | qisi-utils.js | Interconnected with normalizeImagePlacementDuplicates (app.js-only) | LaTeX helper cluster | Manual review of LaTeX helper cluster | no |
| ommlFirst | individual | qisi-utils.js | Coupled to ommlText which is not eligible | OMML cluster | Manual review of OMML cluster | no |
| ommlText | individual | qisi-utils.js | Not eligible standalone | OMML cluster | Manual review of OMML cluster | no |
| batchFinalGateMeaningfulOption | individual | qisi-batch-engine-v2.js | Embedded in Vue-dependent batch group | Batch final gate cluster | Manual review | no |
| batchFinalGateMergeImages | individual | qisi-batch-engine-v2.js | Embedded in Vue-dependent batch group | Batch final gate cluster | Manual review | no |
| normalizeQuestionKey | individual | qisi-utils.js | Called by many candidates but itself app.js-only | Foundational dependency | Extract first before dependent candidates | no |
| mergeStemWithOptions | individual | qisi-utils.js | Called by splitMergedRecognizedItems and others | Foundational dependency | Extract first before dependent candidates | no |
| prepareQuestionRecognitionText | individual | qisi-utils.js | Called by splitMergedRecognizedItems | Foundational dependency | Extract first before dependent candidates | no |
| parseQuestionItemsFromText | individual | qisi-utils.js | Called by splitMergedRecognizedItems | Foundational dependency | Extract first before dependent candidates | no |
| normalizeQuestionType | individual | qisi-utils.js | Called by splitMergedRecognizedItems | Foundational dependency | Extract first before dependent candidates | no |

## Future Unlock Conditions

Before any future automatic migration can continue, the following must be satisfied:

1. **Dependency map**: Complete transitive dependency graph for all remaining app.js functions
2. **Module boundary design**: Clear architectural boundaries for qisi-utils.js (too large), qisi-batch-engine-v2.js (Vue-coupled), and new modules
3. **Test coverage**: Each candidate must have existing or new test coverage before migration
4. **Stable callsite evidence**: Every candidate must have verifiable app.js callers
5. **No forbidden dependencies**: Candidate must not touch controlled-write, parser, aligner, runner, Route B, AI/OCR
6. **app.js delta >= 10**: Migration must reduce app.js by at least 10 lines
7. **Verifier must classify REAL_MIGRATION**: Must pass all verifier gates

## Decision

BM-AUTO automatic long run is frozen after BMR10 under current criteria. All 37 individual candidates and 4 group candidates have verified blockers. No candidate satisfies all BMR requirements simultaneously. Further migration requires explicit user approval after manual architecture review.
