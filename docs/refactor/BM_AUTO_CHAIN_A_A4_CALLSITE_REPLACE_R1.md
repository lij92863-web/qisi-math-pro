# BM-AUTO Chain A A4 Callsite Replace R1

Stage: BM-AUTO-CHAIN-A-A4-CALLSITE-REPLACE-R1
Branch: main
Start commit: 693be01
Classification: CALLSITE_PARTIAL

## Objective

Replace only A4 callsites classified as DISPLAY_ONLY_PATH and LOW risk.

## Changed files

- app.js
- docs/refactor/BM_AUTO_CHAIN_A_A4_CALLSITE_REPLACE_R1.md
- docs/refactor/BM_AUTO_CHAIN_A_A4_CALLSITE_MAP.md
- docs/refactor/BM_AUTO_CHAIN_A_A4_RISK_MATRIX.md

## Replacement

Replaced one LOW/DISPLAY_ONLY callsite:

```js
cleanDisplayFieldsOnly(q);
```

with:

```js
window.Qisi.Utils.cleanDisplayFieldsOnly(q);
```

Location:

- cleanSingleDraftForSave display-field cleanup after raw evidence preservation

## Deferred

No PDF, batch save, draft write, controlled-write adjacent, UNKNOWN, MEDIUM, or HIGH callsites were replaced in R1.

Wrappers remain in app.js.

## Verification

- staged verifier classification: CALLSITE_PARTIAL
- node --check app.js: passed
- node --check qisi-utils.js: passed
- fixture tests: passed, 55 passed, 0 failed, 0 skipped, 0 todo
- staged migration tests: passed, 7 passed
- base-migration-execution-gate: passed, 15 passed
- pdf-route-b-hold: passed, 6 passed
- verify:batch-safety: passed
- preflight: passed, ok true, realApiCalled false
- dry-run: passed, ok true, realApiCalled false

## Safety

- qisi-utils changed in this stage: no
- tests changed in this stage: no
- scripts changed in this stage: no
- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no

## Decision

- R1 accepted: yes
- continue to R2/R3 after commit: only under the long-run task rules

