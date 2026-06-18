# Local Test Materials

## Purpose

This document records local real test materials that are intentionally not committed to Git.

`local-test-materials/` is ignored by Git and is used only for controlled manual or real-file validation tasks.

Default automated tests must not read these files.

## Safety Rules

- Do not commit `local-test-materials/`.
- Do not read file contents unless a task explicitly allows it.
- Do not run OCR/AI unless a task explicitly allows it.
- Do not use these files in default `verify:safe`.
- Real-file validation must be a separate task.
- Failure during real-file validation should first be recorded before code changes are made.

## Case List

### case01-docx-docx-stable

Relative path:

```text
local-test-materials/case01-docx-docx-stable/
```

Expected files:

| File                            | Role     | Format | Notes                          |
| ------------------------------- | -------- | ------ | ------------------------------ |
| 01-question.docx                | question | DOCX   | Real DOCX question file        |
| 02-support-answer-solution.docx | support  | DOCX   | Real DOCX answer/solution file |

Purpose:

```text
Used for controlled real DOCX+DOCX validation.
Should not require real AI/OCR.
Primary future task: C9A.
```

Default restrictions:

```text
Do not read content in ordinary tasks.
Do not call OCR.
Do not modify DOCX parsing unless a follow-up task explicitly allows it.
```

### case02-pdf-pdf-real

Relative path:

```text
local-test-materials/case02-pdf-pdf-real/
```

Expected files:

| File                           | Role     | Format | Notes                         |
| ------------------------------ | -------- | ------ | ----------------------------- |
| 01-question.pdf                | question | PDF    | Real PDF question file        |
| 02-support-answer-solution.pdf | support  | PDF    | Real PDF answer/solution file |

Purpose:

```text
Used for controlled real PDF+PDF validation.
May require OCR/AI depending on current parser path.
Primary future task: C9B or later.
```

Default restrictions:

```text
Do not read content in ordinary tasks.
Do not call OCR/AI without explicit user permission.
Do not attach answers/solutions unless alignment is reliable.
Fail closed when uncertain.
```

## Recommended Next Tasks

### C9A - Real DOCX+DOCX validation, record only

Allowed:

```text
Read case01 DOCX files through the existing app workflow or controlled tooling.
No real AI/OCR.
No code changes unless follow-up task allows.
Record result only.
```

### C9B - Real PDF+PDF validation planning

Allowed:

```text
Plan how to validate case02.
Do not call OCR/AI yet.
Define cost, permission, expected outputs, and stop conditions.
```

## Status

Created during C8D.
