# CODEX_TASK.local.md

## Current stage

C13A2 — Manual refactor master plan and behavior freeze design

## Objective

Audit the current production dependency graph and define a complete, staged,
rollback-safe refactor plan before changing runtime behavior.

This stage is documentation and read-only verification only. It does not migrate
production functions yet.

## Required reading

- `AGENTS.md`
- `ai/AGENT_CONSTITUTION.md`
- `ai/MODULE_BOUNDARIES.md`
- `ai/STABLE_CHAINS.md`
- `ai/ACCEPTANCE_CRITERIA.md`
- `ai/TESTING_GUIDE.md`
- `ai/CODEX_WORKFLOW.md`
- `skills/qisi-module-refactor/SKILL.md`
- `skills/app-js-boundary/SKILL.md`
- `skills/testing-verification/SKILL.md`
- `skills/git-stage-workflow/SKILL.md`

## Allowed files

- `ai/CODEX_TASK.local.md`
- `ai/APP_JS_REFACTOR_MASTER_PLAN_R1.md`

## Forbidden files

- `app.js`
- `main.html`
- `app.css`
- `qisi-*.js`
- `tests/`
- `scripts/`
- `package.json`
- `package-lock.json`
- `.env`
- `tmp/`
- production data, backups, and user test materials

## Required commands

```powershell
git status --short
git diff --check
$env:QISI_ALLOWED_DIFF="ai/CODEX_TASK.local.md,ai/APP_JS_REFACTOR_MASTER_PLAN_R1.md"
npm.cmd run verify:diff-scope
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

## Acceptance criteria

- Current architecture facts are measured from the repository, not copied from an external audit.
- The plan defines invariants, stage boundaries, allowed files, gates, rollback points, and stop conditions.
- The first production migration candidate is explicitly named and justified.
- No runtime or test file changes in this stage.
- All required gates pass without real AI/OCR calls.

## Stop conditions

Stop if:

- the working tree was dirty before the stage;
- a runtime file would need to change while writing the plan;
- a required safety gate fails;
- any real AI/OCR call appears necessary.

## Commit

If all checks pass:

```bash
git add ai/CODEX_TASK.local.md ai/APP_JS_REFACTOR_MASTER_PLAN_R1.md
git commit -m "stage C13A2 plan manual app refactor"
```

After this planning stage, stop. Production extraction begins only under the next
explicit task stage.
