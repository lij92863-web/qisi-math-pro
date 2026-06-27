# BM-AUTO Chain A A4 Tooling Plan

Stage: BM-AUTO-CHAIN-A-A4-TOOLING
Branch: main
Start commit: 3673290635b0e46a0a0b35d36147d3c4066628f2

## Goal

Build read-only tooling and fixture baselines for A4 staged migration before moving any A4 production behavior. The tools must support helper extraction, callsite mapping, risk classification, fixture coverage, documentation audit, staged migration verification, and final summary generation.

## Tools To Add

- scripts/bm-a4-helper-extract.js
- scripts/bm-a4-callsite-map.js
- scripts/bm-a4-risk-classifier.js
- scripts/bm-a4-fixture-coverage-check.js
- scripts/bm-a4-doc-audit.js
- scripts/bm-a4-staged-migration-verify.js
- scripts/bm-a4-long-run-report.js

## Tests To Add

- tests/qisi-app-display-cleaners-callsite-map.test.js
- tests/qisi-app-display-cleaners-fixture-coverage.test.js
- tests/qisi-app-display-cleaners-doc-audit.test.js
- tests/qisi-app-display-cleaners-staged-migration.test.js
- tests/qisi-app-display-cleaners-fixtures.test.js

## Forbidden Files

- qisi-pdf-support-controlled-write.js
- qisi-pdf-support-aligner.js
- qisi-pdf-support-block-parser.js
- qisi-pdf-answer-only-extraction.js
- qisi-pdf-answer-extraction-quality.js
- scripts/base-migration-verify-execution.js
- scripts/base-migration-inventory.js
- scripts/base-migration-score.js
- scripts/verify-diff-scope.js
- scripts/pdf-master-browser-runner.js
- main.html
- app.css
- package.json
- package-lock.json
- AGENTS.md
- ai/
- skills/

## Safety

- Tooling must not execute app.js.
- Tooling must not call DOM, runner, AI, OCR, or APIs.
- Tooling must not modify app.js or qisi-utils.js in this phase.
- Fixture tests execute only extracted helper snippets inside a vm sandbox.

## Tests

- Tool syntax checks must pass.
- Tool unit tests must pass.
- Fixture tests must pass.
- Fixture coverage checker must pass.
- Baseline safety gates must remain green.

## Exit Criteria

- Helper extraction report generated.
- Callsite map generated.
- Risk matrix generated.
- Fixture coverage report generated.
- Wrapper-first gate document generated.
- Diff scope passes for scripts/bm-a4-*.js, tests/qisi-app-display-cleaners-*.test.js, and docs/refactor/**.

## Decision

- A4 tooling phase may proceed: yes.
- A4 production behavior changed in tooling phase: no.
