# CODEX_TASK.local.md

## Current stage

T1 — UI and script-order behavior freeze

## Objective

Turn the current production script order and safe top-level UI navigation into
executable contracts before the first runtime refactor. This stage changes tests
only; it must not change application behavior.

## Required reading

- `AGENTS.md`
- `ai/AGENT_CONSTITUTION.md`
- `ai/MODULE_BOUNDARIES.md`
- `ai/STABLE_CHAINS.md`
- `ai/ACCEPTANCE_CRITERIA.md`
- `ai/TESTING_GUIDE.md`
- `ai/CODEX_WORKFLOW.md`
- `ai/APP_JS_REFACTOR_MASTER_PLAN_R1.md`
- `skills/testing-verification/SKILL.md`
- `skills/git-stage-workflow/SKILL.md`

## Allowed files

- `ai/CODEX_TASK.local.md`
- `tests/main-html-script-order.test.js`
- `tests/app-ui-handler-contract.test.js`
- `tests/app-ui-navigation-browser.test.js`

## Forbidden files

- `app.js`
- `main.html`
- `app.css`
- `qisi-*.js`
- `scripts/`
- `package.json`
- `package-lock.json`
- `.env`
- `tmp/`
- production data, backups, and user test materials

## Required commands

```powershell
node --test tests/main-html-script-order.test.js tests/app-ui-handler-contract.test.js tests/app-ui-navigation-browser.test.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
$env:QISI_ALLOWED_DIFF="ai/CODEX_TASK.local.md,tests/main-html-script-order.test.js,tests/app-ui-handler-contract.test.js,tests/app-ui-navigation-browser.test.js"
npm.cmd run verify:diff-scope
```

## Acceptance criteria

- Local script `src` values are parsed, unique, and ordered; `app.js` is last.
- Route B remains absent and controlled-write remains before `app.js`.
- Template click expressions are inventoried and unresolved simple setup handlers fail the test.
- Playwright actually clicks every current top-level application view in an isolated browser context.
- Page errors, error-level console messages, and AI/OCR requests are zero.
- No runtime file changes.
- Full safe and batch-safety gates pass.

## Stop conditions

Stop if a runtime file would be needed to make the behavior-freeze tests pass, an
out-of-scope failure occurs, or any real AI/OCR request is attempted.

## Commit

```bash
git add ai/CODEX_TASK.local.md tests/main-html-script-order.test.js tests/app-ui-handler-contract.test.js tests/app-ui-navigation-browser.test.js
git commit -m "stage T1 freeze UI and script contracts"
```

After T1 is committed, the user's explicit continuation authorizes transition to
the separately scoped R1 task; do not mix R1 production files into the T1 commit.
