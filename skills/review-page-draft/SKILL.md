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