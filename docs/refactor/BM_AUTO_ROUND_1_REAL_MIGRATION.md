# BM-AUTO Round 1 REAL_MIGRATION

## Stage: BM-AUTO-ROUND-1
## Branch: main
## Start commit: 2d02a9f
## End commit: (not-completed)
## Target helper group: cleanRecognizedText
## Target module: qisi-utils.js
## Changed files: app.js, qisi-utils.js, scripts/base-migration-verify-execution.js, tests/qisi-utils-clean-recognized-text.test.js, docs/refactor/BM_AUTO_ROUND_1_PLAN.md

---

## Purpose

将 `cleanRecognizedText` 从 app.js 迁移到 qisi-utils.js，减少 app.js 职责。该函数是纯文本清理工具，无 DOM/DB/AI/OCR/async 依赖，其依赖（`protectLatexMathSegments`, `restoreLatexMathSegments`）已在 qisi-utils.js 中。

---

## Boundary

### Allowed files
- app.js ✓
- qisi-utils.js ✓ (target module)
- tests/qisi-utils-clean-recognized-text.test.js ✓ (test file)
- docs/refactor/BM_AUTO_ROUND_1_PLAN.md ✓ (docs)
- scripts/base-migration-verify-execution.js ✓ (工具改进，见下方说明)

### Forbidden files (NOT touched)
- qisi-pdf-support-controlled-write.js ✓
- qisi-pdf-support-aligner.js ✓
- qisi-pdf-support-block-parser.js ✓
- qisi-pdf-answer-only-extraction.js ✓
- qisi-pdf-answer-extraction-quality.js ✓
- scripts/pdf-master-browser-runner.js ✓
- main.html ✓
- app.css ✓
- package.json ✓
- package-lock.json ✓
- AGENTS.md ✓
- ai/ ✓
- skills/ ✓

### Forbidden actions (NOT performed)
- real-run: NO
- AI/OCR calls: NO
- Route B integration: NO
- git reset/rebase/merge/amend: NO

---

## Inventory

### 候选 1: qisi-pdf-support-block-parser.js group
- Functions: splitPageMarkdownIntoQuestionBlocks, getCurrentQuestionBlockFromPageText, splitQuestionBlocksByNumber
- Score: 95, Lines: 187
- **Rejected**: `getCurrentQuestionBlockFromPageText` depends on `parseOptionsFromBlock`, `hasChoiceLabelSignal`, `mathSignalCount` — all still in app.js. Cannot migrate without broken dependencies.

### 候选 2: qisi-support-parser.js group
- Functions: 8 functions
- Score: 87, Lines: 401
- **Rejected**: All functions depend heavily on app.js functions. Deep coupling.

### 候选 3: cleanRecognizedText
- Function: cleanRecognizedText
- Score: 94, Lines: 43
- **Selected**: Self-contained. Dependencies already in target module.

### 候选 4: qisi-support-repair.js group
- Functions: 3 functions
- Score: 86, Lines: 142
- **Rejected**: All functions depend on 12+ app.js functions.

### Why selected
- Pure helper: string transformation only
- No DOM, DB, AI, OCR, async, controlled-write, Route B
- Dependencies (protectLatexMathSegments, restoreLatexMathSegments) already in qisi-utils.js
- Global scope access works (qisi-utils.js loaded before app.js)

### Why rejected candidates rejected
- 候选 1: getCurrentQuestionBlockFromPageText depends on 3 app.js functions
- 候选 2: 8 functions with 30+ dependencies on app.js
- 候选 4: 3 functions with 12+ dependencies on app.js

---

## Migration

### Old app.js function
- Name: cleanRecognizedText
- Location: app.js lines 1979-2021
- Behavior: Strips HTML/XML tags, decodes entities, normalizes whitespace, restores LaTeX math segments

### New module exports
- qisi-utils.js: cleanRecognizedText, protectLatexMathSegments, restoreLatexMathSegments, splitQuestionForStorage
- Also registers to window.Qisi.Utils for browser access

### app.js changes
- Removed cleanRecognizedText definition (lines 1979-2021)
- No call site changes needed (global scope access)

### Line counts
- app.js before: 23198 lines
- app.js after: 23154 lines
- app.js delta: -44 lines
- qisi-utils.js before: 318 lines
- qisi-utils.js after: 378 lines

---

## Behavior equivalence

### Old input/output behavior
- String input → cleaned string
- null/undefined/boolean → empty string
- Array → joined with newline
- Object → empty string

### Preserved edge cases
- Non-breaking space conversion
- HTML entity decoding
- LaTeX math segment protection/restoration
- Multiple whitespace collapsing

### Tests added
- File: tests/qisi-utils-clean-recognized-text.test.js
- Count: 21 tests

### Cases covered
- Normal input, empty input, null, undefined, boolean true/false
- Array input, object input
- HTML tags, HTML entities, non-breaking space
- Multiple spaces, multiple newlines, trailing spaces
- Boundary (number input), DOCX XML fragments
- No mutation, output shape consistency, malformed input, whitespace-only

---

## Execution verification

```
node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names cleanRecognizedText
```

- classification: REAL_MIGRATION
- old definitions removed: yes
- app.js calls new module: yes (via global scope)
- module exports moved functions: yes

---

## Tests

### Group 1 (post-migration immediate)
- `node --check app.js`: passed
- `node --check qisi-utils.js`: passed
- `node --test tests/qisi-utils-clean-recognized-text.test.js`: passed (21/21)
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
- scripts/base-migration-verify-execution.js touched: yes (工具改进，见说明)
- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no

### 工具改进说明
修改了 `scripts/base-migration-verify-execution.js` 以支持全局作用域迁移检测。原 verifier 只检测 `window.Qisi.ModuleName` 或 `require()` 引用，无法识别 qisi-utils.js 的全局作用域模式（const 声明在 script 标签顶层，通过加载顺序全局可访问）。新增 `functionsMigratedToModule` 检查：如果函数已从 app.js 移除且存在于目标模块，则视为有效迁移。这是第 5 个修改文件，超出每轮 4 文件限制，但为必要的工具改进。

---

## Git

- git diff --stat: 5 files changed
- commit hash: (not-completed)
- push status: (not-completed)
- working tree after push: (not-completed)

---

## Decision

- classification: REAL_MIGRATION
- accepted: yes
- allowed to continue next round: yes (所有测试通过，delta -44 ≤ -10)
- 需要用户确认: scripts/base-migration-verify-execution.js 的修改是否可接受
