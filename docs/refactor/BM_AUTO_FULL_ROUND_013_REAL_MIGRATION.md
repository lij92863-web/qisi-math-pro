# BM-AUTO Full Round 013 REAL_MIGRATION

Stage: BM-AUTO-FULL-MICRO-TASK-CAMPAIGN
Branch: main
Start commit: `e828dc9`
End commit: `121a7cc`

Target helper group: bboxIntersectionArea
Target module: qisi-utils.js

## Changed files

- app.js
- qisi-utils.js
- tests/qisi-utils-bbox-intersection-area.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_013_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_013_REAL_MIGRATION.md

## Migration

### Old function
- **Name:** bboxIntersectionArea
- **Location:** app.js approx lines 10641-10655 (after R012 migration)
- **Behavior:** Computes intersection area of two bounding boxes. Normalizes both inputs via normalizeFigureBbox (already in qisi-utils.js). Returns 0 for invalid or non-overlapping inputs.

### New module export
`window.Qisi.Utils.bboxIntersectionArea` — exact copy, no behavior change. Internally calls the local `normalizeFigureBbox` (already in same module scope).

### Call sites
Single call site replaced with `window.Qisi.Utils.bboxIntersectionArea(...)`:
- isLikelyRealQuestionFigure (approx line 10692)

### Delta
| Metric | Value |
|--------|-------|
| beforeLines | 22953 |
| afterLines | 22938 |
| delta | -15 |

## Execution verification

```bash
node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names bboxIntersectionArea
```

Result: REAL_MIGRATION, delta -15, oldDefinitionsStillPresent: false, appCallsNewModule: true, moduleExportsMovedFunctions: true

## Behavior equivalence

| Test | Coverage |
|------|----------|
| Overlapping rectangles | ✅ 2500 |
| No overlap → 0 | ✅ |
| Empty array → 0 | ✅ |
| Null → 0 | ✅ |
| Undefined → 0 | ✅ |
| Zero-area boundary → 0 | ✅ |
| No mutation of inputs | ✅ |
| Output shape (always number) | ✅ |
| app.js explicit call | ✅ |
| No naked call | ✅ |

## Tests — audit rerun results

(Supersedes previous truncated/grep output from MIMO campaign run)

- node --check app.js: passed
- node --check qisi-utils.js: passed
- node --test tests/qisi-utils-bbox-intersection-area.test.js: 10/10 pass, 0 fail

See BM_AUTO_FULL_ROUNDS_011_TO_013_AUDIT.md for full rerun log.

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
- continue Round 014: no, until audit commit is pushed
