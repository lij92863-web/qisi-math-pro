# AGENTS.md — TEX题库 Coding Agent Instructions

This file is the root instruction file for coding agents working on this repository.

## Project identity

TEX题库 is a local-first high-school math question-bank and batch-import system.

Primary domain risks:

- DOCX+DOCX stable import chain must not regress.
- PDF/PDF-support alignment must fail closed when uncertain.
- Wrongly attached answers or solutions are worse than missing answers.
- `app.js` is a high-risk legacy coordinator and must not absorb new large business logic.

## Required reading before any task

Before editing files, read:

1. `ai/AGENT_CONSTITUTION.md`
2. `ai/MODULE_BOUNDARIES.md`
3. `ai/STABLE_CHAINS.md`
4. `ai/ACCEPTANCE_CRITERIA.md`
5. `ai/TESTING_GUIDE.md`
6. `ai/CODEX_WORKFLOW.md`
7. `ai/CODEX_TASK.local.md`

For domain-specific work, also read the matching skill:

- Batch import: `skills/batch-import/SKILL.md`
- DOCX stable chain: `skills/docx-stable-chain/SKILL.md`
- PDF support alignment: `skills/pdf-support-safe-align/SKILL.md`
- Review page / draft workspace: `skills/review-page-draft/SKILL.md`
- `app.js` changes: `skills/app-js-boundary/SKILL.md`
- Tests and verification: `skills/testing-verification/SKILL.md`
- Git workflow: `skills/git-stage-workflow/SKILL.md`
- Local AI/OCR/proxy work: `skills/local-ai-ocr-boundary/SKILL.md`
- Refactoring modules: `skills/qisi-module-refactor/SKILL.md`

## Mandatory preflight

Run:

```bash
git status --short
git branch --show-current
git log --oneline -10
```

If the working tree is not clean, stop and report.

## Standard safe verification

For ordinary code changes, run:

```bash
npm run verify:safe
```

`verify:safe` is the default gate. Do not submit or commit when it fails.

## Hard boundaries

Never do these without an explicit task file that allows it:

- Do not call real AI/OCR endpoints.
- Do not modify production data or local IndexedDB contents directly.
- Do not rewrite `app.js`.
- Do not add large business logic to `app.js`.
- Do not break DOCX+DOCX stable behavior.
- Do not use semantic guessing to attach PDF answers or solutions.
- Do not trust AI-provided `question` fields without sequence validation.
- Do not change test expectations just to make failing tests pass.
- Do not enter the next stage after finishing the current task.

## Default work style

- One task, one bounded change, one verification report, one commit.
- Prefer new `qisi-*.js` modules over growing `app.js`.
- Prefer pure functions and fixture-driven tests.
- Prefer fail-closed behavior over silent data pollution.
- Preserve raw evidence before cleaning display fields.
- Explain changed files, tests run, remaining risks, and next step.

## Stop conditions

Stop immediately when:

- A forbidden file must be edited.
- A real AI/OCR call appears necessary.
- `git diff` contains files outside the task scope.
- `verify:safe` fails and the cause is not clearly within scope.
- PDF support sequence is discontinuous, duplicate, jump-back, or answer/solution inconsistent.
- The current task objective is complete.
