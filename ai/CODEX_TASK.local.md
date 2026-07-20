# CODEX_TASK.local.md

## Current stage

R4 — Extract personal-knowledge tree transformations

## Objective

Extract immutable personal-knowledge create, append, rename, delete, expand-toggle,
and visible-row flattening transformations from `app.js`.

## app.js boundary declaration

- Why `app.js` must be touched: replace deep in-place knowledge-tree mutations with calls to the pure tree-state module.
- Exact regions: `personalTreeRows`, `togglePersonalExpanded`, `addPersonalChild`, `createPersonalL1/L2/L3`, `renamePersonalNode`, and `deletePersonalNode`.
- Why a `qisi-*.js` module is not sufficient alone: prompts, confirms, Vue ref assignment, selection refs, ID generation, and IndexedDB persistence stay in the event handlers.
- Expected line-level scope: dependency calls and state assignments only; no broad setup rewrite.
- Keep database writes, prompts/confirms, generated IDs, selected-node refs, and user-facing messages in `app.js`.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-knowledge-tree-state.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/knowledge-tree-state.test.js`
- `tests/main-html-script-order.test.js`
- A pre-existing source-contract test only when the full gate proves that it asserts the replaced inline implementation

## Forbidden files

- DOCX/PDF/AI/OCR, batch, review, print, DB/storage modules or schemas
- styles/templates, lockfile, env, tmp, data, backups, and user materials
- changes to prompt/confirm wording, ID format, persistence timing, or selected-node semantics

## Required gates

```powershell
node --test tests/knowledge-tree-state.test.js tests/main-html-script-order.test.js tests/app-ui-handler-contract.test.js tests/app-ui-navigation-browser.test.js
node --check qisi-knowledge-tree-state.js
node --check app.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
$env:QISI_ALLOWED_DIFF="ai/CODEX_TASK.local.md,qisi-knowledge-tree-state.js,app.js,main.html,package.json,tests/knowledge-tree-state.test.js,tests/main-html-script-order.test.js"
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Current visible-row order, collapsed-node behavior, node shapes, selection updates, and no-op cases are characterized.
- Tree transformations are pure, immutable, deterministic, and preserve unchanged branch references.
- Production uses the module; the old recursive/mutating implementations are removed.
- Prompts, confirms, Vue refs, generated IDs, and persistence remain coordinator-owned.
- Script order stays unique; no click binding changes.
- Full gates pass with zero real AI/OCR calls.

## Commit

```bash
git add ai/CODEX_TASK.local.md qisi-knowledge-tree-state.js app.js main.html package.json tests/knowledge-tree-state.test.js tests/main-html-script-order.test.js
git commit -m "stage R4 extract knowledge tree transforms"
```

Continue to R5 after a green commit under the user's continuous-refactor instruction.
