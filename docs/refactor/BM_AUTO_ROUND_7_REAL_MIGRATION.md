# BM-AUTO Round 7 Real Migration

## Stage
BMR7/BMG7

## Start Commit
3b2ed348c86bd02bd237717d60efd97b02f12c62

## Candidate Selection
- inventory file: .bm_auto_inventory_round_7.json
- score file: .bm_auto_score_round_7.json
- selected candidate: normalizeBareLatexForDisplaySpan helper group
- score: 79
- target module: qisi-utils.js
- old function names: normalizeBareLatexExpressionForDisplay, normalizeBareLatexForDisplaySpan, normalizeBareLatexForDisplayTextBody, normalizeBareLatexForDisplayOptionLine, normalizeBareLatexForDisplayText, normalizeBareLatexForDisplayOptions
- original app.js line range: 21267-21356
- estimatedRemovedAppLines: 88
- reason selected: pure display normalization helper group; dependencies already exist in qisi-utils.js; app.js can call exported utility functions explicitly.
- skipped candidates: ommlChildren; extractQuestionArray; splitMergedRecognizedItems; alignSupportItemsSafely; replaceQisiImageTokensForLatex; extractImageTokenIds
- skipped reasons: OMML candidate uses DOMParser; PDF answer-only candidates are forbidden; support parser candidate is forbidden; splitMergedRecognizedItems sits in recognition/orchestration context; replaceQisiImageTokensForLatex had no app callsite to satisfy appCallsNewModule.

## A4 Exclusion Check
- related to A4 remaining callsites: no
- related to A4 wrapper removal: no
- action: not applicable; A4 remains frozen and wrappers remain.

## Fixed-Line / Ownership Test Preflight
- tests scanned: findstr /s /n /i "line lineNumber startLine endLine contextWindow windowStart windowEnd fixed line-number" tests\*.js
- relevant fixed-line fixtures found: none for normalizeBareLatexForDisplay* helpers
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
- moved functions: normalizeBareLatexExpressionForDisplay; normalizeBareLatexForDisplaySpan; normalizeBareLatexForDisplayTextBody; normalizeBareLatexForDisplayOptionLine; normalizeBareLatexForDisplayText; normalizeBareLatexForDisplayOptions
- source: app.js
- target: qisi-utils.js
- app.js calls new module: yes, via window.Qisi.Utils.normalizeBareLatexForDisplayText and window.Qisi.Utils.normalizeBareLatexForDisplayOptions
- old definitions removed: yes

## Execution Verification
- before app.js lines: 22128
- after app.js lines: 22040
- delta: -88
- verifier classification: REAL_MIGRATION
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests
| Command | Result | Notes |
| --- | --- | --- |
| node --test tests/qisi-utils-bare-latex-display.test.js | passed | 6 tests passed |
| node --test tests/base-migration-execution-gate.test.js | passed | 15 tests passed |
| node --test tests/pdf-route-b-hold.test.js | passed | 6 tests passed |
| npm.cmd run smoke:batch:mock | passed | 20 tests passed |
| npm.cmd run verify:safe | passed | 846 tests passed; no-real-ai passed |
| npm.cmd run verify:batch-safety | passed | verify-batch-safety passed |
| npm.cmd run verify:pdf-known-bad | passed | 65 tests passed |
| node --test tests/pdf-support-controlled-write-answer-ownership.test.js | passed | 21 tests passed |
| node scripts/pdf-master-browser-runner.js preflight | passed | realApiCalled=false |
| node scripts/pdf-master-browser-runner.js dry-run | passed | realApiCalled=false |
| npm.cmd run verify:docx-stable | passed | 20 tests passed |
| npm.cmd run verify:diff-scope | passed | allowed diff: app.js,qisi-utils.js,tests/qisi-utils-bare-latex-display.test.js,docs/refactor/** |

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
- changed files: app.js; qisi-utils.js; tests/qisi-utils-bare-latex-display.test.js; docs/refactor/BM_AUTO_ROUND_7_REAL_MIGRATION.md
- app.js delta: -88
- target module delta: +94
- test delta: new focused test
- docs delta: new report

## Decision
CONTINUE

## Next Stage
If BMR7 commit and push succeed, BMR8 may start automatically.
