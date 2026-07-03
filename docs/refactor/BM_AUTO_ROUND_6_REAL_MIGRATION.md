# BM-AUTO Round 6 Real Migration

## Stage
BMR6/BMG6

## Start Commit
8ee1b47366973ea06637fd038f135e2918dc343c

## Candidate Selection
- inventory file: .bm_auto_inventory_round_6.json
- score file: .bm_auto_score_round_6.json
- selected candidate: buildKnowledgeCounts
- score: 78
- target module: qisi-ui-events.js
- old function names: buildKnowledgeCounts
- original app.js line range: 170-194
- estimatedRemovedAppLines: 25
- reason selected: pure knowledge-count view-model helper with existing qisi-ui-events.js target, no DOM/DB/AI/OCR/controlled-write/async/Route B access.
- skipped candidates:
  - ommlChildren
  - extractQuestionArray
  - splitMergedRecognizedItems
  - alignSupportItemsSafely
  - replaceQisiImageTokensForLatex
  - extractImageTokenIds
  - openBatchFilePicker
  - openBatchCreate
- skipped reasons:
  - PDF answer-only/support parser candidates were forbidden.
  - open/file-picker candidates touched UI entry/DOM flow.
  - qisi-utils candidates were deferred to avoid broader utility grouping in this round.

## A4 Exclusion Check
- related to A4 remaining callsites: no
- related to A4 wrapper removal: no
- action: not applicable; A4 remains frozen and wrappers remain.

## Fixed-Line / Ownership Test Preflight
- tests scanned: findstr /s /n /i "line lineNumber startLine endLine contextWindow windowStart windowEnd fixed line-number" tests\*.js
- relevant fixed-line fixtures found: none for buildKnowledgeCounts
- action taken: no audit fixture change required
- any ownership/audit test updated: no

## Risk Check
- DOM access: no
- DB access: no
- AI/OCR access: no
- controlled-write access: no
- async: no
- Route B: no
- target existing module: yes

## Migration
- moved functions: buildKnowledgeCounts
- source: app.js
- target: qisi-ui-events.js
- app.js calls new module: yes, via window.Qisi.UiEvents.buildKnowledgeCounts
- old definitions removed: yes

## Execution Verification
- before app.js lines: 22154
- after app.js lines: 22128
- delta: -26
- verifier classification: REAL_MIGRATION
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests
| Command | Result | Notes |
| --- | --- | --- |
| node --test tests/ui-events.test.js | passed | 7 tests passed |
| node --test tests/base-migration-execution-gate.test.js | passed | 15 tests passed |
| node --test tests/pdf-route-b-hold.test.js | passed | 6 tests passed |
| npm.cmd run smoke:batch:mock | passed | 20 tests passed |
| npm.cmd run verify:safe | passed | 840 tests passed; no-real-ai passed |
| npm.cmd run verify:batch-safety | passed | verify-batch-safety passed |
| npm.cmd run verify:pdf-known-bad | passed | 65 tests passed |
| node --test tests/pdf-support-controlled-write-answer-ownership.test.js | passed | 21 tests passed |
| node scripts/pdf-master-browser-runner.js preflight | passed | realApiCalled=false |
| node scripts/pdf-master-browser-runner.js dry-run | passed | realApiCalled=false |
| npm.cmd run verify:docx-stable | passed | 20 tests passed |
| npm.cmd run verify:diff-scope | passed | allowed diff: app.js,qisi-ui-events.js,tests/ui-events.test.js,docs/refactor/** |

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
- changed files: app.js; qisi-ui-events.js; tests/ui-events.test.js; docs/refactor/BM_AUTO_ROUND_6_REAL_MIGRATION.md
- app.js delta: -26
- target module delta: +32/-1
- test delta: +60/-1
- docs delta: new report

## Decision
CONTINUE

## Next Stage
If BMR6 commit and push succeed, BMR7 may start automatically.
