# DOCX Producer Identity Contract Decision R1

## Decision context

- baseline: `9ab2f21282af4f5eb394658f31d5ba357cd46ca5`
- Program C state: Phase 5 remains blocked
- normal UI owner: legacy `processDraftImportBatch`
- Bridge: shadow/scaffold only
- C2-11 and later Program C phases: prohibited
- frozen PDF high-risk owners: unchanged by this decision

The current `source.mode` field combines two independent facts:

1. the format selected by the user (`docx`, `pdf`, manual, package); and
2. the producer that created a field (deterministic parser, vision AI, manual).

That model cannot truthfully describe the production normal-UI route
`DOCX → rendered PDF → vision AI`. Calling the source `pdf` loses the user's
source identity. Calling the producer `docx-deterministic` fabricates the
field producer.

## Options considered

### Option A — extend `source.mode`

Add another combined value such as `docx-vision-ai` while retaining the
current single-axis field.

Advantages:

- smaller immediate edits to Formal Admission and Question Schema v2;
- old `source.mode` comparisons remain mechanically familiar.

Risks:

- the field remains an expanding cross-product of format and producer;
- route transition and route reason still have no owner;
- a future deterministic-PDF, image-vision, or DOCX hybrid route requires more
  combined enum values;
- per-field provenance must continue to reverse-engineer producer facts from a
  record-wide combined label;
- compatibility mapping remains ambiguous for legacy records whose producer is
  not known.

Option A reduces the first migration diff but preserves the root modeling bug.

### Option B — split source, producer, and route identity

Canonical identity becomes:

```text
source: {
  sourceId,
  format,
  filename,
  mimeType,
  sourceOrder
}

producer: {
  mode,
  routeId,
  routeReason,
  engine,
  deterministic
}

route: {
  identity,
  reason,
  transitions[]
}
```

Allowed canonical source formats:

```text
docx
pdf
image
manual
imported-package
```

Allowed canonical producer modes:

```text
deterministic-docx
deterministic-pdf
vision-ai
manual
imported-package
```

The active DOCX vision route is represented exactly as:

```text
source.format = docx
producer.mode = vision-ai
producer.routeId = docx-rendered-to-pdf-vision
producer.deterministic = false
```

The converted PDF is an internal route transition and never replaces the
original source format.

## Selected option

**Option B is selected.**

No production evidence shows that separating the axes creates an uncontrollable
migration risk. The split instead removes ambiguity, permits fail-closed
validation at each producer boundary, and prevents comparator equivalence from
hiding a producer mismatch.

`source.mode` remains readable only as a legacy compatibility input. It is not
the canonical owner for new producer identity and must not be written as a
post-hoc substitute for the split contract.

## Canonical contract invariants

### Source invariants

- `source.format` records the original user-selected source.
- DOCX rendering never changes `source.format` to `pdf`.
- source identity comes from the batch manifest, not a UI label or final draft.
- `sourceId`, filename, MIME, and source order remain diagnostic metadata; none
  may infer a producer decision.

### Producer invariants

- `producer.mode` is assigned by the field-producing owner.
- deterministic DOCX fields may only originate from the DOCX XML importer.
- vision fields may only originate from a recorded vision engine execution.
- `producer.routeId` and `route.reason` use stable codes.
- missing producer or route identity fails before canonical review handoff.

### Provenance invariants

Every formal field has one producer-time decision containing at least:

```text
kind/status
sourceId
sourceFormat
producerMode
routeId
engine
page
blockIds
controlledWriteDecisionId
controlledWriteAccepted
manuallyEdited
reasonCode
```

- deterministic fields use `deterministic-source` and an evidence reference;
- vision fields use only `controlled-write`, `rejected`, or `missing`;
- a vision field without a real accepted controlled-write decision fails closed;
- `manualReviewRequired` cannot convert invalid vision output into accepted
  provenance;
- review and persistence layers only preserve provenance; they never create it.

### Route invariants

The normal DOCX vision route records this ordered transition history:

```text
docx-selected
docx-rendered
vision-route-selected
vision-engine-result-produced
controlled-write-evaluated
provenance-projected
review-candidate-built
```

Each transition has a stable code and reason. Filename guessing, UI labels,
final draft inference, comparator repair, and persistence repair are forbidden.

## Impact analysis

### Question Schema v2

