# OCR Evidence-Based Structure Extraction R1

## Input and authority

The extractor consumes a validated B2-5 reading-order result. It does not call an
engine, re-sort the page, infer ownership, run controlled-write, build a review
draft, or persist a question.

Every extracted question remains:

```text
ownershipStatus = unvalidated
eligibleForControlledWrite = false
eligibleForFormalAdmission = false
```

## Deterministic extraction

- An explicit `question-anchor` starts a group. Question number parsing accepts
  only a strict numeric anchor marker; explicit full-width digits are mapped one
  by one, while compatibility characters such as circled numbers are not folded
  into question numbers. Invalid anchors remain visible with warning.
- Only explicit `stem`, `option`, `answer`, `solution`, `formula`, and `image`
  block types populate their matching evidence fields.
- Stem, answer, and solution retain raw text and block ids plus a deterministic
  normalized display value. Answer/solution are candidate evidence only.
- Formula and image evidence retain bbox, confidence and originating block id.
- Blocks before an anchor or with an unsupported type remain unassigned evidence.

Options contain `label`, `rawText`, `normalizedText`, `bbox`, `confidence`,
`missing`, and `blockId`. A strict A-H marker or explicit option label is required.
Duplicate labels and JSON/fenced wrappers are rejected, warned, and retained in
`rejectedEvidence`; they never become option values.

Missing option records are emitted only when the caller supplies explicit expected
labels for that exact question. Their content is empty and `missing=true`; the
extractor never invents option text. Solution text does not become an option even
if it begins with `A.`. Answer evidence never supplies a missing stem.

## Evidence status

- Implemented and unit-tested as a pure scaffold owner.
- Reading-order and extraction targeted tests: 14 passing at implementation time.
- Real benchmark measurement: no.
- Production page wiring: no.
- Ownership validation or safe partial: no; reserved for B2-7.
- Production-promoted: no.
