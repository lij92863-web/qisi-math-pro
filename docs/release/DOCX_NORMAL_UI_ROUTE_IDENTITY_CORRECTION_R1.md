# DOCX Normal-UI Route Identity and Provenance Correction R1

## Stage

`DOCX NORMAL-UI ROUTE IDENTITY AND PROVENANCE CORRECTION R1`

## Baseline

- branch: `stage/app-shell-slimming-r3`
- start production commit:
  `82f44d5bfc12983e1467151ec600d95b2b7c61fb`
- end production commit:
  `82f44d5bfc12983e1467151ec600d95b2b7c61fb`
- working tree at start: clean
- Program C state: blocked at Phase 5
- normal UI owner: legacy `processDraftImportBatch`
- C2-11: prohibited

## Fact audit

The required fact-first audit is sealed in
`docs/architecture/DOCX_NORMAL_UI_ROUTE_IDENTITY_AUDIT_R1.md`.

Root-cause classification:

`C_INTENTIONAL_LEGACY_DOCX_VISION_ROUTE_WITH_NO_LEGAL_CANONICAL_MODE`

### Normal UI route

```text
file selection / drop
→ FileDispatcher.getFileType(filename) = docx
→ purpose-role selection
→ batch/file persistence
→ runBatchRecognition
→ LegacyBatchRunCoordinator
→ processDraftImportBatch
→ BatchContextService / SourceRoleClassifier retain docx
→ processDocxByLocalConvertAndStrictVision
→ virtual converted PDF
→ strict visual/Qwen recognition
→ legacy normalization and review-draft persistence
```

### Bridge scaffold route

```text
ProductionImportBridge
→ sourceRoute = docx
→ deterministic-source-loaded
→ runDocxImport
→ DocxImportCoordinator
→ ProductionDocxSourcePort
→ QisiBatchImporter Word XML producer
→ shared validation / review / persistence ports
```

The paths first diverge at the field producer. Upload type, MIME, role
classification, and the browser fixture are not responsible.

## Route and provenance findings

- A hidden internal DOCX-to-PDF vision adapter exists and is production-active.
- It is selected deliberately for every normal-UI DOCX question/full source.
- Visual success exits the file loop.
- Visual failure is rethrown; deterministic import is not a fallback from that
  branch.
- The residual XML importer block later in the legacy owner is unreachable for
  this ordinary case.
- The legacy visual producer creates `sourceTrace` but no canonical
  `source.mode` and no per-field `fieldProvenance`.
- The deterministic DOCX importer also does not yet create canonical per-field
  provenance in its production adapter; Bridge tests supply deterministic mode
  in fixtures.
- Review-draft and persistence layers correctly do not invent missing
  provenance.

## Schema blocker

The admission schema permits only:

- `manual`
- `docx-deterministic`
- `pdf-ai`
- `imported-package`

No mode truthfully represents a DOCX source whose fields came from converted
PDF vision.

- `docx-deterministic` would fabricate the producer identity.
- `pdf-ai` would misstate the source route and requires accepted
  controlled-write evidence that the legacy DOCX visual producer does not
  create.
- post-hoc provenance construction would violate the required producer-time
  ownership rule.
- routing normal UI to the deterministic V2/Bridge owner would switch the
  production route before Phase 5 acceptance and enter the prohibited C2-11
  territory.

The work package therefore reached its explicit C-case stop condition before
any production code change.

## Tests

Read-only route/schema owner matrix:

```text
node --test \
  tests/file-dispatcher.test.js \
  tests/batch-context-service.test.js \
  tests/source-role-classifier.test.js \
  tests/production-docx-source-port.test.js \
  tests/production-import-bridge.test.js \
  tests/formal-admission-policy.test.js \
  tests/production-review-validator.test.js
```

Result:

- tests: `65`
- passed: `65`
- failed: `0`
- cancelled: `0`
- skipped: `0`
- todo: `0`
- timeout: `0`

This matrix verifies extension-based DOCX identity, immutable batch context,
role-only source classification, deterministic DOCX port ownership, Bridge
DOCX route selection, missing-provenance fail-closed behavior, and the allowed
admission modes.

## Gates not run

No narrow correction was implemented. The following post-correction gates were
not run after the explicit instruction to block immediately when the C-case
schema cannot express the real route:

- true-browser DOCX deterministic equivalence
- DOCX stable full suite
- `verify:safe`
- architecture owner/runtime full matrix
- `verify:no-real-ai`
- 11 mandatory gates
- PDF known-bad
- Route B hold
- browser preflight and dry-run

No acceptance is inferred from the 65/65 fact-audit matrix.

## Safety

- production code modified: no
- production owner switched: no
- legacy path deleted: no
- C2-11 entered: no
- validator/comparator weakened: no
- provenance fabricated: no
- frozen high-risk PDF files modified: no
- real AI/API called: false
- `real-run` called: no
- AI proxy called: no
- formal writes from shadow: `0`
- wrong attachment introduced: `0`
- raw JSON/placeholder leakage introduced: `0`

## Git

- start production commit:
  `82f44d5bfc12983e1467151ec600d95b2b7c61fb`
- end production commit:
  `82f44d5bfc12983e1467151ec600d95b2b7c61fb`
- permanent changes: architecture audit, release report, state update only
- target working tree after documentation seal: clean
- target local/tracking/live remote after push: equal

## Remaining limitations

- The active normal-UI DOCX vision route has no legal canonical admission mode.
- Neither active DOCX producer owns complete canonical per-field provenance.
- Phase 5 remains blocked.
- C2-11 and Phases 6–8 remain prohibited.

## Decision

`DOCX_ROUTE_IDENTITY_CORRECTION_BLOCKED`

Exact blocker:

`DOCX_VISION_ROUTE_HAS_NO_LEGAL_SOURCE_MODE_OR_PRODUCER_TIME_CONTROLLED_PROVENANCE`

This work package stops here. A separately authorized schema-and-provenance
design package is required before this correction or full Phase 5 can resume.
