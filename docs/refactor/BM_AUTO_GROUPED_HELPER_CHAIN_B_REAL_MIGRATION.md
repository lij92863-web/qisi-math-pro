# BM-AUTO Grouped Helper Chain B REAL_MIGRATION

## Header

- **Stage:** BM-AUTO-GROUPED-HELPER-MIGRATION-CHAIN-B
- **Branch:** main
- **Gate commit:** `58538dd`
- **Migration commit:** `dae9bec`
- **Sync commit:** `43b3a17`
- **Target module:** qisi-utils.js
- **Classification:** REAL_MIGRATION
- **Delta:** -24 (22921 → 22897 lines)

## Changed files in migration commit (`dae9bec`)

| File | Change |
|------|--------|
| app.js | 38 lines modified (2 old definitions deleted, 6 call sites prefixed) |
| qisi-utils.js | 27 lines added (2 new functions + exports) |
| tests/qisi-utils-answer-solution-sections.test.js | 111 lines added (20 tests) |
| docs/refactor/BM_AUTO_GROUPED_HELPER_CHAIN_B_PLAN.md | 13 lines added |
| docs/refactor/BM_AUTO_GROUPED_HELPER_CHAIN_B_REAL_MIGRATION.md | 12 lines added |

## Why grouped

`normalizeAnswerSolutionSource` alone has only 7 lines of function body; its individual delta would be approximately -7, below the -10 threshold. `splitAnswerSolutionSections` depends on `normalizeAnswerSolutionSource` for its input normalization. Together they form a single logical pipeline: normalize → split. Combined delta is -24.

The grouped migration gate (`BM_AUTO_GROUPED_HELPER_GATE.md`, commit `58538dd`) audited all 3 dependency chains and accepted only Chain B for grouped migration. This migration did NOT authorize Chain A (batch media token pipeline) or Chain C (cleanDisplayFieldsOnly).

## Old behavior summary

### normalizeAnswerSolutionSource

- **Input:** `text` (any value)
- **Null/undefined:** `cleanRecognizedText(null)` → `''` → `.replace(...)` chain → `''`
- **Empty string:** returns `''`
- **Processing:** calls `cleanRecognizedText(text)` (already in qisi-utils.js), then chains:
  - `.replace(/\r/g, 'backslash-n')` — normalize CR to LF
  - `.replace(/　/g, ' ')` — fullwidth space to halfwidth
  - `.replace(/[ \t]+/g, ' ')` — collapse horizontal whitespace
  - `.replace(/backslash-n{3,}/g, 'backslash-nbackslash-n')` — collapse excess newlines
  - `.trim()` — remove leading/trailing whitespace
- **Return type:** `string`

### splitAnswerSolutionSections

- **Input:** `text` (any value, passed directly to normalizeAnswerSolutionSource)
- **Processing:** calls `normalizeAnswerSolutionSource(text)` to get normalized `source`, then matches regex `/(^|backslash-n)\s*(?:参考)?(?:解析|详解|解答过程|解答|分析)\s*[:：]?\s*/` for solution header
- **No header found:** returns `{ answerPart: source, solutionPart: source }` — both fields equal to normalized text
- **Header found:** returns `{ answerPart: source.slice(0, header.index).trim(), solutionPart: source.slice(header.index + header[0].length).trim() }`
- **Return type:** `{ answerPart: string, solutionPart: string }`

## Code facts

| Check | Result |
|-------|--------|
| app.js old normalizeAnswerSolutionSource definition removed | yes |
| app.js old splitAnswerSolutionSections definition removed | yes |
| app.js explicit normalize calls | 4 calls (lines 5266, 5316, 5370, 5438) |
| app.js explicit split calls | 2 calls (lines 5267, 5439) |
| qisi-utils exports normalizeAnswerSolutionSource | yes (line 620) |
| qisi-utils exports splitAnswerSolutionSections | yes (line 625) |
| qisi-utils internal dependency | yes — split calls normalize via local scope (line 593) |

## Behavior tests (focused test: 20 tests)

### normalizeAnswerSolutionSource (8 tests)
1. normal text: cleans whitespace and newlines
2. empty string: returns empty string
3. null: returns empty string
4. undefined: returns empty string
5. whitespace-only: returns empty string
6. fullwidth spaces: converts to halfwidth
7. output is string
8. no mutation: input unchanged

### splitAnswerSolutionSections (12 tests)
9. text with 解析 header: splits correctly
10. text with 解答 header: splits correctly
11. text without solution header: returns same in both parts
12. empty input: returns empty object
13. null input: returns empty object fields
14. representative project case: exam answer-solution
15. output shape: always has answerPart and solutionPart
16. integration: normalize → split pipeline
17. app.js explicit call: normalizeAnswerSolutionSource
18. app.js explicit call: splitAnswerSolutionSections
19. app.js: no naked normalizeAnswerSolutionSource calls
20. app.js: no naked splitAnswerSolutionSections calls

## Verification commands (doc-audit rerun)

| Command | Result |
|---------|--------|
| `node --check app.js` | passed |
| `node --check qisi-utils.js` | passed |
| `node --test tests/qisi-utils-answer-solution-sections.test.js` | 20/20 pass, 0 fail, 0 skipped |
| `node --test tests/base-migration-execution-gate.test.js` | 15/15 pass |
| `node --test tests/pdf-route-b-hold.test.js` | 6/6 pass |
| `npm run verify:batch-safety` | passed |
| `node scripts/pdf-master-browser-runner.js preflight` | ok:true, realApiCalled:false |
| `node scripts/pdf-master-browser-runner.js dry-run` | ok:true, realApiCalled:false, result:pass |

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
| scripts changed | no |

## Decision

| Check | Result |
|-------|--------|
| Chain B accepted | yes |
| Continue Chain A automatically | no |
| Continue Chain C automatically | no |
| Next stage | requires user review |
