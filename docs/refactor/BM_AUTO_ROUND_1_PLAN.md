# BM-AUTO Round 1 PLAN

## Stage: BM-AUTO-ROUND-1
## Branch: main
## Start commit: 2d02a9f

---

## 1. 候选审计

### 候选 1: qisi-pdf-support-block-parser.js group
- Functions: splitPageMarkdownIntoQuestionBlocks, getCurrentQuestionBlockFromPageText, splitQuestionBlocksByNumber
- Score: 95, Lines: 187
- **Rejected**: `getCurrentQuestionBlockFromPageText` depends on `parseOptionsFromBlock`, `hasChoiceLabelSignal`, `mathSignalCount` — all still in app.js. `splitPageMarkdownIntoQuestionBlocks` depends on `cleanRecognizedText` — still in app.js. Cannot migrate without broken dependencies.

### 候选 2: qisi-support-parser.js group
- Functions: alignSupportItemsSafely, parseOptionsFromBlock, parseQuestionItemsFromText, + 5 more
- Score: 87, Lines: 401
- **Rejected**: All functions depend heavily on app.js functions (`cleanRecognizedText`, `prepareQuestionRecognitionText`, `stripAnswerSolution`, etc.). Deep coupling makes isolated migration impossible.

### 候选 3: cleanRecognizedText (qisi-utils.js)
- Function: cleanRecognizedText
- Score: 94, Lines: 43 (estimated removed: 54 including call site adjustments)
- **Selected**: Self-contained. Dependencies (`protectLatexMathSegments`, `restoreLatexMathSegments`) already exist in qisi-utils.js. Pure helper, no DOM/DB/AI/OCR/async. Called by many app.js functions — after migration they will access it via global scope (qisi-utils.js is loaded before app.js in main.html).

### 候选 4: qisi-support-repair.js group
- Functions: repairChoiceOptions, tryRepairedCandidate, applyQuestionRepair
- Score: 86, Lines: 142
- **Rejected**: `repairChoiceOptions` depends on `sanitizeChoiceOptions`, `normalizeMathTextForLatexSafe`, `stripQuestionSectionNoise` — all in app.js. `tryRepairedCandidate` has closure dependencies. `applyQuestionRepair` depends on 9 app.js functions.

---

## 2. 最终选择

**Selected**: cleanRecognizedText → qisi-utils.js

## 3. 为什么低风险

- Pure helper: string transformation only
- No DOM, no DB, no AI, no OCR, no async, no controlled-write, no Route B
- Dependencies already in target module (protectLatexMathSegments, restoreLatexMathSegments)
- qisi-utils.js loaded before app.js — global scope access works
- Only 1 function to migrate — minimal complexity

## 4. 为什么其他候选被拒

- 候选 1: getCurrentQuestionBlockFromPageText depends on 3 app.js functions
- 候选 2: 8 functions with 30+ dependencies on app.js functions
- 候选 4: 3 functions with 12+ dependencies on app.js functions

## 5. 目标模块

- File: qisi-utils.js
- Current lines: 318
- Module pattern: top-level const declarations (not UMD)
- Functions already in module: splitQuestionForStorage, protectLatexMathSegments, restoreLatexMathSegments, etc.

## 6. 预计变更

- app.js: remove cleanRecognizedText definition (lines 1979-2021, ~43 lines)
- app.js: no call site changes needed (global scope access)
- qisi-utils.js: add cleanRecognizedText function
- Test file: tests/qisi-utils-clean-recognized-text.test.js (new)

## 7. 预计 app.js delta

- Before: 23198 lines
- Expected after: ~23155 lines
- Delta: ~-43 lines

## 8. 禁改文件确认

- qisi-pdf-support-controlled-write.js: NOT touched ✓
- qisi-pdf-support-aligner.js: NOT touched ✓
- qisi-pdf-support-block-parser.js: NOT touched ✓
- qisi-pdf-answer-only-extraction.js: NOT touched ✓
- qisi-pdf-answer-extraction-quality.js: NOT touched ✓
- scripts/pdf-master-browser-runner.js: NOT touched ✓
- main.html: NOT touched ✓
- app.css: NOT touched ✓
- package.json: NOT touched ✓
- package-lock.json: NOT touched ✓
- AGENTS.md: NOT touched ✓
- ai/: NOT touched ✓
- skills/: NOT touched ✓

## 9. 停止条件

- If cleanRecognizedText has hidden dependencies on app.js functions → STOP
- If tests fail after migration → STOP
- If classification != REAL_MIGRATION → STOP
- If any verify command fails → STOP


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