- New formal questions carry canonical `source`, `producer`, and `route`.
- `source.mode` may remain only on legacy/read compatibility views.
- source/admission matching changes from combined-mode equality to validated
  source/producer/route consistency.
- the schema remains fail-closed for missing identity and provenance.

### Import Candidate / ValidatedQuestionDraft

- identity and field provenance must exist before validation;
- candidate normalizers preserve these records without constructing them;
- validation rejects deterministic/vision cross-contamination;
- legacy-unknown compatibility records remain review-only.

### ProductionImportBridge

- deterministic DOCX and DOCX vision are separate source-producer routes;
- a DOCX vision shadow port may call the shared production vision projection;
- Bridge must not reproduce vision parsing, controlled-write, or provenance
  algorithms;
- normal UI remains the current legacy owner during this package.

### Normal UI legacy path

- the existing DOCX-to-PDF vision producer remains active;
- identity/provenance projection is added at the first candidate-field producer
  boundary, not at review or persistence;
- route transitions are captured during actual execution;
- no production-owner switch or legacy deletion is authorized.

### Formal Admission

- policy resolves the split contract first;
- deterministic producers accept deterministic or genuinely manual fields;
- vision producers accept controlled-write or genuinely manual fields;
- source format cannot relax producer rules;
- legacy combined modes remain supported only when their mapping is exact;
- `legacy-unknown` always fails formal admission.

### Repository and formal-question construction

- repository continues to rerun Formal Admission atomically;
- the formal builder preserves canonical identity and immutable provenance;
- repository never infers producer identity;
- existing v2 records remain readable without bulk rewrite.

### Review drafts

- `ReviewDraftBuilder` continues to clone/freeze supplied identity and
  provenance;
- missing identity is rejected by production validation;
- post-hoc source/provenance construction is prohibited by an architecture gate.

### Comparators

- `source.format`, producer mode, route ID/reason/transitions, and complete
  stable provenance are protected fields;
- deterministic and vision cases cannot compare as the same canonical case;
- only explicitly volatile request/time/path/diagnostic IDs may be ignored.

### Tests

Tests must cover deterministic identity, vision identity, DOCX-rendered source
format, producer/provenance cross-contamination, missing identity, missing
controlled-write, review-layer forgery, legacy-unknown read-only behavior,
normal UI and Bridge shadow routes, comparator mismatch, PDF non-regression,
DOCX stability, and no-real-AI behavior.

## Compatibility strategy

Exact legacy mappings are read-only and deterministic:

| Legacy `source.mode` | Source format | Producer mode | Compatibility route |
| --- | --- | --- | --- |
| `manual` | `manual` | `manual` | `legacy-manual` |
| `docx-deterministic` | `docx` | `deterministic-docx` | `legacy-docx-deterministic` |
| `pdf-ai` | `pdf` | `vision-ai` | `legacy-pdf-vision` |
| `imported-package` | `imported-package` | `imported-package` | `legacy-imported-package` |

Rules:

- a mapping is used for compatibility reads, not silent persisted rewrites;
- records without an exact mapping are marked `legacy-unknown`;
- `legacy-unknown` is never treated as deterministic, vision-controlled, or
  manual;
- Formal Admission rejects `legacy-unknown`;
- new writes require the canonical split contract.

## PDF safety and DOCX stability

- Existing PDF projection and controlled-write owners remain unchanged.
- A compatibility adapter maps existing truthful PDF identity into the split
  contract without widening accepted fields.
- PDF validators continue to require the same accepted controlled-write
  decisions and ownership evidence.
- DOCX deterministic output values are unchanged; only producer-time identity
  and evidence metadata are added.
- DOCX vision values are unchanged; unsafe/missing controlled-write results are
  rejected before canonical review handoff.

## Ownership decision

One production module will own source/producer/route validation, compatibility
mapping, deterministic DOCX provenance projection, and DOCX vision provenance
projection. It will consume a controlled-write decision; it will not duplicate
OCR, parser, aligner, or PDF controlled-write algorithms.

The same owner must be called by:

- the deterministic DOCX producer adapter;
- the normal-UI DOCX vision producer boundary;
- the Bridge DOCX deterministic/vision shadow adapters;
- Formal Admission and schema validators for identity validation.

## Architecture decision

`OPTION_B_SPLIT_SOURCE_PRODUCER_ROUTE_SELECTED`

Implementation may proceed within this corrective package. Phase 5 remains
blocked and C2-11 remains prohibited.
