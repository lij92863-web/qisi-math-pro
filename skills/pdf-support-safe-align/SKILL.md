---
name: pdf-support-safe-align
description: Use when modifying PDF answer/solution parsing, support alignment, fail-closed gates, block parser, or controlled write.
---

# PDF Support Safe Align Skill

## Purpose

Prevent unsafe PDF answer/solution attachment.

This is the highest-risk technical area in the project.

## Core rule

```text
宁可空，也不能错挂。
```

Missing answer/solution is acceptable.  
Wrongly attached answer/solution is unacceptable.

## Relevant modules

- `qisi-support-parser.js`
- `qisi-support-repair.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-support-controlled-write.js`
- PDF-related glue in `app.js`
- `tests/pdf-support-aligner.test.js`
- `tests/pdf-support-block-parser.test.js`
- `tests/batch-smoke-mock.test.js`
- `tests/fixtures/pdf-support-known-bad.js`

## Allowed alignment modes

Only these modes are valid:

- `full`
- `prefix`
- `fail-closed`

## Sequence reliability checks

Before attaching support, validate:

- normalized question numbers
- expected question numbers
- continuous prefix
- strictly increasing order
- duplicate markers
- jump-back markers
- unknown markers
- answer/solution sequence compatibility
- parser-vs-legacy field decisions
- objective answer normalization

## Forbidden alignment strategies

Never attach based on:

- semantic similarity
- keyword overlap
- math structure tokens
- triangle/vector/sin/cos/area keywords
- topic similarity
- AI-provided `question` alone
- nearest text block without sequence validation
- “looks right” visual judgment

## Objective answer rules

For objective questions:

- If answer is already a valid option label, preserve it.
- If answer is option value, convert only when exactly one option matches.
- If multiple options match the value, reject.
- For multiple-choice questions, reject option-value conversion; accept only valid label strings such as `ACD`.
- Parser answer must not overwrite safer legacy objective label.

## Solution rules

A parser solution may be kept when the answer is rejected only if field-level controlled write explicitly allows it and the sequence gate is safe.

Do not attach solution when sequence gate fails closed.

## Known-bad requirement

Known-bad sequence examples must remain protected, especially patterns like:

```text
1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 2
```

Such jump-back behavior must not attach later wrong answers.

## Required tests

Run:

```bash
npm run verify:pdf-known-bad
npm test
npm run smoke:batch:mock
npm run verify:safe
```

`verify:pdf-known-bad` wraps the current PDF support known-bad and fail-closed regression entrypoints.

`local-test-materials/` is local-only and must not be read by default PDF safety checks. Real PDF file verification requires a separate real-file task.

When changing parser/alignment logic, include or preserve tests for:

- normal full
- prefix only
- missing number
- duplicate number
- jump-back number
- unknown marker
- cross-page support
- formula numbers not treated as question markers
- ambiguous objective answer rejection
- multi-choice value rejection
- parser solution kept only when safe

## Final report requirements

State:

```text
PDF support mode affected:
Known-bad behavior preserved:
Field-level controlled write affected:
Tests:
Risk:
```
