---
name: app-js-boundary
description: Use whenever a task might require editing app.js.
---

# app.js Boundary Skill

## Purpose

Prevent `app.js` from growing into an unmaintainable business-logic sink.

`app.js` is high-risk because it coordinates many features.

## Before editing app.js

You must state:

```text
Why app.js must be touched:
Exact functions/regions:
Why a qisi-*.js module is not sufficient:
Expected line-level scope:
Tests:
```

If this cannot be answered, do not edit `app.js`.

## Allowed app.js changes

Allowed only when task explicitly permits:

- import/load a module
- call a module function
- pass helpers into module
- update UI status/progress
- small event handler fix
- preserve existing flow while adding shadow diagnostics
- remove glue after module extraction

## Forbidden app.js changes

Do not:

- add a new parser algorithm
- add a new PDF aligner
- add a new OCR workflow
- add field-level write policy
- perform broad refactor
- reformat unrelated code
- rename large sets of variables
- move stable DOCX logic without explicit migration task
- mix UI cleanup with recognition logic

## Preferred pattern

Instead of adding logic to `app.js`:

1. Create or update `qisi-*.js`.
2. Export pure functions for Node/browser.
3. Add tests.
4. Wire with minimal glue in `app.js`.
5. Run `verify:safe`.

## app.js final report requirement

When `app.js` changes, report:

```text
app.js touched: yes
Why:
Lines/functions:
New business logic added: yes/no
Could this be moved to qisi-*.js later:
Tests:
```