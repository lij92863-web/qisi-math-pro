# BM-AUTO-STRICT-RUN-CORRECTION

## Stage: BM-AUTO-STRICT-RUN-CORRECTION
## Branch: main
## Start commit: 5cf30ad
## End commit: (not-completed)

---

## Why correction is needed

BM-AUTO-STRICT-RUN 已完成 5 轮，但 Round 1 提交 `6150a63` 修改了 `scripts/base-migration-verify-execution.js`，放宽了 REAL_MIGRATION 判定：

- 新增了 `functionsMigratedToModule` 逻辑
- 允许在 app.js 没有显式调用 `window.Qisi.*` 的情况下，仅凭"旧函数定义已删除 + 模块中存在同名函数"判定 REAL_MIGRATION

这违反了原边界：迁移轮次不得修改 BM-AUTO verifier / score / inventory / diff-scope。

---

## Round 1 protocol violation

- `scripts/base-migration-verify-execution.js` was modified during a migration round
- verifier accepted global-scope-only migration
- This allowed Round 1-5 to pass without explicit `window.Qisi.Utils` references in app.js

---

## Correction

1. **app.js now explicitly calls `window.Qisi.Utils.*`**
   - All 5 migrated functions now use explicit module calls
   - cleanRecognizedText: 224 call sites updated
   - mathSignalCount: 29 call sites updated
   - extractRelevanceTokens: 2 call sites updated
   - finalChoiceAnswerText: 9 call sites updated
   - cleanFormulaOcrText: 1 call site updated

2. **verifier again requires explicit app module reference**
   - Removed `functionsMigratedToModule` fallback logic
   - REAL_MIGRATION now requires `appCallsNewModule === true`
   - Reason message updated to "app explicitly calls new module"

3. **test added to reject global-scope-only migration**
   - Test: "rejects global-scope-only migration without explicit app module call"
   - Verifies that SCAFFOLD_ONLY is returned when app.js doesn't explicitly call the module

4. **test added for qisi-utils strict REAL_MIGRATION sample**
   - Test: "qisi-utils migrated helpers are explicit REAL_MIGRATION sample"
   - Verifies that the 5 migrated helpers pass strict REAL_MIGRATION classification

---

## Changed files

- app.js: 265 call sites updated to use `window.Qisi.Utils.*`
- scripts/base-migration-verify-execution.js: removed global-scope fallback
- tests/base-migration-execution-gate.test.js: added 2 new tests
- docs/refactor/BM_AUTO_STRICT_RUN_CORRECTION.md: this document

---

## Tests run

- node --check app.js: passed
- node --check qisi-utils.js: passed
- node --check scripts/base-migration-verify-execution.js: passed
- node --test tests/base-migration-execution-gate.test.js: passed (15/15)
- node --test tests/qisi-utils-clean-recognized-text.test.js: passed (21/21)
- node --test tests/qisi-utils-math-signal-count.test.js: passed (16/16)
- node --test tests/qisi-utils-extract-relevance-tokens.test.js: passed (17/17)
- node --test tests/qisi-utils-final-choice-answer-text.test.js: passed (17/17)
- node --test tests/qisi-utils-clean-formula-ocr-text.test.js: passed (15/15)
- node --test tests/pdf-route-b-hold.test.js: passed (6/6)
- npm.cmd run verify:safe: passed (20/20)
- npm.cmd run verify:batch-safety: passed (20/20)
- npm.cmd run smoke:batch:mock: passed (20/20)
- npm.cmd run verify:pdf-known-bad: passed (65/65)
- node --test tests/pdf-support-controlled-write-answer-ownership.test.js: passed (21/21)
- node scripts/pdf-master-browser-runner.js preflight: passed
- node scripts/pdf-master-browser-runner.js dry-run: passed
- npm.cmd run verify:diff-scope: passed

---

## Safety

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

## Decision

- 5 helper migrations accepted after correction: yes
- allowed to continue Round 6: no, user review required first
- next recommended stage: user review, then BM-AUTO-STRICT-RUN Round 6 only after approval
