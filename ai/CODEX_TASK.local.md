# CODEX_TASK.local.md

## Current stage

R6 — Expand review draft projection ownership

## Objective

Move only pure review editor preview parsing, recognition-summary projection,
problem aggregation, image-token detection, and draft-list filtering from `app.js`
into the existing production `qisi-review-draft-state.js` module.

## app.js boundary declaration

- Why `app.js` must be touched: remove the characterized inline review projections and replace them with dependency-injected module calls.
- Exact regions: editor choice parser/projection, `draftHasImageToken`, `batchRecognitionSummary`, `filteredDraftQuestions`, and `draftQuestionProblems`.
- Why the module is not sufficient alone: Vue computeds and existing safety helpers (`choiceOptionIssue`, `solutionQualityIssue`, Qisi Utils) remain coordinator dependencies.
- Expected line-level scope: wrappers/calls only; approximately 140 lines must leave `app.js`.
- Keep editor refs/watch/actions, draft mutation, cleanup evidence, image selectors/transactions/cropping, submit-to-bank, DB, AI/OCR, recognition, and rerun workflows in `app.js`.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-review-draft-state.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/review-draft-projections.test.js`
- `tests/qisi-review-draft-state-normalize-draft-preview-options.test.js`
- A pre-existing source-contract test only when the full gate proves it asserts one of the removed inline implementations

## Forbidden files

- DOCX/PDF/AI/OCR, batch-final-gate, print, DB/storage modules or schemas
- review image mutation/placement/crop/submit code
- templates/styles, lockfile, env, data, backups, and user materials
- activation of research-only `qisi-review-view-model.js`

## Required gates

```powershell
node --test tests/review-draft-projections.test.js tests/review-draft-state.test.js tests/qisi-review-draft-state-normalize-draft-preview-options.test.js tests/app-ui-navigation-browser.test.js
node --check qisi-review-draft-state.js
node --check app.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
$env:QISI_ALLOWED_DIFF="ai/CODEX_TASK.local.md,qisi-review-draft-state.js,app.js,main.html,package.json,tests/review-draft-projections.test.js,tests/qisi-review-draft-state-normalize-draft-preview-options.test.js"
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Exact editor label parsing, longest-sequence choice, option padding/fallback, CRLF behavior, summary counters, problem order/dedupe, and filter identity semantics are characterized.
- New exports are pure, deterministic, fail fast only on exercised missing dependencies, and do not mutate drafts/options/warnings/images.
- Production uses the module; old inline implementations are removed; existing downstream handler names remain unchanged.
- Missing solution alone remains non-problematic; image filter continues to use `q.hasImage`; no recognition policy changes.
- No draft writes, cleanup evidence, image transactions, submission, DB, AI/OCR, or network code moves.
- Full gates pass with zero real AI/OCR calls.

## Commit

```bash
git add ai/CODEX_TASK.local.md qisi-review-draft-state.js app.js main.html package.json tests/review-draft-projections.test.js tests/qisi-review-draft-state-normalize-draft-preview-options.test.js
git commit -m "stage R6 extract review projections"
```

Continue to R7 after a green commit under the user's continuous-refactor instruction.
