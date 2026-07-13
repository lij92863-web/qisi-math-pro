# DOCX Producer Identity and Route Contract Correction R1

## Stage

`DOCX PRODUCER IDENTITY AND ROUTE CONTRACT CORRECTION R1`

This is an independent corrective work package. Program C Phase 5 was not
resumed, the normal UI production owner was not switched, the legacy path was
not deleted, and C2-11 or later phases were not entered.

## Baseline

- start commit: `9ab2f21282af4f5eb394658f31d5ba357cd46ca5`
- branch: `stage/app-shell-slimming-r3`
- starting state: clean; local, tracking, and live remote equal
- prior blocker: the normal UI deliberately produced DOCX fields through the
  DOCX-to-rendered-PDF vision route while Bridge produced deterministic DOCX
  fields; the combined `source.mode` axis could not represent that fact
- frozen PDF files at start: six

## Architecture decision

The decision record is
`docs/architecture/DOCX_PRODUCER_IDENTITY_CONTRACT_DECISION_R1.md`.

Option B was selected:

```text
source.format
+ producer.mode
+ route.identity / route.reason / route.transitions
```

Canonical DOCX vision identity is:

```text
source.format = docx
producer.mode = vision-ai
route.identity = docx-rendered-to-pdf-vision
```

Canonical deterministic DOCX identity is:

```text
source.format = docx
producer.mode = deterministic-docx
route.identity = docx-deterministic-import
```

`source.mode` is now only an exact, read-only legacy compatibility input.
Unknown legacy values resolve to `legacy-unknown` and fail Formal Admission.
No compatibility read writes inferred identity back to storage.

## Unique production contract owner

`qisi-docx-producer-identity-contract.js` is the single owner for:

- canonical source/producer/route validation;
- exact legacy identity mapping;
- deterministic DOCX producer-time projection;
- DOCX vision producer-time controlled-write projection;
- structured canonical DOCX comparison.

The owner does not call UI, DB, OCR transport, PDF parser/aligner, Formal
Admission, or persistence. Bridge and review/persistence layers do not contain
an independent provenance or vision projection implementation.

## Producer-time provenance

The normal UI vision chain calls the shared owner at the first conversion of a
strict engine result into candidate fields in
`recognizeStrictQuestionPageWithQwen`. Each field records stable producer-time
evidence including source ID/format, producer mode, route ID, engine, page,
block IDs, controlled-write decision ID/acceptance, edit state, reason code,
producer boundary, and contract version.

Vision fields can only be `controlled-write`, `rejected`, or `missing`.
Deterministic DOCX fields can only be `deterministic-source` or `missing` before
a real field-level manual edit. Missing or malformed controlled-write evidence,
decision/source conflict, an unauthorized present field, raw JSON, placeholder
content, mixed identity axes, or an invalid transition sequence fails closed.
`manualReviewRequired` cannot create canonical handoff authority.

## Production call graphs

Normal UI DOCX vision:

```text
AppProxy.runBatchRecognition
-> processDraftImportBatch (legacy owner remains active)
-> processDocxByLocalConvertAndStrictVision
-> convertDocxRecordToPdfRecord
-> recognizeStrictQuestionPageWithQwen
-> strict engine result + strict controlled-write decision
-> DocxProducerIdentityContract.projectDocxVisionCandidate
-> mergeDraftRecognition (preserve only)
-> existing review-draft persistence
```

Bridge DOCX vision shadow:

```text
ProductionImportBridge.runDocxVisionShadow
-> ProductionDocxVisionSourcePort.runDocxVisionShadow
-> injected deterministic mock vision producer
-> DocxProducerIdentityContract.projectDocxVisionCandidate
-> isolated shadow result and diagnostics
```

Deterministic DOCX production entry:

```text
ProductionDocxSourcePort.parseDocxSource
-> QisiBatchImporter.importDocxFile
-> existing convertDraft adapter
-> DocxProducerIdentityContract.projectDeterministicDocxCandidate
-> accepted deterministic candidates
```

Formal flow:

```text
ProductionReviewValidator / BatchFormalSubmit
-> FormalAdmissionPolicy.resolve canonical identity
-> producer/provenance validation
-> StorageRepository atomic re-evaluation
-> buildQuestionV2 preserves source + producer + route
```

## Route transition contract

The browser-proven normal UI route records, in order:

1. `docx-selected`
2. `docx-rendered`
3. `vision-route-selected`
4. `vision-engine-result-produced`
5. `controlled-write-evaluated`
6. `provenance-projected`
7. `review-candidate-built`

Every transition has a stable reason. Original DOCX source identity is retained
through the internal PDF rendering step.

## Compatibility and validation

- Exact legacy mappings remain readable for `manual`, `docx-deterministic`,
  `pdf-ai`, and `imported-package`.
