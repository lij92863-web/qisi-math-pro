# Formal Admission Policy Design R1

## Purpose and ownership

`Qisi.FormalAdmissionPolicy` is the single policy deciding whether a reviewed
draft may become a formal question. It sits above controlled-write:

- controlled-write owns machine acceptance of PDF/AI-derived fields;
- Formal Admission owns source-aware eligibility of the complete formal record;
- the repository owns the atomic write and reruns this policy.

The policy is pure: no DOM, Vue, database, OCR, network, or mutation.

## Public API

```text
createAdmissionContext(input)
evaluateDraftAdmission(draft, context)
validateAdmissionDecision(decision, draft, context)
buildQuestionV2(draft, decision, options)
```

## Admission modes

```text
manual
docx-deterministic
pdf-ai
imported-package
```

`createAdmissionContext` must require an explicit mode, actor/confirmation
evidence, source metadata, request/idempotency IDs, and a fixed evaluation time.
Unknown modes fail with `admission-mode-unsupported`.

## Field provenance

Every formal field has exactly one decision entry:

```text
questionNumber
stem
options
answer
solution
images
```

Each entry contains:

```text
field
status: manual | deterministic-source | controlled-write | rejected | missing
sourceId
sourceOrder/page/block when known
evidenceRef
controlledWriteDecisionId when applicable
manualEditRevision when applicable
reasonCode
```

Duplicate entries, unknown fields, missing entries, or contradictory status and
evidence fail closed.

## Mode rules

### manual

- Requires explicit teacher confirmation.
- Present fields must have `manual` provenance and an actual field-edit revision
  or an explicitly created manual draft revision.
- Recognition is nullable and no engine/confidence is invented.
- Merely clicking confirm on a machine-populated field does not convert it to
  manual.

### docx-deterministic

- Requires valid deterministic source metadata, valid draft schema, and explicit
  teacher confirmation.
- Machine-extracted fields use `deterministic-source`; teacher-rewritten fields
  use `manual` with revision evidence.
- `rejected` data never enters the record. Required missing fields fail; optional
  solution/images may remain missing with explicit provenance.
- Controlled-write evidence must not be fabricated for DOCX.

### pdf-ai

- Every present machine-derived field must reference an accepted field-level
  controlled-write decision.
- A rejected/missing field remains rejected/missing unless the teacher actually
  rewrites that field, creating a later manual revision.
- Global `userEdited`, `manualEdited`, or `manualConfirmed` booleans cannot wash
  field-level rejection.
- Ownership-invalid answer/solution evidence always fails admission until a
  genuine manual rewrite replaces that field.
- Safe partial is admissible only after all required formal fields are valid;
  otherwise it remains a review draft.

### imported-package

- Requires a supported package schema, source/package hashes, explicit
  confirmation, and provenance for every field.
- Unknown/rejected fields fail closed; imported data is never considered manual
  merely because the package was selected.

## Decision shape

```text
schemaVersion: qisi.admission.v1
decisionId
mode
draftId
draftVersion
accepted
fieldDecisions[]
errors[]
warnings[]
evaluatedAt
policyVersion
```

An accepted decision must be immutable, match the current draft ID/version, have
one decision per field, and contain no error. The repository rejects stale or
caller-authored malformed decisions and reruns evaluation.

## Stable error codes

```text
admission-context-invalid
admission-mode-unsupported
admission-confirmation-required
admission-provenance-missing
admission-provenance-duplicate
admission-field-rejected
admission-required-field-missing
admission-controlled-write-required
admission-controlled-write-rejected
admission-manual-revision-required
admission-package-schema-invalid
admission-decision-malformed
admission-decision-stale
```

## Safety invariants

- Policy cannot write storage or change a draft.
- Raw evidence is referenced, not copied into the formal question.
- No semantic ownership inference is permitted.
- Route B is never an accepted evidence source.
- An admission decision is necessary but insufficient for persistence; only the
  repository transaction may commit it.
