# BM-AUTO Chain A Batch A4 FIXTURE_PLAN

Stage: BM-AUTO-CHAIN-A-BATCH-A4-FIXTURE-PLAN
Branch: main
Scope: fixture plan only; no A4 migration performed.

## Goal

Lock A4 behavior before any wrapper or migration work. A4 helpers affect display cleaning, option preservation, warning mutation, and final draft field cleanup, so fixture coverage must come first.

## cleanDisplayTextForBatchSave Fixtures

- Empty, null, and undefined input returns empty string.
- Plain recognized text is preserved after qisi-utils cleaning.
- Bad single-bracket image placeholders are stripped.
- Legal [[IMAGE:id]] and [[FORMULA_IMAGE:id]] tokens are preserved.
- Legal includegraphics references are preserved according to current behavior.
- Object/null/undefined literal pollution is cleaned only according to current helper behavior.
- Mixed text with punctuation and bad placeholders preserves readable text spacing.

## cleanDisplayOptionsForBatchSave Fixtures

- Non-array input returns four empty options.
- Short arrays are normalized to four options.
- Extra options beyond A-D are ignored according to current behavior.
- Plain text options are cleaned through cleanDisplayTextForBatchSave.
- Pure legal media-token option is preserved when cleaned text would otherwise be empty.
- Bad image-option placeholders are removed.
- Mixed legal media token plus text remains valid.
- No mutation of original options array.

## addWarningOnce Mutation Fixtures

- Null question or empty message is a no-op.
- First warning creates a warnings array.
- Repeating the same warning does not duplicate it.
- Adding a second warning preserves the first warning.
- Existing warnings array is not silently dropped.
- Mutation is intentional and returns no replacement object contract.

## cleanDisplayFieldsOnly Mutation Fixtures

- Null input returns null.
- Undefined input returns undefined.
- Existing object reference is returned.
- stem, options, answer, and solution are cleaned in place.
- Legal media tokens in stem/options are preserved.
- Bad placeholders are removed from display fields.
- Existing non-target fields are preserved.
- Mutation behavior is explicit and covered.

## Integration Fixtures

- DOCX stable draft with normal text options remains unchanged after field cleaning.
- DOCX draft with pure-image option keeps a legal media token.
- Draft with missing options remains visibly incomplete and is not silently padded with guessed content.
- PDF-created draft field cleanup does not attach or infer support.
- Final validation still blocks unconverted placeholder drafts.

## Acceptance Gate Before A4 Migration

- Fixture tests must pass before any code migration.
- Tests must cover both return values and mutation side effects.
- Tests must include app.js call-site checks if wrapper-first work is attempted.
- verify:safe and verify:batch-safety must pass.
- PDF known-bad must remain fail-closed.

## Conclusion

- A4 direct migration allowed: no.
- Fixture-first required: yes.
- Wrapper-first allowed: yes, only after the fixture suite exists and passes.
- Next recommended task: add A4 focused fixture tests without moving code.


## Historical Status

This document is retained as a historical artifact. It is not an active gate for the current A4 R3 residual campaign.

## Decision

- Historical document retained.
- No production behavior is changed by this documentation normalization.
