# Testing Guide — 奇思数学 Pro

## 1. Existing commands

Use the commands already defined in `package.json`.

```bash
npm run check
npm test
npm run smoke:batch:mock
npm run verify:safe
npm run verify
```

Default final gate:

```bash
npm run verify:safe
```

## 2. Command meanings

### `npm run check`

Syntax-checks important JavaScript files.

Use after editing any `.js` file.

### `npm test`

Runs Node test suite.

Use after editing any module or test.

### `npm run smoke:batch:mock`

Runs batch-import mock smoke tests.

This is mandatory for batch import, DOCX, PDF support, and review-related logic.

### `npm run verify:safe`

Runs safe full verification:

```text
check + test + smoke:batch:mock
```

Use before final report and before commit.

### `npm run test:ai-proxy`

Real AI proxy smoke. Not allowed by default.

### `npm run test:ai-vision-proxy`

Real vision proxy smoke. Not allowed by default.

## 3. No-real-AI/OCR policy

Default tests must not call:

- `/api/ai/chat`
- `/api/ai/ocr`
- DashScope upstream
- paid OCR/vision APIs

If a task requires these calls, create a separate real-test task.

## 4. Test writing rules

When fixing a bug:

1. Add or identify a failing test/fixture.
2. Make the smallest code change.
3. Run the narrow test.
4. Run `npm run verify:safe`.

When adding PDF support logic, include known-bad and fail-closed tests.

When touching DOCX logic, include DOCX stable-chain fixture tests.

When touching review page data transformation, include draft structure tests.

## 5. What not to do

Do not:

- delete failing tests
- weaken assertions to match broken output
- replace known-bad fixture with easier data
- skip smoke test because unit tests pass
- run real AI/OCR inside mock smoke
- claim “works” without command output

## 6. Preferred test naming

Use behavior names:

```text
known bad jump-back sequence does not attach unsafe answers
field-level controlled write rejects ambiguous objective answer
docx stable chain preserves answer and solution
review editor preserves options after source edit
```

Avoid vague names:

```text
test pdf
fix bug
works
```