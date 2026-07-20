# CODEX_TASK.local.md

## Current stage

R1 — Extract exam grouping policy

## Objective

Move only the pure exam grouping and group-summary policy from `app.js` into a
browser/Node module without changing observable behavior.

## app.js boundary declaration

- Why touch `app.js`: remove the two old pure definitions and replace them with module calls.
- Exact regions: current `getExamGroupsForQuestions`, `groupSummaryText`, and their direct calls.
- New business logic in `app.js`: none.
- Expected scope: a small net line reduction; no unrelated formatting.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-exam-grouping.js`
- `app.js`
- `main.html`
- `package.json`
- `tests/exam-grouping.test.js`
- `tests/main-html-script-order.test.js`

## Forbidden files

- DOCX/PDF/AI/OCR modules
- `qisi-db.js`
- `app.css`
- other tests or scripts
- `package-lock.json`, `.env`, `tmp/`, data, backups, user materials

## Required tests

```powershell
node --test tests/exam-grouping.test.js tests/main-html-script-order.test.js tests/app-ui-navigation-browser.test.js
node --check qisi-exam-grouping.js
node --check app.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Existing output semantics are characterized, including current edge cases.
- Module is pure, does not mutate inputs, and supports Node/browser exports.
- `app.js` old definitions are removed and production callsites use the module.
- New module loads exactly once before `app.js` and is included in syntax checks.
- `app.js` has a net line reduction.
- All gates pass with zero real AI/OCR calls.

## Commit

```bash
git add ai/CODEX_TASK.local.md qisi-exam-grouping.js app.js main.html package.json tests/exam-grouping.test.js tests/main-html-script-order.test.js
git commit -m "stage R1 extract exam grouping policy"
```

The user's explicit continuous-refactor instruction authorizes transition to R2
after this commit, subject to all hard stop conditions.
