# BM-AUTO Full Round 012 REAL_MIGRATION

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Branch: main
Start commit: `96108f5`
End commit: `e828dc9`

Target helper group: normalizeFigureBbox
Target module: qisi-utils.js

## Changed files

- app.js
- qisi-utils.js
- tests/qisi-utils-normalize-figure-bbox.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_012_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_012_REAL_MIGRATION.md

## Migration

### Old function
- **Name:** normalizeFigureBbox
- **Location:** app.js approx lines 10633-10648
- **Behavior:** Normalizes bbox [x1,y1,x2,y2] corners — ensures x1=min, y1=min, x2=max, y2=max. Returns [] for invalid input (non-array, wrong length, non-finite values, zero-area).

### New module export
`window.Qisi.Utils.normalizeFigureBbox` — exact copy, no behavior change

### Call sites
All bare calls replaced with `window.Qisi.Utils.normalizeFigureBbox(...)`:
- bboxAreaForQuestionFigure (line 10651)
- bboxIntersectionArea x2 (lines 10659-10660)
- normalizeRecognizedFigureDescriptor (line 10674)
- isRealQuestionFigureImageRow (line 10719)

### Delta
| Metric | Value |
|--------|-------|
| beforeLines | 22970 |
| afterLines | 22953 |
| delta | -17 |

## Execution verification

```bash
node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names normalizeFigureBbox
```

Result: REAL_MIGRATION, delta -17, oldDefinitionsStillPresent: false, appCallsNewModule: true, moduleExportsMovedFunctions: true

## Tests

- node --check app.js: passed
- node --check qisi-utils.js: passed
- node --test tests/qisi-utils-normalize-figure-bbox.test.js: 13/13 pass
- BM-AUTO gate: 15/15 pass
- Route B hold: 6/6 pass
- verify:safe: passed
- verify:batch-safety: passed
- controlled-write: 21/21 pass
- preflight: ok true, realApiCalled false
- dry-run: ok true, realApiCalled false

## Safety

| Check | Status |
|-------|--------|
| controlled-write touched | no |
| parser touched | no |
| aligner touched | no |
| runner touched | no |
| Route B integrated | no |
| real-run called | no |
| AI/OCR called | no |
| package changed | no |
| main.html changed | no |
| verifier changed | no |

## Decision

- classification: REAL_MIGRATION
- accepted: yes
