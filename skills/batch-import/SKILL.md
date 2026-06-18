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