- `legacy-unknown` is read-only and cannot pass Formal Admission.
- Question Schema v2 and Formal Admission validate the split identity.
- Formal question construction preserves canonical source/producer/route.
- A genuine field-level teacher edit creates manual provenance; click-only
  confirmation does not wash rejected evidence.
- Review and persistence owners preserve supplied evidence and cannot construct
  producer-boundary evidence.

## Narrow prerequisite repair

The real deterministic `1.docx` producer exposed a pre-existing corrupted
option-label character class in `qisi-batch-importer.js`. The malformed global
regular expression could make a zero-length match and throw
`RangeError: Invalid array length`. The one-line character class was restored
to the intended delimiter set. A production-linked architecture regression
prevents the zero-length form from returning. No DOCX business output or PDF
route was broadened.

## Browser evidence

The true-browser test starts the normal `main.html`, seeds the actual `1.docx`
source record, calls `AppProxy.runBatchRecognition`, performs the real local
DOCX conversion, and uses a deterministic one-page render transport plus a
locally intercepted strict vision response. It does not seed final drafts.

- normal UI legacy vision drafts persisted: 6
- normal UI source format: `docx`
- normal UI producer mode: `vision-ai`
- strict mocked engine calls: 1
- deterministic production-port drafts from the actual DOCX: 6
- deterministic producer mode: `deterministic-docx`
- canonical differences between legacy vision and Bridge vision shadow: 0
- wrong attachments: 0
- raw JSON leakage: 0
- placeholder leakage: 0
- Bridge review-draft writes: 0
- Bridge formal writes: 0
- normal UI formal writes: 0
- forbidden/outbound requests: 0
- `realApiCalled`: `false`

The deterministic scenario is intentionally separate from the vision
equivalence scenario; they are not compared as the same semantic route.

## Tests and gates

- broad producer/route/browser/DOCX/Formal/storage target: 120/120
- corrective identity/route/architecture/browser target: 39/39
- runtime/architecture/Formal/storage gate: 43/43
- full `verify:safe` suite: 1473/1473 across 54 suites
- batch smoke: 20/20
- Base Migration: 15/15
- Route B hold: 6/6
- PDF known-bad: 65/65
- controlled-write answer ownership: 21/21
- DOCX stable: 20/20
- `verify:batch-safety`: passed
- `verify:no-real-ai`: passed
- PDF browser preflight: passed; `realApiCalled=false`
- PDF browser dry-run: passed; `realApiCalled=false`
- all 11 mandatory gates: passed
- failed: 0
- skipped/todo: 0
- timeout: 0

No real-run, AI proxy, vision proxy, real AI, or real OCR call was executed.

## Safety and scope

- normal UI owner switched: no
- legacy owner deleted: no
- Bridge status: shadow only
- comparator weakened: no
- Formal Admission weakened: no; canonical checks were strengthened
- controlled-write weakened or duplicated: no
- PDF acceptance range expanded: no
- six frozen PDF high-risk files modified: no
- Phase 5 resumed: no
- C2-11 or later phase entered: no

## Changed files

Production/runtime:

- `app.js`
- `main.html`
- `qisi-docx-producer-identity-contract.js`
- `qisi-production-docx-source-port.js`
- `qisi-production-docx-vision-source-port.js`
- `qisi-production-import-bridge.js`
- `qisi-formal-admission-policy.js`
- `qisi-recognition-contracts.js`
- `qisi-production-review-validator.js`
- `qisi-batch-formal-submit.js`
- `qisi-batch-importer.js`

Evidence/tests:

- `docs/architecture/DOCX_PRODUCER_IDENTITY_CONTRACT_DECISION_R1.md`
- `tests/docx-producer-identity-contract.test.js`
- `tests/docx-producer-route-contract.test.js`
- `tests/docx-producer-identity-architecture-gate.test.js`
- `tests/e2e/docx-producer-identity-browser.test.js`
- this release report
- `ai/APP_SHELL_SLIMMING_R3_STATE.md`

## Git seal

- start commit: `9ab2f21282af4f5eb394658f31d5ba357cd46ca5`
- architecture decision commit: `4cb1ed44fca0860254de35588532851921181dac`
- implementation commit: `456f9ce83e0639614476a62c308c2007dd16ba5f`
- evidence/state seal: the branch HEAD used by final three-way verification
- pushed: required before acceptance
- final working tree: required clean
- local/tracking/live remote equality: required before acceptance

## Remaining limitations

- This package establishes identity and producer-time evidence; it does not
  accept Phase 5.
- The normal UI remains the legacy DOCX vision owner.
- Bridge remains shadow-only and performs no production review/formal writes.
- Full Phase 5 equivalence must be resumed only in the next independent task.
- C2-11 remains prohibited until Phase 5 is separately accepted.

## Decision

`DOCX_PRODUCER_IDENTITY_CONTRACT_ACCEPTED`

Stop after this package. Do not resume Phase 5 or enter C2-11 in this task.
