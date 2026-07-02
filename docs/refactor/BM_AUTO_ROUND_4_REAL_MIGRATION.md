# BM-AUTO Long Run 2 Round 4 Real Migration

## Stage

BMR4/BMG4

## Start Commit

9202f9960c34373b7ff2406c67c375f9175bbe3a

## Candidate Selection

- Inventory file: `.bm_auto_inventory_round_4.json`
- Score file: `.bm_auto_score_round_4.json`
- selected candidate: `questionMatchesLibraryFilters`
- score: 64
- target module: `qisi-utils.js`
- old function names: `questionMatchesLibraryFilters`
- original app.js line range: around line 163 before migration
- estimatedRemovedAppLines: 17

Skipped higher-ranked candidates:

- `qisi-pdf-answer-only-extraction.js` group: forbidden PDF answer-only/OCR-adjacent boundary.
- `qisi-support-parser.js` group: parser/aligner boundary.
- `qisi-pdf-safe-partial-pipeline.js` group: PDF support boundary.
- `qisi-batch-engine-v2.js` group: included batch open/file picker entry points and event/DOM-adjacent behavior.
- `qisi-ui-events.js` group: event/UI boundary, not selected while smaller pure utility candidate was available.
- `qisi-utils.js` 34-helper group: too large/non-contiguous for a single round.
- `qisi-file-dispatcher.js` group: definitions were unused in app.js, so it could not satisfy app.js explicit module-call REAL_MIGRATION.

## Risk Check

- DOM: no
- DB: no
- AI/OCR: no
- controlled-write: no
- parser/aligner: no
- async: no
- Route B: no
- target existing module: yes

Fixed-line/context scan:

- Command: `findstr /s /n /i "questionMatchesLibraryFilters librarySearchKeyword libraryFilters hasAnswer noAnswer imageState fixed line-number" tests\*.js`
- Result: no pre-existing fixed-line app.js dependency for this helper. Only the new helper test references the moved function.

## Migration

- moved functions: `questionMatchesLibraryFilters`
- source: `app.js`
- target: `qisi-utils.js`
- app.js calls new module: yes
- old definitions removed: yes
- Implementation note: the helper now receives `keyword`, `filters`, and `hasText` as explicit options instead of closing over Vue refs/state.

## Execution Verification

Command:

```bat
node scripts/base-migration-verify-execution.js --before .bm_auto_round_4_app_before.js --after app.js --module qisi-utils.js --old-names questionMatchesLibraryFilters
```

Result:

```json
{
  "beforeLines": 22191,
  "afterLines": 22181,
  "delta": -10,
  "oldDefinitionsStillPresent": false,
  "appCallsNewModule": true,
  "moduleExportsMovedFunctions": true,
  "classification": "REAL_MIGRATION"
}
```

## Tests

| Gate | Result |
| --- | --- |
| `node --check app.js` | passed |
| `node --check qisi-utils.js` | passed |
| `node --test tests/qisi-utils-question-matches-library-filters.test.js` | passed, 6 tests |
| `node --test tests/base-migration-execution-gate.test.js` | passed, 15 tests |
| `node --test tests/pdf-route-b-hold.test.js` | passed, 6 tests |
| `npm.cmd run smoke:batch:mock` | passed, 20 tests |
| `npm.cmd run verify:safe` | passed, 834 full tests plus smoke and no-real-ai |
| `npm.cmd run verify:batch-safety` | passed |
| `npm.cmd run verify:pdf-known-bad` | passed, 65 tests |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | passed, 21 tests |
| `node scripts/pdf-master-browser-runner.js preflight` | passed, `realApiCalled=false` |
| `node scripts/pdf-master-browser-runner.js dry-run` | passed, `realApiCalled=false` |
| `npm.cmd run verify:docx-stable` | passed, 20 tests |

## Diff

- changed files:
  - `app.js`
  - `qisi-utils.js`
  - `tests/qisi-utils-question-matches-library-filters.test.js`
  - `docs/refactor/BM_AUTO_ROUND_4_REAL_MIGRATION.md`
- app.js delta: -10
- target module delta: +29
- test delta: new focused test file
- docs delta: this report

## Safety

- Forbidden files touched: no
- Real AI/OCR calls: no
- `pdf-master-browser-runner.js real-run`: not run
- Production/local data mutation: no
- DOCX stable gate: passed
- PDF known-bad gate: passed
- Route B remains research-only: passed

## Decision

CONTINUE.

Next stage: BMR5 may start only after this round is committed, pushed, working tree is clean, and local/remote are equal.
