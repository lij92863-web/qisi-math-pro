# CODEX TASK 2：建立 TEX题库 的 Agent 宪法与 Skill 体系

> 目标：在当前项目中建立一套可被 Codex 自动读取、可被人类审查、可长期迭代的工程化规则体系。  
> 本任务 **只新增/更新文档型规则文件**，不得修改业务代码，不得修功能，不得重构。

---

## 0. 任务背景

当前项目是「TEX题库」本地题库与批量录题系统，核心风险集中在：

1. `app.js` 体量过大，承担 UI 状态、批量录题流程、DOCX/PDF 调度、草稿落库、审核页操作等职责。
2. DOCX+DOCX 是稳定主链，必须优先保护。
3. PDF+PDF / PDF support 是高风险链路，历史上出现过答案/解析错挂、断号后继续挂、回跳后继续挂、AI question 字段不可靠、选项污染等问题。
4. 项目已有 `npm run check`、`npm test`、`npm run smoke:batch:mock`、`npm run verify:safe`，必须把这些命令固化进工作流。
5. 当前需要让 Codex 后续能够按任务文件、边界文件、稳定链路文件、验收标准、专项 Skill 自动执行小步开发，而不是靠长对话记忆。

本轮任务只建立规则体系，不做功能开发。

---

## 1. 强制执行规则

开始前必须执行：

```bash
git status --short
git branch --show-current
git log --oneline -10
```

如果 `git status --short` 不为空，立即停止，只报告未提交文件，不得继续。

本轮只允许新增或更新以下文档文件：

```text
AGENTS.md
ai/AGENT_CONSTITUTION.md
ai/MODULE_BOUNDARIES.md
ai/STABLE_CHAINS.md
ai/ACCEPTANCE_CRITERIA.md
ai/TESTING_GUIDE.md
ai/CODEX_WORKFLOW.md
ai/CODEX_TASK.local.md
skills/batch-import/SKILL.md
skills/docx-stable-chain/SKILL.md
skills/pdf-support-safe-align/SKILL.md
skills/review-page-draft/SKILL.md
skills/app-js-boundary/SKILL.md
skills/testing-verification/SKILL.md
skills/git-stage-workflow/SKILL.md
skills/local-ai-ocr-boundary/SKILL.md
skills/qisi-module-refactor/SKILL.md
```

不得修改：

```text
app.js
main.html
app.css
qisi-*.js
tests/
scripts/
package.json
package-lock.json
任何数据库、题库数据、上传文件、tmp 文件
```

完成后必须执行：

```bash
npm run verify:safe
```

测试通过后允许提交。提交信息：

```bash
git add AGENTS.md ai skills
git commit -m "chore: add agent constitution and skills workflow"
```

本轮完成后停止，不进入任何功能修复。

---

## 2. 文件一：AGENTS.md

在项目根目录创建 `AGENTS.md`，内容如下：

```markdown
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
```

---

## 3. 文件二：ai/AGENT_CONSTITUTION.md

创建 `ai/AGENT_CONSTITUTION.md`：

