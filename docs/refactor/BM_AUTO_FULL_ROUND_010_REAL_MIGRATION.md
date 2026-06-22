# BM-AUTO Full Round 010 REAL_MIGRATION

Stage: BM-AUTO-MIMO-RESUME-INTERRUPTED-ROUND
Branch: main
Start commit: `143debe`
End commit: `d2fdf70`

Target helper group: stripAnswerSolution
Target module: qisi-utils.js

## Changed files

- app.js
- qisi-utils.js
- tests/qisi-utils-strip-answer-solution.test.js
- docs/refactor/BM_AUTO_FULL_ROUND_010_PLAN.md
- docs/refactor/BM_AUTO_FULL_ROUND_010_REAL_MIGRATION.md

## Migration

### Old app.js function

**Name:** stripAnswerSolution
**Approximate location:** lines 4724-4740
**Behavior summary:** Strips answer and solution segments from question stem text. Returns `{ stem, answer, solution }`:
- Matches solution via `【解析】` / `【详解】` / `【解答】` / `【分析】` or colon-separated labels
- Matches answer via `【答案】` / `参考答案：` / `答案：`
- Supports full-width A-D characters (Ａ-Ｄ)
- Handles null/undefined gracefully via `String(text || '')`
- Does not mutate input string

### New module exports

`window.Qisi.Utils.stripAnswerSolution` — exact copy of old function, no behavior changes.

### app.js explicit call sites

Line 4818: `window.Qisi.Utils.stripAnswerSolution(stripQuestionSectionNoise(seg.text))` — single call site, prefixed.

### Before / After / Delta

| Metric | Value |
|--------|-------|
| beforeLines | 23005 |
| afterLines | 22988 |
| delta | -17 |

## Behavior equivalence

Tests cover:
1. Normal input: extracts answer and solution
2. Empty input: returns empty `{ stem, answer, solution }`
3. Null input: gracefully returns empty object
4. Undefined input: gracefully returns empty object
5. No answer or solution: full text as stem
6. Answer only: extracts answer with empty solution
7. Solution only: extracts solution with empty answer
8. Boundary: minimal `【答案】A`
9. Representative real case: exam question with math
10. No mutation: does not modify input string
11. Output shape consistency: always returns `{ stem, answer, solution }`
12. Malformed input: handles non-string (number) gracefully
13. Full-width answer: handles Ａ-Ｄ characters
14. app.js explicit call: `window.Qisi.Utils.stripAnswerSolution(` found
15. app.js: no naked `stripAnswerSolution(` calls

## Execution verification

```bash
node scripts/base-migration-verify-execution.js \
  --before .bm_app_before.js \
  --after app.js \
  --module qisi-utils.js \
  --old-names stripAnswerSolution
```

Result:
- classification: REAL_MIGRATION
- delta: -17
- oldDefinitionsStillPresent: false
- appCallsNewModule: true
- moduleExportsMovedFunctions: true

## Tests

| Test | Command | Result |
|------|---------|--------|
| Syntax check app.js | `node --check app.js` | passed |
| Syntax check qisi-utils.js | `node --check qisi-utils.js` | passed |
| Focused test | `node --test tests/qisi-utils-strip-answer-solution.test.js` | 15/15 pass, 0 fail |
| BM-AUTO gate | `node --test tests/base-migration-execution-gate.test.js` | 15/15 pass |
| Route B hold | `node --test tests/pdf-route-b-hold.test.js` | 6/6 pass |
| verify:safe | `npm run verify:safe` | 452/452 pass |
| verify:batch-safety | `npm run verify:batch-safety` | all pass |
| verify:pdf-known-bad | (included in verify:batch-safety) | 65/65 pass |
| smoke:batch:mock | (included in verify:batch-safety) | 20/20 pass |
| controlled-write | `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | 21/21 pass |
| runner preflight | `node scripts/pdf-master-browser-runner.js preflight` | ok: true, realApiCalled: false |
| runner dry-run | `node scripts/pdf-master-browser-runner.js dry-run` | ok: true, realApiCalled: false |
| Execution verifier | (see above) | REAL_MIGRATION |

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
- continue next round: no — interrupted resume completed; user review required before next round
