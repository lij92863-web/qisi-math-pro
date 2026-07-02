# BM-AUTO Round 5 Real Migration

## Stage

BMR5/BMG5

## Start Commit

17454e85074d776fac3f8b7073174e0d3aa13725

## Candidate Selection

- inventory file: `.bm_auto_inventory_round_5.json`
- score file: `.bm_auto_score_round_5.json`
- selected candidate: `buildQuestionNumberGapWarning`
- score: 79
- target module: `qisi-ui-events.js`
- old function names: `buildQuestionNumberGapWarning`
- original app.js line range: around line 10023 before migration
- estimatedRemovedAppLines: 26
- reason selected: pure UI warning/view-model helper, existing target module, real app.js callsite, not A4 remaining callsite, not forbidden boundary
- skipped candidates:
  - `qisi-pdf-answer-only-extraction.js` helper group
  - `qisi-support-parser.js` helper group
  - `qisi-pdf-safe-partial-pipeline.js` helper group
  - `qisi-batch-engine-v2.js` mixed open/file-picker group
  - large 33-helper `qisi-utils.js` group
- skipped reasons:
  - PDF answer-only/support/parser/partial pipeline groups are forbidden or high-risk boundaries.
  - batch engine group includes DOM-adjacent open/file-picker entry points.
  - large utilities group is too broad for a one-helper-group round.

## A4 Exclusion Check

- related to A4 remaining callsites: no
- related to A4 wrapper removal: no
- action: proceed

## Fixed-Line / Ownership Test Preflight

- tests scanned: `findstr /s /n /i "line lineNumber startLine endLine contextWindow windowStart windowEnd fixed line-number" tests\*.js`
- relevant fixed-line fixtures found: no direct `buildQuestionNumberGapWarning` fixed-line fixture
- action taken: none
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

- moved functions: `buildQuestionNumberGapWarning`
- source: `app.js`
- target: `qisi-ui-events.js`
- app.js calls new module: yes, `window.Qisi.UiEvents.buildQuestionNumberGapWarning(items)`
- old definitions removed: yes

## Execution Verification

- before app.js lines: 22181
- after app.js lines: 22154
- delta: -27
- verifier classification: `REAL_MIGRATION`
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests

| Command | Result | Notes |
| --- | --- | --- |
| `node --test tests/ui-events.test.js` | passed | 4 tests |
| `node --test tests/base-migration-execution-gate.test.js` | passed | 15 tests |
| `node --test tests/pdf-route-b-hold.test.js` | passed | 6 tests |
| `npm.cmd run smoke:batch:mock` | passed | 20 tests |
| `npm.cmd run verify:safe` | passed | 837 tests plus smoke and no-real-ai |
| `npm.cmd run verify:batch-safety` | passed | batch safety gate |
| `npm.cmd run verify:pdf-known-bad` | passed | 65 tests |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | passed | 21 tests |
| `node scripts/pdf-master-browser-runner.js preflight` | passed | `realApiCalled=false` |
| `node scripts/pdf-master-browser-runner.js dry-run` | passed | `realApiCalled=false` |
| `npm.cmd run verify:docx-stable` | passed | 20 tests |
| `npm.cmd run verify:diff-scope` | passed | allowed diff: `app.js,qisi-ui-events.js,tests/ui-events.test.js,docs/refactor/**` |

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

- changed files:
  - `app.js`
  - `qisi-ui-events.js`
  - `tests/ui-events.test.js`
  - `docs/refactor/BM_AUTO_ROUND_5_REAL_MIGRATION.md`
- app.js delta: -27
- target module delta: +47
- test delta: +32
- docs delta: this report

## Decision

CONTINUE

## Next Stage

If post-push working tree is clean and local HEAD equals origin/main, BMR6 may start automatically.
