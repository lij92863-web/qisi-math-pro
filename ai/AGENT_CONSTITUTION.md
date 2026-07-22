# Agent Constitution — TEX题库

This document defines non-negotiable rules for all coding agents.

## 1. Highest-level project principle

The project optimizes for **not polluting the question bank**.

A missing answer is acceptable.  
A wrongly attached answer or solution is unacceptable.

When uncertain, fail closed.

## 2. Stable chain priority

The DOCX+DOCX batch-import chain is the stable baseline.

Any change to PDF support, OCR, AI recognition, review UI, image handling, or batch workflows must not regress DOCX+DOCX behavior.

Required invariant:

```text
PDF/AI/OCR changes must not break DOCX+DOCX.
```

## 3. PDF support safety principle

PDF support alignment has only three acceptable outcomes:

1. `full`: all expected question numbers are reliable and aligned.
2. `prefix`: only the reliable prefix is attached; the rest is fused/withheld.
3. `fail-closed`: no answer/solution is attached automatically.

Forbidden outcomes:

- Attach after a missing number.
- Attach after jump-back.
- Attach after duplicate question number.
- Attach answer and solution when their question sequences disagree.
- Attach based on semantic similarity.
- Attach based on keywords such as triangle, vector, sin, cos, area, etc.
- Attach based only on AI output field `question`.

## 4. AI output distrust principle

AI/OCR output is evidence, not truth.

Never directly trust:

- `question`
- `questionNumber`
- `sourceOrder`
- answer text that looks like option value
- solution text that is too short or placeholder-like

Always combine:

- expected question numbers
- source order
- answer item sequence
- solution item sequence
- duplicate detection
- jump-back detection
- answer/solution pair consistency
- objective answer normalization rules
- existing draft type/options

## 5. app.js boundary principle

`app.js` is a coordinator, not a dumping ground.

Allowed in `app.js`:

- UI state
- event handlers
- orchestration
- calling `qisi-*.js` modules
- writing UI status/progress
- small glue code

Forbidden in `app.js` unless explicitly authorized:

- new large parsing algorithms
- new alignment algorithms
- new OCR/AI business logic
- new field-level write policies
- large refactors
- unrelated formatting
- broad replacement of existing workflow

New complex logic must go into a focused `qisi-*.js` module with tests.

## 6. Testing before trust

A feature is not considered working because it “looks right” in the browser.

A feature is considered minimally acceptable only after:

```bash
npm run check
npm test
npm run smoke:batch:mock
npm run verify:safe
```

The default final gate is:

```bash
npm run verify:safe
```

## 7. Mock-first policy

Default development must use mocks and fixtures.

Do not call real:

- `/api/ai/chat`
- `/api/ai/ocr`
- DashScope upstream APIs
- vision OCR
- paid model calls

Real AI/OCR tests require a separate task file with explicit permission, cost scope, input files, and stop conditions.

## 8. Minimal change policy

Every change must be the smallest sufficient change for the task.

Do not:

- “also improve” unrelated code
- reformat whole files
- rename unrelated symbols
- migrate architecture during a bugfix
- change tests to fit broken behavior
- continue to the next stage automatically

## 9. Evidence preservation

Before cleaning display text, preserve raw evidence where applicable.

Do not destroy:

- raw OCR text
- raw PDF support text
- source page image references
- source trace
- warnings
- diagnostics
- confidence signals

Clean display fields only after evidence is preserved.

## 10. Human-review boundary

The system may generate drafts automatically, but final question-bank insertion is a high-risk action.

Do not bypass review safeguards.

Do not silently submit draft questions to the formal question bank unless the current task explicitly requires and tests it.

## 11. Stop conditions

Stop instead of guessing when:

- required file is missing
- working tree is dirty
- task requires forbidden file edits
- real AI/OCR is needed
- sequence reliability cannot be established
- answer/solution alignment conflicts
- a test failure is outside task scope
- the task objective has already been achieved
