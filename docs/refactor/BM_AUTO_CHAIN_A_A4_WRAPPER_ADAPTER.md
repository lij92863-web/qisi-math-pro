# BM-AUTO Chain A A4 Wrapper Adapter

Stage: BM-AUTO-CHAIN-A-A4-WRAPPER-ADAPTER
Branch: main
Start commit: 7e69f48
Classification: WRAPPER_ADAPTER

## Changed files

- app.js
- scripts/bm-a4-helper-extract.js
- docs/refactor/BM_AUTO_CHAIN_A_A4_WRAPPER_ADAPTER.md
- docs/refactor/BM_AUTO_CHAIN_A_A4_FIXTURE_COVERAGE.md
- docs/refactor/BM_AUTO_CHAIN_A_A4_HELPER_EXTRACTION_REPORT.md

## What changed

- app.js A4 full helper bodies were replaced with thin wrappers.
- qisi-utils.js already contains implementations from 7e69f48.
- Existing callsites remain unchanged.
- No R1/R2/R3 callsite replacement is included in this commit.
- scripts/bm-a4-helper-extract.js now correctly extracts multi-line expression arrow wrappers without capturing following helper declarations.

## VM fixture recovery

Previous failure:

```text
SyntaxError: Identifier 'cleanDisplayOptionsForBatchSave' has already been declared
```

Root cause: D. helper-extract extracted an overly broad range. For multi-line expression arrow wrappers, it searched for the next `{` after `=>` before checking whether the arrow body was actually a block. That caused helper sources to include following declarations through `optionTextHasContent`.

Fix: scripts/bm-a4-helper-extract.js now inspects the first non-whitespace character after `=>`. It uses brace matching only for block bodies and uses the terminating semicolon for expression arrow bodies.

Business behavior changed: no.

## Troubleshooting

The duplicate VM declaration was not caused by app.js wrapper business behavior. It was caused by extraction output:

- before fix: each A4 helper source ended at line 1950, so the VM-loaded source redeclared helper names.
- after fix: each wrapper source covers only its own two-line declaration.

## Wrappers

- cleanDisplayTextForBatchSave -> window.Qisi.Utils.cleanDisplayTextForBatchSave
- cleanDisplayOptionsForBatchSave -> window.Qisi.Utils.cleanDisplayOptionsForBatchSave
- addWarningOnce -> window.Qisi.Utils.addWarningOnce
- cleanDisplayFieldsOnly -> window.Qisi.Utils.cleanDisplayFieldsOnly

## Tests

- staged verifier classification: WRAPPER_ADAPTER
- node --check app.js: passed
- node --check qisi-utils.js: passed
- node --check scripts/bm-a4-helper-extract.js: passed
- node --check scripts/bm-a4-fixture-coverage-check.js: passed
- node --check scripts/bm-a4-staged-migration-verify.js: passed
- fixture tests: passed, 55 passed, 0 failed, 0 skipped
- fixture coverage: passed, 51 required tags present, 0 missing
- staged migration tests: passed, 7 passed
- fixture coverage tests: passed, 4 passed
- base-migration-execution-gate: passed, 15 passed
- pdf-route-b-hold: passed, 6 passed
- verify:batch-safety: passed
- preflight: passed, ok true, realApiCalled false
- dry-run: passed, ok true, realApiCalled false

## Safety

- qisi-utils changed in this stage: no
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

- wrapper adapter accepted: yes
- continue to R1 after commit: yes

## Note

- BM_AUTO_CHAIN_A_A4_QISI_UTILS_IMPL.md from 7e69f48 had an unresolved commit reference.
- This was corrected during the deep campaign final audit (Phase 11 docs cleanup).

