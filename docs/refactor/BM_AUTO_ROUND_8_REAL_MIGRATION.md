# BM-AUTO Round 8 Real Migration

## Stage
BMR8/BMG8

## Start Commit
9783dc777f99d3052c0b3e84617800e49a643dbf

## Candidate Selection
- selected candidate: attachPdfPageTrace, attachSinglePdfPageTrace
- score: 72
- target module: qisi-pdf-safe-partial-pipeline.js
- old function names:
  - attachPdfPageTrace
  - attachSinglePdfPageTrace
- estimatedRemovedAppLines: 46 (group estimate; actual: 45)
- reason selected: pure helpers, no DOM/db/AI/OCR, low risk, already grouped in same module
- skipped candidates:
  - syncEntryLegacyKnowledge: too small (4 lines < 10)
  - buildQuestionFingerprintMaps: eligible (score 63) but single function, lower score
  - resetLibraryFilters: too small (6 lines < 10)
  - getAllChildrenNames: too small (5 lines < 10)
  - openBatchCreate group: eligible (score 75) but contains async risk markers in sub-functions
  - segmentPdfPageQuestionsWithVision: async + too small (4 lines)
  - recognizePdfStructuredWithQwen: async + risk
- skipped reasons: BMR8 rules — pick exactly one eligible group with score >= sufficient, no DOM/DB/async/AI/OCR

## Recovery Context
- recovered from interrupted dirty BMR8 state: yes
- recovery classification: D — DIRTY_BMR8_IN_PROGRESS_ALLOWED_FILES
- no BMR8 commit existed before continuation: true
- no BMR8 doc existed before continuation: true
- forbidden files touched before continuation: no
- fix applied during continuation: changed `Qisi.PdfSafePartialPipeline` → `window.Qisi.PdfSafePartialPipeline` for consistency with rest of app.js and verifier detection

## A4 Exclusion Check
- related to A4 remaining callsites: no
- related to A4 wrapper removal: no
- action: none — functions are PDF page trace metadata helpers, not A4-related

## Risk Check
- DOM access: no
- DB access: no
- AI/OCR access: no
- controlled-write access: no
- async: no
- Route B: no
- target existing module: yes (qisi-pdf-safe-partial-pipeline.js, existed since BM12)

## Migration
- moved functions:
  - attachPdfPageTrace (array items → trace metadata)
  - attachSinglePdfPageTrace (single item → trace metadata)
- source: app.js lines ~7517-7566
- target: qisi-pdf-safe-partial-pipeline.js
- app.js calls new module: yes — `window.Qisi.PdfSafePartialPipeline.attachPdfPageTrace` and `window.Qisi.PdfSafePartialPipeline.attachSinglePdfPageTrace`
- old definitions removed: yes — both function bodies removed from app.js, replaced with module references

## Execution Verification
- before app.js lines: 22040
- after app.js lines: 21995
- delta: -45
- verifier classification: REAL_MIGRATION
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests
| Command | Result | Notes |
| --- | --- | --- |
| node --test tests/pdf-safe-partial-pipeline.test.js | passed | 10/10 (2 BM12 + 8 BMR8) |
| node --test tests/base-migration-execution-gate.test.js | passed | 15/15 |
| node --test tests/pdf-route-b-hold.test.js | passed | 6/6 |
| npm.cmd run smoke:batch:mock | passed | 20/20 |
| npm.cmd run verify:safe | passed | 854/854 + node --check all files + verify:no-real-ai |
| npm.cmd run verify:batch-safety | passed | verify:docx-stable (20/20) + verify:pdf-known-bad (65/65) + verify:no-real-ai + smoke:batch:mock (20/20) |
| npm.cmd run verify:pdf-known-bad | passed | 65/65 |
| node --test tests/pdf-support-controlled-write-answer-ownership.test.js | passed | 21/21 |
| node scripts/pdf-master-browser-runner.js preflight | passed | realApiCalled=false, underlyingApiCallCount=0 |
| node scripts/pdf-master-browser-runner.js dry-run | passed | realApiCalled=false, underlyingApiCallCount=0, browser chain OK |
| npm.cmd run verify:docx-stable | passed | 20/20 |
| npm.cmd run verify:diff-scope | passed | |

## Safety
- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no
- app.css changed: no

## Git Diff
- changed files: app.js, qisi-pdf-safe-partial-pipeline.js, tests/pdf-safe-partial-pipeline.test.js
- app.js delta: -49 lines (+2 window.Qisi refs, -49 old definitions)
- qisi-pdf-safe-partial-pipeline.js delta: +73 lines (2 functions + JSDoc + exports)
- tests/pdf-safe-partial-pipeline.test.js delta: +85 lines (8 new BMR8 tests)

## Decision
REAL_MIGRATION ACCEPTED

## Next Stage
Stop. Do not enter BMR9 automatically.
