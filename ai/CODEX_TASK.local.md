# CODEX_TASK.local.md

## Current stage

R5 — Extract bounded exam print rendering

## Objective

Extract only the six pure exam/answer HTML assembly functions from `app.js` into
`qisi-exam-print-renderer.js`, with dependency injection for LaTeX rendering,
option-column resolution, grouping, summaries, and reactive configuration.

## app.js boundary declaration

- Why `app.js` must be touched: remove the inline pure print HTML builders and retain two thin production wrappers.
- Exact regions: `buildHeaderFields`, `buildAnswerGrid`, `buildNotice`, `buildAnswerContent`, `buildPrintOptionsHtml`, and `buildQuestionContent`.
- Why a `qisi-*.js` module is not sufficient alone: current Vue config/title/meta, group policy, LaTeX renderer, and DOCX option-column resolver must be injected at call time.
- Expected line-level scope: replace roughly 100 lines with bounded wrapper calls; `app.js` must shrink materially.
- Keep KaTeX, recursive LaTeX/image rendering, image hydration, IndexedDB, DOM/document access, print-window creation, Blob/URL lifecycle, and downloads in `app.js`.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-exam-print-renderer.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/exam-print-renderer.test.js`
- `tests/main-html-script-order.test.js`
- A pre-existing print/source-contract test only when the full gate proves it asserts the removed inline implementation

## Forbidden files

- DOCX/PDF recognition, AI/OCR, batch, review, DB/storage modules or schemas
- `qisi-a4-exam-template.js`, print CSS, templates, lockfile, env, data, backups, and user materials
- behavior changes to pagination, image hydration, Blob lifetime, or formula rendering

## Required gates

```powershell
node --test tests/exam-print-renderer.test.js tests/a4-exam-template.test.js tests/main-html-script-order.test.js tests/app-ui-navigation-browser.test.js
node --check qisi-exam-print-renderer.js
node --check app.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
$env:QISI_REAL_PRINT_LAYOUT="1"
node --test tests/docx-layout-real-browser.test.js
$env:QISI_ALLOWED_DIFF="ai/CODEX_TASK.local.md,qisi-exam-print-renderer.js,app.js,main.html,package.json,tests/exam-print-renderer.test.js,tests/main-html-script-order.test.js"
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Exact legacy HTML, truthiness, numbering, escaping, option labels/columns, answer-grid bounds, and failure contracts are characterized.
- The module is pure, deterministic, Node/browser compatible, and does not mutate questions, config, metadata, groups, or images.
- Production uses the module; the six old inline implementations are removed.
- No DOM, window, Blob, IndexedDB, KaTeX, image hydration, or print-window lifecycle enters the module.
- Existing A4 geometry/pagination tests and the opt-in real print-layout browser test pass with zero page/console errors.
- Full gates pass with zero real AI/OCR calls.

## Commit

```bash
git add ai/CODEX_TASK.local.md qisi-exam-print-renderer.js app.js main.html package.json tests/exam-print-renderer.test.js tests/main-html-script-order.test.js
git commit -m "stage R5 extract exam print renderer"
```

Continue to R6 after a green commit under the user's continuous-refactor instruction.
