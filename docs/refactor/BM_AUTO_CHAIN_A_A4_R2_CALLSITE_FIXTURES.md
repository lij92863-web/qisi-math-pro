# BM-AUTO Chain A A4 R2 Callsite Fixtures

Stage: BM-AUTO-CHAIN-A-A4-R2-CALLSITE-FIXTURES
Branch: main
Start commit: 583e024 stage BM-AUTO audit current A4 state

## R2 Scope

R2 covers these classification paths:
- OPTION_REPAIR_PATH
- FINAL_VALIDATION_PATH
- VISUAL_REPAIR_PATH
- WARNING_MUTATION_PATH

## R2 Candidate Callsites

Only MEDIUM-risk callsites without BATCH_SAVE_PATH, DRAFT_WRITE_PATH, or PDF_PATH markers are eligible for R2 replacement.

| ID | Helper | Line | Classification | Context | Existing fixture? | New fixture tag | Covered | Replace allowed | Reason |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| R2-3739 | addWarningOnce | 3739 | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | After option extraction from raw evidence, warns about option count | Generic addWarningOnce fixtures exist | [A4:R2:option-repair:3739] [A4:R2:warning-mutation:3739] | yes | yes | MEDIUM risk, no R3 markers, warning-only context |
| R2-19632 | addWarningOnce | 19632 | OPTION_REPAIR_PATH, WARNING_MUTATION_PATH | Editor source parsing fails to find A/B/C/D options format | Generic addWarningOnce fixtures exist | [A4:R2:option-repair:19632] [A4:R2:warning-mutation:19632] | yes | yes | MEDIUM risk, no R3 markers, warning-only context |
| R2-20021 | addWarningOnce | 20021 | OPTION_REPAIR_PATH, FINAL_VALIDATION_PATH, WARNING_MUTATION_PATH, DISPLAY_ONLY_PATH | Choice question has missing options, warns without synthesizing | Generic addWarningOnce fixtures exist | [A4:R2:option-repair:20021] [A4:R2:final-validation:20021] [A4:R2:warning-mutation:20021] | yes | yes | MEDIUM risk, no R3 markers, validation-only context |
| R2-20042 | addWarningOnce | 20042 | VISUAL_REPAIR_PATH, WARNING_MUTATION_PATH | Question has no source image, warns only | Generic addWarningOnce fixtures exist | [A4:R2:visual-repair:20042] [A4:R2:warning-mutation:20042] | yes | yes | MEDIUM risk, no R3 markers, visual-repair context |
| R2-20329 | cleanDisplayFieldsOnly | 20329 | OPTION_REPAIR_PATH, DISPLAY_ONLY_PATH | Post-processing display cleaning in rows iteration | Generic cleanDisplayFieldsOnly fixtures exist | [A4:R2:option-repair:20329] | yes | yes | MEDIUM risk, no R3 markers, display-only cleaning |

## Fixture Semantic Coverage

### OPTION_REPAIR_PATH

Each OPTION_REPAIR_PATH callsite fixture verifies:
- legal image token preserved
- legal formula token preserved
- bad placeholder removed
- malformed option entry follows current behavior
- short options remain incomplete if current behavior says so
- no guessed options
- no support attachment inferred
- no answer inferred

### FINAL_VALIDATION_PATH

Each FINAL_VALIDATION_PATH callsite fixture verifies:
- does not synthesize missing answer
- does not synthesize missing options
- does not convert empty to valid
- bad placeholder behavior follows current behavior
- legal media tokens preserved
- warning behavior unchanged if applicable

### VISUAL_REPAIR_PATH

Each VISUAL_REPAIR_PATH callsite fixture verifies:
- visual cleanup preserves legal tokens
- visual cleanup removes bad placeholders only
- non-target fields preserved
- does not attach image/support
- does not infer answer/solution

### WARNING_MUTATION_PATH

Each WARNING_MUTATION_PATH callsite fixture verifies:
- addWarningOnce mutates only warnings
- duplicate warning not added
- existing warning preserved
- existing non-warning fields preserved
- malformed warnings follows current behavior

## Decision

All 5 R2 candidate callsites have callsite-specific fixtures.
All 5 are covered and replaceable.
R2 may proceed to Phase 3 replacement.