```markdown
# Agent Constitution — TEX题库

This document defines non-negotiable rules for all coding agents.

## 1. Highest-level project principle

The project optimizes for **not polluting the question bank**.

A missing answer is acceptable.  
A wrongly attached answer or solution is unacceptable.

When uncertain, fail closed.

## 2. Stable chain priority

The DOCX+DOCX batch-import chain is the stable baseline.

Any change to PDF support, OCR, AI recognition, review UI, image handling, or batch workflows must not regress DOCX+DOCX behavior.

Required invariant:

```text
PDF/AI/OCR changes must not break DOCX+DOCX.
```

## 3. PDF support safety principle

PDF support alignment has only three acceptable outcomes:

1. `full`: all expected question numbers are reliable and aligned.
2. `prefix`: only the reliable prefix is attached; the rest is fused/withheld.
3. `fail-closed`: no answer/solution is attached automatically.

Forbidden outcomes:

- Attach after a missing number.
- Attach after jump-back.
- Attach after duplicate question number.
- Attach answer and solution when their question sequences disagree.
- Attach based on semantic similarity.
- Attach based on keywords such as triangle, vector, sin, cos, area, etc.
- Attach based only on AI output field `question`.

## 4. AI output distrust principle

AI/OCR output is evidence, not truth.

Never directly trust:

- `question`
- `questionNumber`
- `sourceOrder`
- answer text that looks like option value
- solution text that is too short or placeholder-like

Always combine:

- expected question numbers
- source order
- answer item sequence
- solution item sequence
- duplicate detection
- jump-back detection
- answer/solution pair consistency
- objective answer normalization rules
- existing draft type/options

## 5. app.js boundary principle

`app.js` is a coordinator, not a dumping ground.

Allowed in `app.js`:

- UI state
- event handlers
- orchestration
- calling `qisi-*.js` modules
- writing UI status/progress
- small glue code

Forbidden in `app.js` unless explicitly authorized:

- new large parsing algorithms
- new alignment algorithms
- new OCR/AI business logic
- new field-level write policies
- large refactors
- unrelated formatting
- broad replacement of existing workflow

New complex logic must go into a focused `qisi-*.js` module with tests.

## 6. Testing before trust

A feature is not considered working because it “looks right” in the browser.

A feature is considered minimally acceptable only after:

```bash
npm run check
npm test
npm run smoke:batch:mock
npm run verify:safe
```

The default final gate is:

```bash
npm run verify:safe
```

## 7. Mock-first policy

Default development must use mocks and fixtures.

Do not call real:

- `/api/ai/chat`
- `/api/ai/ocr`
- DashScope upstream APIs
- vision OCR
- paid model calls

Real AI/OCR tests require a separate task file with explicit permission, cost scope, input files, and stop conditions.

## 8. Minimal change policy

Every change must be the smallest sufficient change for the task.

Do not:

- “also improve” unrelated code
- reformat whole files
- rename unrelated symbols
- migrate architecture during a bugfix
- change tests to fit broken behavior
- continue to the next stage automatically

## 9. Evidence preservation

Before cleaning display text, preserve raw evidence where applicable.

Do not destroy:

- raw OCR text
- raw PDF support text
- source page image references
- source trace
- warnings
- diagnostics
- confidence signals

Clean display fields only after evidence is preserved.

## 10. Human-review boundary

The system may generate drafts automatically, but final question-bank insertion is a high-risk action.

Do not bypass review safeguards.

Do not silently submit draft questions to the formal question bank unless the current task explicitly requires and tests it.

## 11. Stop conditions

Stop instead of guessing when:

- required file is missing
- working tree is dirty
- task requires forbidden file edits
- real AI/OCR is needed
- sequence reliability cannot be established
- answer/solution alignment conflicts
- a test failure is outside task scope
- the task objective has already been achieved
```

---

## 4. 文件三：ai/MODULE_BOUNDARIES.md

创建 `ai/MODULE_BOUNDARIES.md`：

