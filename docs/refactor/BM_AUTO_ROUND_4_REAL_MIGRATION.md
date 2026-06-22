# BM-AUTO Round 4 REAL_MIGRATION

## Stage: BM-AUTO-ROUND-4
## Branch: main
## Start commit: 8ba5d36
## Target helper group: finalChoiceAnswerText
## Target module: qisi-utils.js
## Changed files: app.js, qisi-utils.js, tests/qisi-utils-final-choice-answer-text.test.js, docs/refactor/

---

## Purpose

将 `finalChoiceAnswerText` 从 app.js 迁移到 qisi-utils.js。该函数是纯选择题答案提取工具，仅依赖 `cleanRecognizedText`。

---

## Migration

- Old location: app.js lines 13541-13558
- app.js delta: -20 lines
- classification: REAL_MIGRATION

---

## Tests

All tests passed:
- finalChoiceAnswerText tests: 17/17
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
- allowed to continue next round: yes
