# CODEX_TASK.local.md

## Current stage

R3 — Extract manual-entry projections

## Objective

Extract only pure manual-entry preview, fixed-width option normalization,
legacy knowledge projection, and validation-result construction from `app.js`.

## app.js boundary declaration

- Why `app.js` must be touched: remove the existing inline entry projections and wire their exact replacements.
- Exact regions: `entryParsedQuestion` / preview computeds, `syncEntryLegacyKnowledge`, and the leading validation/projection lines in `submitQuestion`.
- Why a `qisi-*.js` module is not sufficient alone: Vue computeds and the existing submit event must call the new pure API.
- Expected line-level scope: small calls and assignments only; net line reduction is required.
- Keep Vue refs, file input, OCR, image Blob persistence, DB writes, alerts, form reset, and navigation in `app.js`.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-entry-view-state.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/entry-view-state.test.js`
- `tests/main-html-script-order.test.js`
- A pre-existing source-contract test only when the full gate proves that it asserts the replaced inline implementation

## Forbidden files

- DOCX/PDF/AI/OCR modules
- DB/storage modules and schemas
- styles/templates, lockfile, env, tmp, data, backups, and user materials
- unrelated entry event handlers or form behavior

## Required gates

```powershell
node --test tests/entry-view-state.test.js tests/main-html-script-order.test.js tests/app-ui-navigation-browser.test.js
node --check qisi-entry-view-state.js
node --check app.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
$env:QISI_ALLOWED_DIFF="ai/CODEX_TASK.local.md,qisi-entry-view-state.js,app.js,main.html,package.json,tests/entry-view-state.test.js,tests/main-html-script-order.test.js"
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Current manual-entry behavior is characterized before migration, including falsy values and malformed option input.
- The module is pure, deterministic, and does not mutate form/options.
- Production uses the module; the old inline projections are removed.
- No file/OCR/DB/alert/navigation behavior moves into the module.
- `app.js` shrinks; scripts remain unique and ordered.
- Full gates pass with zero real AI/OCR calls.

## Commit

```bash
git add ai/CODEX_TASK.local.md qisi-entry-view-state.js app.js main.html package.json tests/entry-view-state.test.js tests/main-html-script-order.test.js
git commit -m "stage R3 extract entry projections"
```

Continue to R4 after a green commit under the user's continuous-refactor instruction.
