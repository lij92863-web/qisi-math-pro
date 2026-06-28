# BM-AUTO Doc Audit Policy

Stage: BM-AUTO-DOC-AUDIT-POLICY

Branch: main

Start commit: 68eca6dac3d620e1317c044c51fa0ac776638d05

## Objective

Define a strict but reasonable doc audit policy for `docs/refactor`.

The policy must keep current active campaign documents as a hard gate while allowing historical completed documents to be normalized or archived with explicit markers.

## Active Campaign Docs

Scope:

- `docs/refactor/BM_AUTO_A4_R3_RESIDUAL*.md`
- `docs/refactor/BM_AUTO_A4_R3_*MEDIUM*.md`
- `docs/refactor/BM_AUTO_A4_R3_FORCE*.md`
- `docs/refactor/BM_AUTO_A4_R3_COMMITTED*.md`
- `docs/refactor/BM_AUTO_A4_R3_DOC_AUDIT*.md`
- `docs/refactor/BM_AUTO_DOC_AUDIT*.md`

Rules:

- hard gate
- physical line count >= 20
- heading count >= 4
- no literal backslash-n
- no to-do marker
- no not-completed marker
- must contain `Stage`
- must contain `Branch` or commit
- must contain `Validation` or `Tests`
- must contain `Safety`
- must contain `Decision`

## Historical Completed Docs

Scope:

Older `BM_AUTO` documents that are not part of the active residual or doc-audit campaign.

Rules:

- must not contain literal backslash-n
- must not contain to-do marker
- must not contain not-completed marker
- must have at least `Stage` or a historical note
- must have `Decision` or `Historical status`
- must be at least 10 physical lines unless marked as an intentionally brief index

Historical documents may use conservative language such as `Not recorded in this historical document` when old stage evidence was not captured.

## Archived Exception Docs

Archived exceptions are allowed only for historical auxiliary documents.

Required marker:

```text
Archived-Doc-Audit-Status: archived
Archive-Reason:
Historical-Status:
```

Archived exception rules:

- no literal backslash-n
- no to-do marker
- no not-completed marker
- no raw one-line compression
- physical line count >= 10

## Forbidden Audit Behavior

Do not ignore all of `docs/refactor`.

Do not ignore documents by age alone.

Do not ignore failures silently.

Do not pass documents with literal backslash-n.

Do not pass documents with to-do or not-completed markers.

Do not turn the audit into a no-op.

## Validation

Policy document added as documentation only.

Tool implementation and tests are handled in the next phase.

## Safety

No production source files are changed by this policy document.

`app.js`, `qisi-utils.js`, PDF modules, package files, and UI files are not touched.

## Decision

Doc audit policy defined.
