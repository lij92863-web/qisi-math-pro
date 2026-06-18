# CODEX_TASK.local.md

## Current stage

C8A — Agent constitution and skills bootstrap

## Objective

Create the root `AGENTS.md`, `ai/*.md`, and `skills/*/SKILL.md` files that define the engineering workflow for this project.

This task is documentation/rules only.

## Required reading

- `AGENTS.md` if it already exists
- `ai/AGENT_CONSTITUTION.md` if it already exists
- `ai/MODULE_BOUNDARIES.md` if it already exists
- `ai/STABLE_CHAINS.md` if it already exists
- `ai/ACCEPTANCE_CRITERIA.md` if it already exists
- `ai/TESTING_GUIDE.md` if it already exists

## Allowed files

- `AGENTS.md`
- `ai/*.md`
- `skills/*/SKILL.md`

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
- any data or backup file

## Required commands

```bash
git status --short
git branch --show-current
git log --oneline -10
npm run verify:safe
```

## Acceptance criteria

- All requested instruction files exist.
- No business code changed.
- `npm run verify:safe` passes.
- Final report includes changed files, diff stat, test result, and commit hash if committed.

## Stop conditions

Stop if:

- working tree is dirty before starting
- `verify:safe` fails
- a forbidden file would need to be edited
- any real AI/OCR call appears necessary

## Commit

If all checks pass:

```bash
git add AGENTS.md ai skills
git commit -m "stage C8A add agent constitution and skills"
```

After commit, stop.