```markdown
# Module Boundaries — TEX题库

This document defines file-level ownership and risk boundaries.

## 1. Risk tiers

### L0 — Forbidden unless explicitly authorized

Do not edit these in ordinary tasks:

- `package-lock.json`
- database files
- backup files
- uploaded user materials
- `tmp/`
- `.env`
- any API keys or secrets
- production data

### L1 — High-risk legacy coordinator

`app.js`

Rules:

- Read freely.
- Modify only when the task explicitly allows it.
- Only make small glue changes.
- Do not add large algorithms.
- Do not perform broad refactors.
- Do not reformat unrelated regions.
- Prefer moving logic into `qisi-*.js`.

### L2 — UI shell and styles

- `main.html`
- `app.css`

Rules:

- Modify only for UI-specific tasks.
- Do not alter script order unless the task explicitly requires module loading changes.
- Do not change batch import workflow behavior from templates alone.
- UI changes must preserve review page fields and draft editing.

### L3 — Domain modules

Examples:

- `qisi-batch-importer.js`
- `qisi-support-parser.js`
- `qisi-support-repair.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-support-controlled-write.js`
- `qisi-batch-engine-v2.js`

Rules:

- Prefer focused modifications here.
- Keep modules exportable for Node tests and browser use.
- Add or update tests when behavior changes.
- Preserve existing public function names unless task allows migration.

### L4 — Tests and fixtures

- `tests/*.test.js`
- `tests/fixtures/*`

Rules:

- New behavior requires tests.
- Do not delete failing tests to pass.
- Do not weaken known-bad fixture expectations.
- Tests must not call real AI/OCR by default.

### L5 — Documentation and agent rules

- `AGENTS.md`
- `ai/*.md`
- `skills/*/SKILL.md`
- `docs/stages/*.md`

Rules:

- Safe to update in documentation tasks.
- Keep root instructions concise.
- Put specialized long rules in skills.

## 2. Current architectural intent

`app.js` should gradually shrink.

Target direction:

```text
app.js
  = UI state + orchestration + calls to modules

qisi-*.js
  = pure or mostly-pure business logic

tests/
  = fixture-driven proof that stable chains remain safe
```

## 3. Batch import ownership

### DOCX import

Primary files:

- `qisi-batch-importer.js`
- DOCX-related helpers currently in `app.js`

Protection level:

- Stable chain.
- Any change requires DOCX regression coverage.

### PDF support

Primary files:

- `qisi-support-parser.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-support-controlled-write.js`

Protection level:

- High-risk safety chain.
- Any change must preserve fail-closed behavior.

### Review page

Primary files:

- `main.html`
- `app.css`
- review state/functions in `app.js`

Protection level:

- High-risk because it controls human validation before insertion.

## 4. Default modification policy

For each task, define:

```text
Allowed files:
Forbidden files:
Read-only files:
Required tests:
Stop conditions:
```

If the task file does not explicitly allow a file, do not edit it.
```

---

## 5. 文件四：ai/STABLE_CHAINS.md

创建 `ai/STABLE_CHAINS.md`：

```markdown
# Stable Chains — TEX题库

This document defines behavior that must not regress.

## 1. Stable chain A: DOCX+DOCX batch import

DOCX+DOCX is the primary stable import path.

Required behavior:

- Question file can produce draft questions.
- Answer/support file can attach answers.
- Solution/support file can attach solutions.
- Question numbers remain ordered.
- Options do not get polluted by JSON fragments or unrelated answer text.
- Images stay associated with the correct question when evidence is clear.
- Missing answer/solution is marked as a problem, not silently guessed.
- Review page displays draft fields correctly.
- Submitting to question bank requires review flow.

Regression signals:

- fewer expected questions
- missing stems
- broken option parsing
- answer/solution shifted by one or more questions
- image token appears in the wrong question
- draft review page cannot show or edit LaTeX source
- cleanup destroys raw evidence

Minimum gate:

```bash
npm run smoke:batch:mock
npm run verify:safe
```

## 2. Stable chain B: PDF support fail-closed

PDF support is allowed to attach answers/solutions only when alignment is reliable.

Allowed modes:

- `full`
- `prefix`
- `fail-closed`

Required behavior:

- Known-bad jump-back sequences must not pollute later questions.
- Duplicate markers must stop safe attachment.
- Unknown question markers must not be trusted.
- Answer and solution sequences must be compatible.
- Parser and legacy gates must pass field-level controlled write.
- Objective answers must be normalized safely.
- Multiple-choice option values must not be converted when ambiguous.

Regression signals:

- known-bad fixture writes wrong answers
- answer attaches after question number jumps backward
- solution attaches after answer gate failed
- parser value overwrites safer legacy objective label
- ambiguous option value becomes an answer
- multi-choice option value becomes answer label

Minimum gate:

```bash
npm test
npm run smoke:batch:mock
npm run verify:safe
```

## 3. Stable chain C: Review draft workspace

Required behavior:

- Draft list displays all questions.
- Problem filter shows missing answer, missing solution, missing options, image issues.
- Active draft can be edited through LaTeX source.
- Edits preserve question type/options where possible.
- Image placement tools do not corrupt stem/options.
- Source page images are visually separated from real question figures.
- Clearing draft workspace does not delete formal question bank.

Regression signals:

- draft editor loses options
- image token disappears or moves unexpectedly
- submitted draft becomes editable incorrectly
- cleanup modifies raw evidence
- clearing draft deletes formal bank rows

## 4. Stable chain D: Local AI/OCR boundary

Local server can expose AI/OCR proxy endpoints, but default tests must not call them.

Forbidden by default:

- `/api/ai/chat`
- `/api/ai/ocr`
- paid DashScope upstream calls
- vision OCR calls inside mock tests

Allowed only in explicit real-test tasks:

- `npm run test:ai-proxy`
- `npm run test:ai-vision-proxy`

A real-test task must specify:

- model
- file
- expected cost/range
- success criteria
- abort conditions
- no business-code changes during evidence collection unless explicitly authorized
```

---

## 6. 文件五：ai/ACCEPTANCE_CRITERIA.md

创建 `ai/ACCEPTANCE_CRITERIA.md`：

```markdown
# Acceptance Criteria — TEX题库

Every task must satisfy these criteria before completion.

## 1. General completion checklist

A task is complete only when:

- The requested objective is fulfilled.
- No forbidden file was modified.
- `git diff --stat` only shows task-related files.
- Required tests pass.
- The result is documented.
- Remaining risks are stated.
- The next step is suggested but not executed.

## 2. Required command report

The final report must include:

```text
git status --short:
git diff --stat:
Tests run:
Result:
Commit hash, if committed:
Files changed:
Not done:
Risks:
Next recommended task:
```

## 3. Default verification

For ordinary code changes:

```bash
npm run verify:safe
```

For documentation-only changes:

```bash
npm run verify:safe
```

Documentation-only changes still run safe verification because they should not affect runtime and the project should remain green.

## 4. Batch import acceptance

Batch import changes require:

- DOCX stable chain still passes.
- PDF known-bad behavior still fails closed.
- No real AI/OCR call in mock tests.
- Draft questions preserve `questionNumber`, `stem`, `options`, `answer`, `solution`, `images`, `warnings`, and source trace where applicable.
- Review page still displays recognition summary and problem filters.

## 5. PDF support acceptance

PDF support changes require tests for at least the relevant cases:

- normal full sequence
- prefix sequence
- missing number
- duplicate number
- jump-back number
- unknown marker
- answer/solution mismatch
- objective answer label preservation
- ambiguous option value rejection
- multi-choice value rejection
- parser solution kept when answer rejected if field-level policy allows

## 6. Refactor acceptance

Refactors require:

- no behavior change unless explicitly stated
- before/after tests both green, if possible
- exported API preserved or migration documented
- no broad formatting
- new module has Node/browser export pattern if used in both environments
- `app.js` net complexity reduced or unchanged

## 7. Git acceptance

Commit only when:

- tests pass
- diff is scoped
- commit message names the stage/purpose
- no secrets or generated trash files are included
- no next-stage work is bundled

Recommended commit pattern:

```text
stage <ID> <short objective>
```

Example:

```text
stage C8A add agent constitution and skills
```

## 8. Rejection criteria

Reject or stop a task when:

- it asks to “fix everything”
- it lacks a clear allowed file set
- it requires real AI/OCR without explicit permission
- it requires modifying stable chain and PDF chain in the same step
- it requires broad `app.js` rewrite
- it tries to bypass tests
```

---

## 7. 文件六：ai/TESTING_GUIDE.md

创建 `ai/TESTING_GUIDE.md`：

```markdown
# Testing Guide — TEX题库

## 1. Existing commands

Use the commands already defined in `package.json`.

```bash
npm run check
npm test
npm run smoke:batch:mock
npm run verify:safe
npm run verify
```

Default final gate:

```bash
npm run verify:safe
```

## 2. Command meanings

### `npm run check`

Syntax-checks important JavaScript files.

Use after editing any `.js` file.

### `npm test`

Runs Node test suite.

Use after editing any module or test.

### `npm run smoke:batch:mock`

Runs batch-import mock smoke tests.

This is mandatory for batch import, DOCX, PDF support, and review-related logic.

### `npm run verify:safe`

Runs safe full verification:

```text
check + test + smoke:batch:mock
```

Use before final report and before commit.

### `npm run test:ai-proxy`

Real AI proxy smoke. Not allowed by default.

### `npm run test:ai-vision-proxy`

Real vision proxy smoke. Not allowed by default.

## 3. No-real-AI/OCR policy

Default tests must not call:

- `/api/ai/chat`
- `/api/ai/ocr`
- DashScope upstream
- paid OCR/vision APIs

If a task requires these calls, create a separate real-test task.

## 4. Test writing rules

When fixing a bug:

1. Add or identify a failing test/fixture.
2. Make the smallest code change.
3. Run the narrow test.
4. Run `npm run verify:safe`.

When adding PDF support logic, include known-bad and fail-closed tests.

When touching DOCX logic, include DOCX stable-chain fixture tests.

When touching review page data transformation, include draft structure tests.

## 5. What not to do

Do not:

- delete failing tests
- weaken assertions to match broken output
- replace known-bad fixture with easier data
- skip smoke test because unit tests pass
- run real AI/OCR inside mock smoke
- claim “works” without command output

## 6. Preferred test naming

Use behavior names:

```text
known bad jump-back sequence does not attach unsafe answers
field-level controlled write rejects ambiguous objective answer
docx stable chain preserves answer and solution
review editor preserves options after source edit
```

Avoid vague names:

```text
test pdf
fix bug
works
```
```

---

## 8. 文件七：ai/CODEX_WORKFLOW.md

创建 `ai/CODEX_WORKFLOW.md`：

```markdown
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
```

---

## 9. 文件八：ai/CODEX_TASK.local.md

创建 `ai/CODEX_TASK.local.md`：

```markdown
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
```

---

## 10. Skill：skills/batch-import/SKILL.md

创建 `skills/batch-import/SKILL.md`：

```markdown
---
name: batch-import
description: Use when modifying or testing the batch import workflow for DOCX, PDF, image, or text files.
---

# Batch Import Skill

## Purpose

Use this skill for work involving:

- batch upload
- file roles
- draft import batches
- draft questions
- draft images
- DOCX/PDF parsing orchestration
- answer/solution attachment
- batch review state
- import progress and error handling

## Required reading

Read:

- `ai/AGENT_CONSTITUTION.md`
- `ai/STABLE_CHAINS.md`
- `ai/MODULE_BOUNDARIES.md`
- `skills/docx-stable-chain/SKILL.md`
- `skills/pdf-support-safe-align/SKILL.md` when PDF support is involved
- `skills/review-page-draft/SKILL.md` when draft UI/data is involved

## Current known entry points

Common batch entry points include:

- `runBatchRecognition`
- `processDraftImportBatch`
- `createDraftImportBatch`
- `loadBatchImportData`
- `batchDraftQuestions`
- `batchDraftImages`
- `draftQuestionProblems`
- `confirmBatchSubmit`

Treat `app.js` as high-risk. Search before editing.

## Non-negotiable invariants

- Never pollute the formal question bank.
- Draft generation is allowed; unsafe automatic submission is not.
- Missing answer is better than wrong answer.
- Missing solution is better than wrong solution.
- Preserve source trace, warnings, and raw evidence.
- Do not let PDF-specific logic change DOCX behavior.

## File-role rules

Supported file roles include:

- `question`
- `answer`
- `solution`
- `full`
- `supplemental_image`

Do not assume filename alone is truth. Filename can inform UI defaults but must not override explicit user role.

## Draft schema preservation

When creating/updating draft questions, preserve:

```text
id
batchId
questionNumber
order
type
stem
options
answer
solution
images
warnings
status
sourceFileId/sourceQuestionFileId
sourceTrace
sourcePageImage
updatedAt
```

If adding fields, keep backward compatibility.

## Required tests

For ordinary batch-import changes:

```bash
npm run smoke:batch:mock
npm run verify:safe
```

For parser/module changes:

```bash
npm test
npm run verify:safe
```

## Forbidden patterns

Do not:

- add large logic to `app.js`
- attach support by semantic similarity
- trust AI question numbers directly
- remove warnings to make UI cleaner
- delete unmatched answers silently
- bypass review
- call real AI/OCR in default tests

## Output requirements

Final report must include:

- batch flow touched or not touched
- DOCX chain affected or not
- PDF support affected or not
- tests run
- remaining risk
```

---

## 11. Skill：skills/docx-stable-chain/SKILL.md

创建 `skills/docx-stable-chain/SKILL.md`：

```markdown
---
name: docx-stable-chain
description: Use when modifying DOCX parsing, DOCX+DOCX import, DOCX media, OMML formula conversion, or any code that could affect the stable DOCX chain.
---

# DOCX Stable Chain Skill

## Purpose

Protect the DOCX+DOCX stable baseline.

DOCX+DOCX is the primary stable workflow. Do not let PDF, OCR, or AI experiments regress it.

## Relevant files

Commonly relevant:

- `qisi-batch-importer.js`
- DOCX-related helpers in `app.js`
- tests/fixtures for DOCX stable data
- batch smoke tests

## Invariants

DOCX import must preserve:

- question count
- question order
- leading question number
- stem text
- options A-D
- answer
- solution
- inline images
- formula text/LaTeX
- raw evidence where available

## Common historical failure modes

Guard against:

- options polluted by JSON text
- options becoming repeated `B}` or similar artifacts
- answer missing while solution exists
- solution attached to wrong question
- image token attached to wrong question
- formula conversion breaking rendered preview
- cleanup deleting raw evidence
- PDF support warnings leaking into DOCX path

## Allowed behavior

If DOCX content is ambiguous:

- create draft with warning
- leave answer/solution empty
- require review

## Forbidden behavior

Do not:

- use PDF support alignment to modify DOCX answer attachment
- call OCR for normal DOCX text unless explicit task allows
- convert stable DOCX flow into AI-first flow
- weaken DOCX stable tests

## Required tests

At minimum:

```bash
npm run smoke:batch:mock
npm run verify:safe
```

If changing `qisi-batch-importer.js`:

```bash
npm run check
npm test
npm run verify:safe
```

## Acceptance statement

Every DOCX-related final report must state:

```text
DOCX stable chain impact:
DOCX regression command:
Result:
```
```

---

## 12. Skill：skills/pdf-support-safe-align/SKILL.md

创建 `skills/pdf-support-safe-align/SKILL.md`：

```markdown
---
name: pdf-support-safe-align
description: Use when modifying PDF answer/solution parsing, support alignment, fail-closed gates, block parser, or controlled write.
---

# PDF Support Safe Align Skill

## Purpose

Prevent unsafe PDF answer/solution attachment.

This is the highest-risk technical area in the project.

## Core rule

```text
宁可空，也不能错挂。
```

Missing answer/solution is acceptable.  
Wrongly attached answer/solution is unacceptable.

## Relevant modules

- `qisi-support-parser.js`
- `qisi-support-repair.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `qisi-pdf-support-controlled-write.js`
- PDF-related glue in `app.js`
- `tests/pdf-support-aligner.test.js`
- `tests/pdf-support-block-parser.test.js`
- `tests/batch-smoke-mock.test.js`
- `tests/fixtures/pdf-support-known-bad.js`

## Allowed alignment modes

Only these modes are valid:

- `full`
- `prefix`
- `fail-closed`

## Sequence reliability checks

Before attaching support, validate:

- normalized question numbers
- expected question numbers
- continuous prefix
- strictly increasing order
- duplicate markers
- jump-back markers
- unknown markers
- answer/solution sequence compatibility
- parser-vs-legacy field decisions
- objective answer normalization

## Forbidden alignment strategies

Never attach based on:

- semantic similarity
- keyword overlap
- math structure tokens
- triangle/vector/sin/cos/area keywords
- topic similarity
- AI-provided `question` alone
- nearest text block without sequence validation
- “looks right” visual judgment

## Objective answer rules

For objective questions:

- If answer is already a valid option label, preserve it.
- If answer is option value, convert only when exactly one option matches.
- If multiple options match the value, reject.
- For multiple-choice questions, reject option-value conversion; accept only valid label strings such as `ACD`.
- Parser answer must not overwrite safer legacy objective label.

## Solution rules

A parser solution may be kept when the answer is rejected only if field-level controlled write explicitly allows it and the sequence gate is safe.

Do not attach solution when sequence gate fails closed.

## Known-bad requirement

Known-bad sequence examples must remain protected, especially patterns like:

```text
1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 2
```

Such jump-back behavior must not attach later wrong answers.

## Required tests

Run:

```bash
npm test
npm run smoke:batch:mock
npm run verify:safe
```

When changing parser/alignment logic, include or preserve tests for:

- normal full
- prefix only
- missing number
- duplicate number
- jump-back number
- unknown marker
- cross-page support
- formula numbers not treated as question markers
- ambiguous objective answer rejection
- multi-choice value rejection
- parser solution kept only when safe

## Final report requirements

State:

```text
PDF support mode affected:
Known-bad behavior preserved:
Field-level controlled write affected:
Tests:
Risk:
```
```

---

## 13. Skill：skills/review-page-draft/SKILL.md

创建 `skills/review-page-draft/SKILL.md`：

```markdown
---
name: review-page-draft
description: Use when modifying the batch review page, draft question editor, recognition summary, draft image handling, or submit flow.
---

# Review Page Draft Skill

## Purpose

Protect the human review layer before formal question-bank insertion.

The review page is a safety boundary. It must make uncertainty visible.

## Relevant areas

- batch review template in `main.html`
- review CSS in `app.css`
- draft state and handlers in `app.js`
- active draft editor buffer
- draft images
- source page images
- recognition summary
- problem filters
- submit summary

## Invariants

The review page must show:

- total draft count
- answers present/missing
- solutions present/missing
- options present/missing
- image token count
- problem filter
- active draft editor
- answer and solution fields
- real question images
- source page images when available

## Draft editor rules

Editing LaTeX source must:

- preserve stem/options projection
- avoid deleting existing options unless user explicitly saves such state
- mark draft as user-edited
- preserve raw evidence
- update preview
- not modify submitted draft incorrectly

## Image rules

Separate:

- real question figures
- inline DOCX figures
- manual crops
- source page images
- unassigned images

Do not confuse source page screenshots with actual question diagrams.

## Submit rules

Do not bypass review.

Formal question-bank insertion should require explicit submit action and must preserve selected metadata.

## Common failure modes

Guard against:

- editor source loses options
- options duplicated or polluted
- image token inserted into wrong field
- source page image displayed as question figure
- clearing draft workspace deletes formal question bank
- recognition summary affects data instead of being read-only

## Required tests

For UI-only template/style changes:

```bash
npm run verify:safe
```

For draft transformation logic:

```bash
npm test
npm run smoke:batch:mock
npm run verify:safe
```

## Final report requirements

State:

```text
Review page data changed:
Draft schema changed:
Submit flow changed:
Tests:
Risk:
```
```

---

## 14. Skill：skills/app-js-boundary/SKILL.md

创建 `skills/app-js-boundary/SKILL.md`：

```markdown
---
name: app-js-boundary
description: Use whenever a task might require editing app.js.
---

# app.js Boundary Skill

## Purpose

Prevent `app.js` from growing into an unmaintainable business-logic sink.

`app.js` is high-risk because it coordinates many features.

## Before editing app.js

You must state:

```text
Why app.js must be touched:
Exact functions/regions:
Why a qisi-*.js module is not sufficient:
Expected line-level scope:
Tests:
```

If this cannot be answered, do not edit `app.js`.

## Allowed app.js changes

Allowed only when task explicitly permits:

- import/load a module
- call a module function
- pass helpers into module
- update UI status/progress
- small event handler fix
- preserve existing flow while adding shadow diagnostics
- remove glue after module extraction

## Forbidden app.js changes

Do not:

- add a new parser algorithm
- add a new PDF aligner
- add a new OCR workflow
- add field-level write policy
- perform broad refactor
- reformat unrelated code
- rename large sets of variables
- move stable DOCX logic without explicit migration task
- mix UI cleanup with recognition logic

## Preferred pattern

Instead of adding logic to `app.js`:

1. Create or update `qisi-*.js`.
2. Export pure functions for Node/browser.
3. Add tests.
4. Wire with minimal glue in `app.js`.
5. Run `verify:safe`.

## app.js final report requirement

When `app.js` changes, report:

```text
app.js touched: yes
Why:
Lines/functions:
New business logic added: yes/no
Could this be moved to qisi-*.js later:
Tests:
```
```

---

## 15. Skill：skills/testing-verification/SKILL.md

创建 `skills/testing-verification/SKILL.md`：

```markdown
---
name: testing-verification
description: Use when writing tests, changing test fixtures, running verification, or interpreting failures.
---

# Testing and Verification Skill

## Purpose

Convert coding work into verifiable results.

## Default command ladder

Use this order:

```bash
npm run check
npm test
npm run smoke:batch:mock
npm run verify:safe
```

## Safe final gate

The default final gate is:

```bash
npm run verify:safe
```

Do not replace it with a weaker command.

## Mock smoke policy

Mock smoke must not call real AI/OCR.

If any test path reaches:

- `/api/ai/chat`
- `/api/ai/ocr`
- network OCR
- paid upstream API

then the test must fail unless the task is explicitly a real-AI/OCR task.

## Fixture policy

Good fixtures represent historical bugs.

Do not simplify or delete fixtures that encode:

- DOCX stable chain
- PDF known-bad jump-back
- ambiguous option value
- duplicate question marker
- missing answer/solution
- cross-page support parsing

## Test change policy

Allowed:

- add failing test for a real bug
- add fixture for a new edge case
- update expected output when behavior intentionally changes and task says so

Forbidden:

- weaken assertions to make broken code pass
- delete a failing test because it is inconvenient
- change known-bad fixture to avoid fail-closed logic
- remove no-real-AI/OCR guards

## Failure handling

If a test fails:

1. Identify failing command.
2. Identify exact failing test.
3. Decide whether failure is in scope.
4. Fix only if in scope.
5. If out of scope, stop and report.

## Final report

Always include:

```text
Commands run:
Pass/fail:
Failing tests, if any:
Whether real AI/OCR was called:
```
```

---

## 16. Skill：skills/git-stage-workflow/SKILL.md

创建 `skills/git-stage-workflow/SKILL.md`：

```markdown
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
```

---

## 17. Skill：skills/local-ai-ocr-boundary/SKILL.md

创建 `skills/local-ai-ocr-boundary/SKILL.md`：

```markdown
---
name: local-ai-ocr-boundary
description: Use when touching qisi-local-server.js, AI proxy routes, OCR calls, vision model calls, or real-recognition testing.
---

# Local AI/OCR Boundary Skill

## Purpose

Prevent accidental paid calls, unstable external dependency use, and hidden OCR behavior in default tests.

## Relevant files

- `qisi-local-server.js`
- scripts using AI/OCR smoke tests
- any helper that calls `/api/ai/chat`
- any helper that calls `/api/ai/ocr`
- PDF/image recognition paths

## Default rule

No real AI/OCR calls in ordinary development.

Default safe tests must use mocks and fixtures.

## Explicit real-test requirement

A real AI/OCR task must specify:

```text
Purpose:
Model:
Input file:
Endpoint:
Expected max calls:
Expected cost/risk:
Success criteria:
Abort conditions:
Whether business code can be modified:
```

If these are missing, do not run the real test.

## Allowed commands only in explicit real-test task

```bash
npm run test:ai-proxy
npm run test:ai-vision-proxy
```

## Server boundary

When modifying local server:

- preserve request validation
- preserve model-name validation
- preserve timeout handling
- preserve body-size limits
- preserve no-secret logging
- do not print API keys
- do not weaken CORS/security casually

## DOCX conversion boundary

DOCX-to-PDF conversion can use Word COM or LibreOffice.

Do not make DOCX conversion mandatory for normal DOCX parsing unless task explicitly says so.

## Final report

State:

```text
Real AI/OCR called: yes/no
Endpoint:
Model:
Number of calls:
Cost risk:
Tests:
```
```

---

## 18. Skill：skills/qisi-module-refactor/SKILL.md

创建 `skills/qisi-module-refactor/SKILL.md`：

```markdown
---
name: qisi-module-refactor
description: Use when extracting logic from app.js into qisi-*.js modules or creating new qisi modules.
---

# Qisi Module Refactor Skill

## Purpose

Move complex business logic out of `app.js` safely.

## Module pattern

New modules should generally support both browser and Node tests.

Preferred wrapper:

```javascript
(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.ModuleName = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        // implementation

        return {
            exportedFunction
        };
    }
);
```

Use existing project style if different in nearby files.

## Refactor sequence

1. Identify pure logic inside `app.js`.
2. Add focused tests against current behavior.
3. Extract to `qisi-*.js`.
4. Export functions.
5. Load module in `main.html` if browser use is needed.
6. Wire minimal call in `app.js`.
7. Run `verify:safe`.

## What to extract first

Good candidates:

- PDF support field policies
- parser helpers
- sequence validation
- draft normalization
- image classification
- review problem detection
- no-real-AI guards

Bad candidates for casual extraction:

- large Vue state object
- template-specific computed chains
- multiple unrelated event handlers

## Compatibility rules

Preserve:

- function behavior
- warning codes
- draft schema
- test fixtures
- browser global namespace
- Node require compatibility

## Forbidden refactor behavior

Do not:

- rewrite the entire batch engine
- migrate DOCX and PDF at the same time
- change behavior without tests
- rename public exports casually
- alter script loading order without checking dependencies
- remove legacy path before shadow/migration proof

## Final report

State:

```text
Extracted from:
New module:
Exports:
app.js lines reduced or not:
Behavior changed: yes/no
Tests:
```
```

---

## 19. 本任务最终验收

完成文件创建后执行：

```bash
npm run verify:safe
git status --short
git diff --stat
```

如果 `verify:safe` 通过，提交：

```bash
git add AGENTS.md ai skills
git commit -m "stage C8A add agent constitution and skills"
```

最终报告格式：

```text
Stage: C8A
Changed files:
Diff stat:
Tests:
Commit:
Working tree:
Not done:
Next recommended task:
```

下一步建议只能写，不得执行。建议下一步为：

```text
C8B：新增 verify:diff-scope 与 verify:no-real-ai 脚本，将文档规则转成可执行红绿灯。
```
