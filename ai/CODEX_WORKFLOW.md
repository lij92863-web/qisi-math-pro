# Codex Workflow — TEX题库

This is the standard workflow for Codex tasks.

## 1. Stage model

Every task is a stage.

A stage has:

- ID
- objective
- required reading
- allowed files
- forbidden files
- commands
- acceptance criteria
- stop conditions
- output report

Do not perform unscoped work.

## 2. Standard flow

### Step 1: Preflight

```bash
git status --short
git branch --show-current
git log --oneline -10
```

Stop if dirty.

### Step 2: Read instructions

Read:

- `AGENTS.md`
- `ai/AGENT_CONSTITUTION.md`
- `ai/MODULE_BOUNDARIES.md`
- `ai/STABLE_CHAINS.md`
- `ai/ACCEPTANCE_CRITERIA.md`
- `ai/TESTING_GUIDE.md`
- `ai/CODEX_TASK.local.md`
- relevant `skills/*/SKILL.md`

### Step 3: Plan

Before editing, write a short plan:

```text
Objective:
Allowed files:
Forbidden files:
Tests:
Expected risk:
```

### Step 4: Inspect

Search and read code first.

Do not edit before locating the exact entry points.

### Step 5: Modify minimally

Make the smallest change.

Prefer pure functions and modules.

### Step 6: Test

Run narrow tests first, then:

```bash
npm run verify:safe
```

`verify:safe` includes `verify:no-real-ai`.

For task-specific allowed-file checks, set `QISI_ALLOWED_DIFF` and run:

```bash
npm run verify:diff-scope
```

In Windows PowerShell, prefer `npm.cmd` if direct `npm` is blocked by execution policy.

### Step 7: Report

Report:

```text
Changed files:
Diff stat:
Tests:
Result:
Risk:
Not done:
Next step:
```

### Step 8: Commit only if authorized by task

If the task allows commit and tests pass:

```bash
git add <scoped files>
git commit -m "<stage message>"
```

## 3. Automation boundary

Codex may automatically:

- inspect files
- write tests
- write focused modules
- run safe tests
- read logs
- fix in-scope failures
- commit when task allows

Codex may not automatically:

- call real AI/OCR
- modify forbidden files
- proceed to next stage
- rewrite `app.js`
- change dependency graph
- submit real question bank data
- hide test failures

## 4. Stage document format

When a stage completes, create `docs/stages/STAGE_<ID>_<NAME>.md` if the task asks for it.

Template:

```markdown
# STAGE <ID> — <Name>

## Objective

## Completed

## Files changed

## Tests

## Risks

## Not done

## Next step

## Commit
```

## 5. Recommended stage sequence from current baseline

The current safe sequence is:

1. Add agent constitution and skills.
2. Confirm `verify:safe` green.
3. Add diff-scope verification script.
4. Add stricter no-real-AI/OCR verification script.
5. Lock DOCX+DOCX stable fixture.
6. Lock PDF known-bad fail-closed fixture.
7. Only then continue PDF support feature work.
