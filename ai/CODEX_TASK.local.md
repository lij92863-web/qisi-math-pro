# CODEX_TASK.local.md

## Current stage

R2 — Extract library selectors

## Objective

Extract only pure library filtering, knowledge-tree flattening/descendant selection,
and fingerprint-index construction from `app.js`.

## app.js boundary declaration

- Touch only existing library selector definitions and their computed/call wiring.
- Keep Vue refs, pagination, event handlers, external merge/write, DB, and formal-bank writes in `app.js`.
- Add no business logic to `app.js`; inject dependencies into the new module.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-library-view-state.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/library-view-state.test.js`
- `tests/main-html-script-order.test.js`
- `tests/qisi-utils-find-node.test.js`

## Forbidden files

- DOCX/PDF/AI/OCR modules
- DB/storage modules and schemas
- `app.css`, other tests/scripts, lockfile, env, tmp, data, backups, user materials

## Required gates

```powershell
node --test tests/library-view-state.test.js tests/qisi-utils-question-matches-library-filters.test.js tests/main-html-script-order.test.js tests/app-ui-navigation-browser.test.js
node --check qisi-library-view-state.js
node --check app.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Current filter/tree/fingerprint semantics and reference identity are characterized.
- Module is pure and does not mutate inputs.
- Old implementations are removed; production uses the new module.
- `app.js` shrinks; scripts remain unique and ordered.
- Full gates pass with zero real AI/OCR calls.

## Commit

```bash
git add ai/CODEX_TASK.local.md qisi-library-view-state.js app.js main.html package.json tests/library-view-state.test.js tests/main-html-script-order.test.js
git commit -m "stage R2 extract library selectors"
```

Continue to R3 after a green commit under the user's continuous-refactor instruction.
