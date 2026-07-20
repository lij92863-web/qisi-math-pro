# CODEX_TASK.local.md

## Current stage

R7 — Extract the pure batch final-gate policy without changing the mutating coordinator.

## Objective

Move candidate identity, option validity, quality scoring/ranking, candidate merge,
diagnostics, and image rebinding from `app.js` into a deterministic
`qisi-batch-final-gate.js` module. Keep grouping, timestamp/order mutation,
logging, persistence, and every DOCX/PDF/AI/OCR workflow in `app.js`.

## app.js boundary declaration

- `app.js` may only inject the existing cleaners/key/image merge helpers, call the
  new pure module, and retain the existing mutating `batchFinalGateDedupeDrafts` loop.
- Exact removable regions: final-gate text/count helpers, origin/question identity,
  option validity/count, score/rank helpers, candidate merge, diagnostics row
  projection, and draft-image rebinding.
- Existing grouping by `sourceKey::questionNumber`, warning addition, ordering,
  `Date.now()`, console diagnostics, and write sites stay in the coordinator.
- No scoring weights, fallback precedence, warning wording, ownership rule, schema,
  or fail-closed policy may change.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-batch-final-gate.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/batch-final-gate.test.js`
- `tests/main-html-script-order.test.js` only if the script manifest requires it

## Forbidden files

- DOCX/PDF parser, support alignment, controlled-write, AI/OCR, DB/storage modules
- draft schema, recognition call sites, input fixtures, templates/styles, lockfile
- any real network or AI/OCR call
- exporting or moving the mutating dedupe/persistence coordinator

## Required gates

```powershell
node --check qisi-batch-final-gate.js
node --check app.js
node --test tests/batch-final-gate.test.js tests/main-html-script-order.test.js tests/app-ui-navigation-browser.test.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

## Acceptance criteria

- Legacy identity precedence, first-four option semantics, exact score weights,
  LaTeX-signal counting, source bonuses, merge selection, evidence fields, warnings,
  and orphan-image rules are characterized and unchanged.
- Module functions are deterministic, non-mutating, explicit-dependency APIs and
  usable from Node plus the browser namespace.
- Missing required policy functions fail loudly when exercised; no silent simplified
  production fallback is introduced.
- Production delegates to the module; removed inline helpers do not remain duplicated.
- DOCX+DOCX stays stable and PDF support remains fail closed.
- Zero real AI/OCR calls; full gates pass.

Continue directly to H1 after a green commit under the user's continuous-refactor instruction.
