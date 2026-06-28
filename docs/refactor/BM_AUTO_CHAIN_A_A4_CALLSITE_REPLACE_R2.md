# BM-AUTO Chain A A4 Callsite Replace R2

Stage: BM-AUTO-CHAIN-A-A4-CALLSITE-REPLACE-R2
Branch: main
Start commit: a88c010 stage BM-AUTO add A4 R2 callsite fixtures

## Replaced Callsites

All 5 MEDIUM-risk R2 callsites replaced with explicit window.Qisi.Utils.* calls.

| ID | Line | Old Call | New Call | Classification |
| --- | ---: | --- | --- | --- |
| R2-3739 | 3739 | addWarningOnce(q, ...) | window.Qisi.Utils.addWarningOnce(q, ...) | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH |
| R2-19632 | 19632 | addWarningOnce(q, ...) | window.Qisi.Utils.addWarningOnce(q, ...) | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH |
| R2-20021 | 20021 | addWarningOnce(q, ...) | window.Qisi.Utils.addWarningOnce(q, ...) | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH |
| R2-20042 | 20042 | addWarningOnce(q, ...) | window.Qisi.Utils.addWarningOnce(q, ...) | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH |
| R2-20329 | 20329 | cleanDisplayFieldsOnly(q) | window.Qisi.Utils.cleanDisplayFieldsOnly(q) | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH |

## Deferred Callsites

No R2-scoped callsites were deferred. All 5 eligible MEDIUM-risk callsites were replaced.

## Blocked Callsites

No BLOCK-classified callsites existed in R2 scope.

## Fixture Tags For Each Replaced Callsite

| Callsite | Fixture Tags |
| --- | --- |
| R2-3739 | [A4:R2:option-repair:3739], [A4:R2:warning-mutation:3739] |
| R2-19632 | [A4:R2:option-repair:19632], [A4:R2:warning-mutation:19632] |
| R2-20021 | [A4:R2:option-repair:20021], [A4:R2:final-validation:20021], [A4:R2:warning-mutation:20021] |
| R2-20042 | [A4:R2:visual-repair:20042], [A4:R2:warning-mutation:20042] |
| R2-20329 | [A4:R2:option-repair:20329] |

## Staged Verifier Classification

- Classification: CALLSITE_PARTIAL
- Explicit count: 10 (5 wrappers + 5 R2 replacements)
- Naked calls remaining: 110 (all HIGH-risk R3 callsites)
- Wrappers: 4, all still present

## Tests

| Test Suite | Tests | Pass | Fail | Skip |
| --- | ---: | ---: | ---: | ---: |
| A4 fixtures | 79 | 79 | 0 | 0 |
| A4 fixture coverage | 8 | 8 | 0 | 0 |
| A4 staged migration | 7 | 7 | 0 | 0 |
| qisi-utils batch media tokens | 27 | 27 | 0 | 0 |
| base-migration-execution-gate | 15 | 15 | 0 | 0 |
| pdf-route-b-hold | 6 | 6 | 0 | 0 |
| verify:safe | 674 | 674 | 0 | 0 |
| verify:batch-safety | 20 | 20 | 0 | 0 |
| preflight | n/a | ok:true | n/a | n/a |
| dry-run | n/a | ok:true | n/a | n/a |

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
- wrappers deleted: no
- app.js lines changed: 5 call substitutions only

## Decision

- R2 replacement successful: yes
- All 5 R2 MEDIUM-risk callsites replaced with explicit window.Qisi.Utils.* calls
- R3 may proceed: no — 110 HIGH-risk naked callsites remain, blocked on R3 fixtures and safety analysis
- Wrapper removal allowed: no — CALLSITE_PARTIAL classification still applies
