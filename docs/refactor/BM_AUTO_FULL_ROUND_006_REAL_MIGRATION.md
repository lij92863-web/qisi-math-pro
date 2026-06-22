# BM-AUTO Full Round 006 REAL_MIGRATION

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Branch: main
Start commit: `a03f57d`
End commit: `ca51b17`
Target helper group: `findNode`
Target module: `qisi-utils.js`
Changed files:

- `app.js`
- `qisi-utils.js`
- `tests/qisi-utils-find-node.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_006_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_ROUND_006_REAL_MIGRATION.md`

## Purpose

- Move the pure recursive knowledge-tree lookup helper from `app.js` to `qisi-utils.js`.

## Candidate Audit

- selected candidate: `findNode`
- why eligible: deterministic tree lookup, no mutation, no DOM, no DB/storage, no async/network, no AI/OCR, no PDF safety, no Route B.
- why rejected nearby candidates were rejected:
  - `questionMatchesLibraryFilters`: closure state and `hasText` dependency.
  - `buildKnowledgeCounts`: closure state via `questions.value` and `getQuestionKnowledge`.
  - `getAllChildrenNames`: below 10 removed app.js lines.
  - `flattenKnowledgeTree`: below 10 removed app.js lines.

## Migration

- old app.js function names: `findNode`
- old app.js approximate locations: `app.js:229-238`
- old behavior summary: depth-first recursive search over `nodes`; returns the first node whose `name` equals the requested name; returns `null` when not found.
- new module exports: `window.Qisi.Utils.findNode` and Node export `findNode`
- app.js explicit call sites: `window.Qisi.Utils.findNode(sourceTree, activeKnowledge.value)`
- before lines: 23063
- after lines: 23052
- delta: -11

## Behavior Equivalence

- preserved cases: top-level match, nested match, empty list, `null`, `undefined`, exact name matching, malformed/nullish nodes, duplicate first-match behavior.
- tests added: `tests/qisi-utils-find-node.test.js`
- edge cases: no mutation and object-or-null output shape.

## Execution Verification

- exact command: `node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names findNode`
- classification: `REAL_MIGRATION`
- old definitions removed: yes
- app calls new module: yes
- module exports moved functions: yes

## Tests

- `node --check app.js`: passed
- `node --check qisi-utils.js`: passed
- `node --test tests/qisi-utils-find-node.test.js`: passed, 12 tests
- `node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names findNode`: passed, `REAL_MIGRATION`
- `node --test tests/base-migration-execution-gate.test.js`: passed, 15 tests
- `node --test tests/pdf-route-b-hold.test.js`: passed, 6 tests
- `npm.cmd run verify:safe`: passed, 397 tests in full `npm test`, no skipped
- `npm.cmd run verify:batch-safety`: passed
- `npm.cmd run smoke:batch:mock`: passed, 20 tests
- `npm.cmd run verify:pdf-known-bad`: passed, 65 tests
- `node --test tests/pdf-support-controlled-write-answer-ownership.test.js`: passed, 21 tests
- `node scripts/pdf-master-browser-runner.js preflight`: passed, `ok:true`, `realApiCalled:false`
- `node scripts/pdf-master-browser-runner.js dry-run`: passed, `ok:true`, `realApiCalled:false`

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
- verifier changed: no

## Decision

- classification: `REAL_MIGRATION`
- accepted/rejected: accepted
- continue next round: yes

