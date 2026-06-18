# Stable Chains — 奇思数学 Pro

This document defines behavior that must not regress.

## 1. Stable chain A: DOCX+DOCX batch import

DOCX+DOCX is the primary stable import path.

Required behavior:

- Question file can produce draft questions.
- Answer/support file can attach answers.
- Solution/support file can attach solutions.
- Question numbers remain ordered.
- Options do not get polluted by JSON fragments or unrelated answer text.
- Images stay associated with the correct question when evidence is clear.
- Missing answer/solution is marked as a problem, not silently guessed.
- Review page displays draft fields correctly.
- Submitting to question bank requires review flow.

Regression signals:

- fewer expected questions
- missing stems
- broken option parsing
- answer/solution shifted by one or more questions
- image token appears in the wrong question
- draft review page cannot show or edit LaTeX source
- cleanup destroys raw evidence

Minimum gate:

```bash
npm run smoke:batch:mock
npm run verify:safe
```

## 2. Stable chain B: PDF support fail-closed

PDF support is allowed to attach answers/solutions only when alignment is reliable.

Allowed modes:

- `full`
- `prefix`
- `fail-closed`

Required behavior:

- Known-bad jump-back sequences must not pollute later questions.
- Duplicate markers must stop safe attachment.
- Unknown question markers must not be trusted.
- Answer and solution sequences must be compatible.
- Parser and legacy gates must pass field-level controlled write.
- Objective answers must be normalized safely.
- Multiple-choice option values must not be converted when ambiguous.

Regression signals:

- known-bad fixture writes wrong answers
- answer attaches after question number jumps backward
- solution attaches after answer gate failed
- parser value overwrites safer legacy objective label
- ambiguous option value becomes an answer
- multi-choice option value becomes answer label

Minimum gate:

```bash
npm test
npm run smoke:batch:mock
npm run verify:safe
```

## 3. Stable chain C: Review draft workspace

Required behavior:

- Draft list displays all questions.
- Problem filter shows missing answer, missing solution, missing options, image issues.
- Active draft can be edited through LaTeX source.
- Edits preserve question type/options where possible.
- Image placement tools do not corrupt stem/options.
- Source page images are visually separated from real question figures.
- Clearing draft workspace does not delete formal question bank.

Regression signals:

- draft editor loses options
- image token disappears or moves unexpectedly
- submitted draft becomes editable incorrectly
- cleanup modifies raw evidence
- clearing draft deletes formal bank rows

## 4. Stable chain D: Local AI/OCR boundary

Local server can expose AI/OCR proxy endpoints, but default tests must not call them.

Forbidden by default:

- `/api/ai/chat`
- `/api/ai/ocr`
- paid DashScope upstream calls
- vision OCR calls inside mock tests

Allowed only in explicit real-test tasks:

- `npm run test:ai-proxy`
- `npm run test:ai-vision-proxy`

A real-test task must specify:

- model
- file
- expected cost/range
- success criteria
- abort conditions
- no business-code changes during evidence collection unless explicitly authorized