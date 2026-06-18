---
name: git-stage-workflow
description: Use for commits, staged changes, branch hygiene, tags, and stage handoff documents.
---

# Git Stage Workflow Skill

## Purpose

Keep development reversible, auditable, and stage-based.

## Preflight

Always start with:

```bash
git status --short
git branch --show-current
git log --oneline -10
```

Stop if working tree is dirty unless the task explicitly says to inspect dirty changes.

## One task, one commit

A commit should contain one stage objective.

Do not bundle:

- documentation + business logic
- PDF parser + UI redesign
- DOCX stable fix + AI/OCR experiment
- tests + unrelated refactor

## Diff review

Before commit:

```bash
git diff --stat
git diff -- <changed files>
```

Confirm changed files match task scope.

## Commit message

Use stage/purpose messages:

```text
stage C8A add agent constitution and skills
stage C8B add diff scope verification
stage C8C lock docx stable smoke fixture
```

## Tags

Only tag stable milestones when task asks.

Suggested tag format:

```text
stage-c8a-agent-constitution-skills
```

## Forbidden git actions

Do not:

- force push
- reset hard
- delete branches
- amend previous commits
- commit dirty unrelated files
- commit secrets
- commit generated temp files
- continue into next stage after commit

## Final report

Include:

```text
Branch:
Commit:
Diff stat:
Tests:
Working tree:
```