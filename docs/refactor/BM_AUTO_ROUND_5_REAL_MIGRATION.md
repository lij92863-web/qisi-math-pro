# BM-AUTO Round 5 REAL_MIGRATION

## Stage: BM-AUTO-ROUND-5
## Branch: main
## Start commit: f6a6a3f
## Target helper group: cleanFormulaOcrText
## Target module: qisi-utils.js
## Changed files: app.js, qisi-utils.js, tests/qisi-utils-clean-formula-ocr-text.test.js, docs/refactor/

---

## Purpose

将 `cleanFormulaOcrText` 从 app.js 迁移到 qisi-utils.js。该函数是纯 OCR 文本清理工具，仅依赖 `cleanRecognizedText`。

---

## Migration

- Old location: app.js lines 2123-2139
- app.js delta: -18 lines
- classification: REAL_MIGRATION

---

## Tests

All tests passed:
- cleanFormulaOcrText tests: 15/15
- base-migration-execution-gate: 13/13
- pdf-route-b-hold: 6/6
- verify:safe: 20/20
- verify:batch-safety: 20/20
- smoke:batch:mock: 20/20
- verify:pdf-known-bad: 65/65
- controlled-write ownership: 21/21
- preflight: pass
- dry-run: pass
- verify:diff-scope: pass

---

## Decision

- classification: REAL_MIGRATION
- accepted: yes
- allowed to continue next round: NO (Round 5 is the maximum)
