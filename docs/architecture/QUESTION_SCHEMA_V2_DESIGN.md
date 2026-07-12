# Question Schema v2 Design

## Canonical version

```text
qisi.question.v2
```

Schema v2 is used for new formal admissions. Existing questions remain unchanged
and are read through a compatibility adapter; no bulk content migration is part
of Program A.

## Record shape

```text
id
schemaVersion
questionNumber
type
stem
options
answer
solution
images
source
admission
provenance
recognition
createdAt
updatedAt
confirmedAt
```

Existing library metadata (`grade`, `diff`, knowledge fields, tags, and `meta`)
may remain as compatible extension fields, but cannot replace the v2 safety
fields.

## Field rules

- `id`: non-empty stable string.
- `questionNumber`: non-empty string; never semantically guessed.
- `type`, `stem`: non-empty strings.
- `options`, `images`: arrays; option rules remain type-aware.
- `answer`, `solution`: strings; empty only when the admission mode and product
  rule explicitly allow it. A formal objective question still requires a valid
  answer.
- All v2 timestamps are ISO-8601 UTC strings. `createdAt <= updatedAt` and
  `confirmedAt <= updatedAt`.

## Source

```text
mode: manual | docx-deterministic | pdf-ai | imported-package
sourceId
batchId
fileIds[]
packageId/packageHash when applicable
sourceHash when available
```

Manual records require no recognition engine. DOCX source metadata must not claim
AI or controlled-write evidence.

## Admission

```text
schemaVersion: qisi.admission.v1
decisionId
mode
policyVersion
draftId
draftVersion
confirmedBy
confirmedAt
idempotencyKey
```

The embedded admission summary must match the repository audit metadata and the
record source mode.

## Per-field provenance

`provenance` is a record keyed by the six formal fields. Each value follows the
Formal Admission provenance design and is immutable. Consistency rules include:

- `manual` requires a manual revision reference;
- `deterministic-source` is allowed for deterministic document/package evidence;
- `controlled-write` is allowed only for PDF/AI fields and requires an accepted
  decision reference;
- `rejected` cannot accompany a non-empty formal value;
- `missing` cannot accompany a required non-empty formal value;
- no engine confidence may be attached to a manual field.

## Recognition

`recognition` is nullable. When present:

```text
engine
engineVersion
requestIds[]
candidateRefs[]
```

It is trace metadata, not admission authority. Raw responses and private text are
not embedded in the formal record.

## Runtime validation

`validateQuestionV2` must validate shape, time types/order, source/admission mode
agreement, complete provenance keys, provenance/value consistency, objective
answer rules, and recognition constraints. It returns stable errors and never
repairs or invents fields.

## Compatibility

- v2 validator never mutates input.
- `legacyQuestionToReadableV2` creates a read view marked
  `legacy-compatibility-read-only`; it does not persist or claim an admission.
- Existing v1 draft adapters remain for review compatibility.
- Only the formal-admission builder may construct a new persistable v2 record.
- Legacy records continue to export/read without silent rewrite.
