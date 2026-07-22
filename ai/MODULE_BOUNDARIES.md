# Module Boundaries — TEX题库

This document defines file-level ownership and risk boundaries.

## 1. Risk tiers

### L0 — Forbidden unless explicitly authorized

Do not edit these in ordinary tasks:

- `package-lock.json`
- database files
- backup files
- uploaded user materials
- `tmp/`
- `.env`
- any API keys or secrets
- production data

### L1 — High-risk legacy coordinator

`app.js`

Rules:

- Read freely.
- Modify only when the task explicitly allows it.
- Only make small glue changes.
- Do not add large algorithms.
- Do not perform broad refactors.
- Do not reformat unrelated regions.
- Prefer moving logic into `qisi-*.js`.

### L2 — UI shell and styles

- `main.html`
- `app.css`

Rules:

- Modify only for UI-specific tasks.
- Do not alter script order unless the task explicitly requires module loading changes.
- Do not change batch import workflow behavior from templates alone.
- UI changes must preserve review page fields and draft editing.

### L3 — Domain modules

Examples:

- `qisi-batch-importer.js`
- `qisi-support-parser.js`
- `qisi-support-repair.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-support-controlled-write.js`
- `qisi-batch-engine-v2.js`

Rules:

- Prefer focused modifications here.
- Keep modules exportable for Node tests and browser use.
- Add or update tests when behavior changes.
- Preserve existing public function names unless task allows migration.

### L4 — Tests and fixtures

- `tests/*.test.js`
- `tests/fixtures/*`

Rules:

- New behavior requires tests.
- Do not delete failing tests to pass.
- Do not weaken known-bad fixture expectations.
- Tests must not call real AI/OCR by default.

### L5 — Documentation and agent rules

- `AGENTS.md`
- `ai/*.md`
- `skills/*/SKILL.md`
- `docs/stages/*.md`

Rules:

- Safe to update in documentation tasks.
- Keep root instructions concise.
- Put specialized long rules in skills.

## 2. Current architectural intent

`app.js` should gradually shrink.

Target direction:

```text
app.js
  = UI state + orchestration + calls to modules

qisi-*.js
  = pure or mostly-pure business logic

tests/
  = fixture-driven proof that stable chains remain safe
```

## 3. Batch import ownership

### DOCX import

Primary files:

- `qisi-batch-importer.js`
- DOCX-related helpers currently in `app.js`

Protection level:

- Stable chain.
- Any change requires DOCX regression coverage.

### PDF support

Primary files:

- `qisi-support-parser.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-support-controlled-write.js`

Protection level:

- High-risk safety chain.
- Any change must preserve fail-closed behavior.

### Review page

Primary files:

- `main.html`
- `app.css`
- review state/functions in `app.js`

Protection level:

- High-risk because it controls human validation before insertion.

## 4. Default modification policy

For each task, define:

```text
Allowed files:
Forbidden files:
Read-only files:
Required tests:
Stop conditions:
```

If the task file does not explicitly allow a file, do not edit it.
