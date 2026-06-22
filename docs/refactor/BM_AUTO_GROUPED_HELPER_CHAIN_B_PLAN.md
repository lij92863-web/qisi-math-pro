# BM-AUTO Grouped Helper Chain B PLAN
Stage: BM-AUTO-GROUPED-HELPER-MIGRATION-CHAIN-B | Branch: main
Start commit: `58538dd` | Gate commit: `58538dd`

Selected grouped helper: normalizeAnswerSolutionSource + splitAnswerSolutionSections
Target module: qisi-utils.js
Why grouped: normalizeAnswerSolutionSource alone delta < 10; splitAnswerSolutionSections depends on it; combined delta >= 10; gate accepted Chain B

Risk: DOM no | DB no | async no | AI/OCR no | PDF safety no | controlled-write no | Route B no | mutation no | dep: cleanRecognizedText (in qisi-utils)

Allowed: app.js, qisi-utils.js, tests/qisi-utils-answer-solution-sections.test.js, docs/refactor/BM_AUTO_GROUPED_HELPER_CHAIN_B_PLAN.md, docs/refactor/BM_AUTO_GROUPED_HELPER_CHAIN_B_REAL_MIGRATION.md
Forbidden: scripts/*, qisi-pdf-*, main.html, package*, AGENTS.md, ai/, skills/
Stop: delta > -10 | verifier not REAL | failed/skipped/timeout | forbidden file touched
