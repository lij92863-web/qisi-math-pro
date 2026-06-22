# BM-AUTO Round 2 PLAN

## Stage: BM-AUTO-ROUND-2
## Branch: main
## Start commit: 6150a63

---

## 1. 候选审计

### 候选 1: mathSignalCount (qisi-utils.js)
- Lines: 2298-2325, 28 lines
- Dependencies: cleanRecognizedText only (now in qisi-utils.js)
- Score: 92 (from scoring script)
- **Selected**: Self-contained, pure helper, no DOM/DB/AI/OCR/async. Only dependency is cleanRecognizedText which is already in qisi-utils.js.

### 候选 2: extractRelevanceTokens (qisi-utils.js)
- Lines: 3978-3999, 22 lines
- Dependencies: cleanRecognizedText only
- **Rejected**: Good candidate but mathSignalCount is larger and more impactful.

### 候选 3: finalChoiceAnswerText (qisi-utils.js)
- Lines: 13594-13612, 19 lines
- Dependencies: cleanRecognizedText only
- **Rejected**: Good candidate but mathSignalCount is larger.

### 候选 4: cleanFormulaOcrText (qisi-pdf-answer-extraction-quality.js)
- Lines: 2123-2139, 17 lines
- Dependencies: cleanRecognizedText only
- **Rejected**: Target module is in forbidden list.

---

## 2. 最终选择

**Selected**: mathSignalCount → qisi-utils.js

## 3. 为什么低风险

- Pure function: takes string, returns number
- No DOM, DB, AI, OCR, async, controlled-write, Route B
- Only dependency (cleanRecognizedText) already in qisi-utils.js
- No closure variables
- 28 lines, well above 10-line minimum

## 4. 为什么其他候选被拒

- 候选 2-3: Good but smaller than mathSignalCount
- 候选 4: Target module in forbidden list

## 5. 目标模块

- File: qisi-utils.js
- Current lines: 378

## 6. 预计变更

- app.js: remove mathSignalCount definition (lines 2298-2325, ~28 lines)
- qisi-utils.js: add mathSignalCount function
- Test file: tests/qisi-utils-math-signal-count.test.js (new)

## 7. 预计 app.js delta

- Before: 23154 lines
- Expected after: ~23126 lines
- Delta: ~-28 lines

## 8. 禁改文件确认

- All forbidden files NOT touched ✓

## 9. 停止条件

- If mathSignalCount has hidden dependencies → STOP
- If tests fail → STOP
- If classification != REAL_MIGRATION → STOP
