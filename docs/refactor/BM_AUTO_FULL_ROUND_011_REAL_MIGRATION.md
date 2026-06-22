# BM-AUTO Full Round 011 REAL_MIGRATION

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Branch: main
Start commit: `3ddb622`
End commit: `96108f5`

Target helper group: expandPageRange
Target module: qisi-utils.js

## Changed files

- app.js
- qisi-utils.js
- tests/qisi-utils-expand-page-range.test.js
- docs/refactor/BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_010.md
- docs/refactor/BM_AUTO_FULL_ROUND_011_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_011_REAL_MIGRATION.md

## Migration

### Old function
- **Name:** expandPageRange
- **Location:** app.js lines 7571-7587
- **Behavior:** Parse page range string (`"1,3-5,7"`) + maxPage, return sorted array of valid page numbers

### New module export
`window.Qisi.Utils.expandPageRange` — exact copy, no behavior change

### Call sites
3 call sites replaced:
- `window.Qisi.Utils.expandPageRange(file.pageRange, pdf.numPages)` (x3)

### Delta
| Metric | Value |
|--------|-------|
| beforeLines | 22988 |
| afterLines | 22970 |
| delta | -18 |

## Execution verification
- classification: REAL_MIGRATION
- delta: -18
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests — all passed
- node --check app.js / qisi-utils.js
- node --test tests/qisi-utils-expand-page-range.test.js: 13/13
- BM-AUTO gate: 15/15
- Route B hold: 6/6
- verify:safe: passed
- verify:batch-safety: passed
- controlled-write: 21/21
- preflight: ok true
- dry-run: ok true, realApiCalled false

## Safety — no violations
- controlled-write: no
- parser: no
- aligner: no
- runner: no
- Route B: no
- real-run: no
- AI/OCR: no
- package: unchanged
- main.html: unchanged
- verifier: unchanged

## Decision
- classification: REAL_MIGRATION
- accepted: yes
