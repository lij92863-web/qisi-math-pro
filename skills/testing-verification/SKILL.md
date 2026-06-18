---
name: testing-verification
description: Use when writing tests, changing test fixtures, running verification, or interpreting failures.
---

# Testing and Verification Skill

## Purpose

Convert coding work into verifiable results.

## Default command ladder

Use this order:

```bash
npm run check
npm test
npm run smoke:batch:mock
npm run verify:safe
```

## Safe final gate

The default final gate is:

```bash
npm run verify:safe
```

Do not replace it with a weaker command.

## Mock smoke policy

Mock smoke must not call real AI/OCR.

If any test path reaches:

- `/api/ai/chat`
- `/api/ai/ocr`
- network OCR
- paid upstream API

then the test must fail unless the task is explicitly a real-AI/OCR task.

## Fixture policy

Good fixtures represent historical bugs.

Do not simplify or delete fixtures that encode:

- DOCX stable chain
- PDF known-bad jump-back
- ambiguous option value
- duplicate question marker
- missing answer/solution
- cross-page support parsing

## Test change policy

Allowed:

- add failing test for a real bug
- add fixture for a new edge case
- update expected output when behavior intentionally changes and task says so

Forbidden:

- weaken assertions to make broken code pass
- delete a failing test because it is inconvenient
- change known-bad fixture to avoid fail-closed logic
- remove no-real-AI/OCR guards

## Failure handling

If a test fails:

1. Identify failing command.
2. Identify exact failing test.
3. Decide whether failure is in scope.
4. Fix only if in scope.
5. If out of scope, stop and report.

## Final report

Always include:

```text
Commands run:
Pass/fail:
Failing tests, if any:
Whether real AI/OCR was called:
```