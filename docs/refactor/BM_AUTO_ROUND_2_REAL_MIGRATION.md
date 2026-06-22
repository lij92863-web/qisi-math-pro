# BM-AUTO Round 2 REAL_MIGRATION

## Stage: BM-AUTO-ROUND-2
## Branch: main
## Start commit: 6150a63
## End commit: (pending)
## Target helper group: mathSignalCount
## Target module: qisi-utils.js
## Changed files: app.js, qisi-utils.js, tests/qisi-utils-math-signal-count.test.js, docs/refactor/BM_AUTO_ROUND_2_PLAN.md

---

## Purpose

将 `mathSignalCount` 从 app.js 迁移到 qisi-utils.js。该函数是纯数学符号计数工具，仅依赖 `cleanRecognizedText`（Round 1 已迁移到 qisi-utils.js）。

---

## Boundary

### Allowed files
- app.js ✓
- qisi-utils.js ✓
- tests/qisi-utils-math-signal-count.test.js ✓
- docs/refactor/BM_AUTO_ROUND_2_PLAN.md ✓

### Forbidden files (NOT touched)
- All forbidden files NOT touched ✓

---

## Inventory

### 候选 1: mathSignalCount
- Lines: 2298-2325, 28 lines
- Dependencies: cleanRecognizedText only
- **Selected**: Self-contained, pure helper

### 候选 2: extractRelevanceTokens
- Lines: 3978-3999, 22 lines
- **Rejected**: Smaller than mathSignalCount

### 候选 3: finalChoiceAnswerText
- Lines: 13594-13612, 19 lines
- **Rejected**: Smaller than mathSignalCount

---

## Migration

### Old app.js function
- Name: mathSignalCount
- Location: app.js lines 2298-2325
- Behavior: Counts LaTeX/math symbol occurrences in text

### New module exports
- qisi-utils.js: added mathSignalCount to api object

### Line counts
- app.js before: 23154 lines
- app.js after: 23125 lines
- app.js delta: -29 lines

---

## Behavior equivalence

### Tests added
- File: tests/qisi-utils-math-signal-count.test.js
- Count: 16 tests

### Cases covered
- Normal input, empty input, null, undefined
- No math, dollar signs, subscripts/superscripts
- Chinese math symbols, multiple commands
- Boundary, real case, no mutation, output shape
- Malformed input, whitespace-only, repeated commands

---

## Execution verification

```
node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names mathSignalCount
```

- classification: REAL_MIGRATION
- delta: -29
- old definitions removed: yes
- module exports moved functions: yes

---

## Tests

### Group 1 (post-migration immediate)
- `node --check app.js`: passed
- `node --check qisi-utils.js`: passed
- `node --test tests/qisi-utils-math-signal-count.test.js`: passed (16/16)
- `node scripts/base-migration-verify-execution.js ...`: REAL_MIGRATION

### Group 2 (pre-commit full)
- `node --test tests/base-migration-execution-gate.test.js`: passed (13/13)
- `node --test tests/pdf-route-b-hold.test.js`: passed (6/6)
- `npm.cmd run verify:safe`: passed (20/20)
- `npm.cmd run verify:batch-safety`: passed (20/20)
- `npm.cmd run smoke:batch:mock`: passed (20/20)
- `npm.cmd run verify:pdf-known-bad`: passed (65/65)
- `node --test tests/pdf-support-controlled-write-answer-ownership.test.js`: passed (21/21)
- `node scripts/pdf-master-browser-runner.js preflight`: passed
- `node scripts/pdf-master-browser-runner.js dry-run`: passed
- `npm.cmd run verify:diff-scope`: passed

---

## Safety

- app.js touched: yes
- target qisi module touched: yes
- tests touched: yes
- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no

---

## Git

- commit hash: (pending)
- push status: (pending)

---

## Decision

- classification: REAL_MIGRATION
- accepted: yes
- allowed to continue next round: yes
