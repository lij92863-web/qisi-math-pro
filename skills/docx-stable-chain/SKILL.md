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