# Acceptance Criteria — 奇思数学 Pro

Every task must satisfy these criteria before completion.

## 1. General completion checklist

A task is complete only when:

- The requested objective is fulfilled.
- No forbidden file was modified.
- `git diff --stat` only shows task-related files.
- Required tests pass.
- The result is documented.
- Remaining risks are stated.
- The next step is suggested but not executed.

## 2. Required command report

The final report must include:

```text
git status --short:
git diff --stat:
Tests run:
Result:
Commit hash, if committed:
Files changed:
Not done:
Risks:
Next recommended task:
```

## 3. Default verification

For ordinary code changes:

```bash
npm run verify:safe
```

For documentation-only changes:

```bash
npm run verify:safe
```

Documentation-only changes still run safe verification because they should not affect runtime and the project should remain green.

## 4. Batch import acceptance

Batch import changes require:

- DOCX stable chain still passes.
- PDF known-bad behavior still fails closed.
- No real AI/OCR call in mock tests.
- Draft questions preserve `questionNumber`, `stem`, `options`, `answer`, `solution`, `images`, `warnings`, and source trace where applicable.
- Review page still displays recognition summary and problem filters.

## 5. PDF support acceptance

PDF support changes require tests for at least the relevant cases:

- normal full sequence
- prefix sequence
- missing number
- duplicate number
- jump-back number
- unknown marker
- answer/solution mismatch
- objective answer label preservation
- ambiguous option value rejection
- multi-choice value rejection
- parser solution kept when answer rejected if field-level policy allows

## 6. Refactor acceptance

Refactors require:

- no behavior change unless explicitly stated
- before/after tests both green, if possible
- exported API preserved or migration documented
- no broad formatting
- new module has Node/browser export pattern if used in both environments
- `app.js` net complexity reduced or unchanged

## 7. Git acceptance

Commit only when:

- tests pass
- diff is scoped
- commit message names the stage/purpose
- no secrets or generated trash files are included
- no next-stage work is bundled

Recommended commit pattern:

```text
stage <ID> <short objective>
```

Example:

```text
stage C8A add agent constitution and skills
```

## 8. Rejection criteria

Reject or stop a task when:

- it asks to “fix everything”
- it lacks a clear allowed file set
- it requires real AI/OCR without explicit permission
- it requires modifying stable chain and PDF chain in the same step
- it requires broad `app.js` rewrite
- it tries to bypass tests