# BM-AUTO Round 3 REAL_MIGRATION

## Stage: BM-AUTO-ROUND-3
## Branch: main
## Start commit: 3f2de64
## Target helper group: extractRelevanceTokens
## Target module: qisi-utils.js
## Changed files: app.js, qisi-utils.js, tests/qisi-utils-extract-relevance-tokens.test.js, docs/refactor/

---

## Purpose

将 `extractRelevanceTokens` 从 app.js 迁移到 qisi-utils.js。该函数是纯文本分词工具，仅依赖 `cleanRecognizedText`。

---

## Migration

- Old location: app.js lines 3949-3970
- app.js delta: -24 lines
- classification: REAL_MIGRATION

---

## Tests

All tests passed:
- extractRelevanceTokens tests: 17/17
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
