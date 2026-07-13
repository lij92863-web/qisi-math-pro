# Import Shadow Equivalence R3 — Phase 5 Blocker Evidence

## Scope

This is the failure-first evidence for Program C Phase 5 Real Browser Shadow
Equivalence. It is not an equivalence acceptance report.

- baseline commit: `d7f0f8b5d2daaca94ca3d164cf730fbe7fdae1ab`
- branch: `stage/app-shell-slimming-r3`
- case: `docx-deterministic-complete`
- fixture SHA-256:
  `BC689D1CD4175CA19601FAC3FD39AE7A2989FD1FAD41555D24C26AC98C5A59F4`
- real AI/API calls: `0`
- review drafts seeded by the test: `0`
- normal UI entry used: yes

## Browser observation

The browser used the ordinary batch-import UI to upload the real DOCX fixture
and create the batch. No `InjectedImportTransport` was registered. A temporary
raw recognition-engine adapter supplied deterministic recognition output only;
it was forbidden from supplying canonical provenance, controlled-write,
support-level, validation, or review-draft output. The adapter and all trial
production changes were removed after the blocker was proven.

The first failure-first run supplied one raw question and was rejected by the
real legacy DOCX question-number contract because the authoritative DOCX
skeleton contained questions 1 through 12. This proved that the test was
executing the production legacy DOCX reconciliation gate.

The second run supplied all 12 raw questions. It reached `status=review` and
persisted all 12 legacy review drafts. The first persisted draft had the exact
raw stem, answer, and solution supplied at the recognition boundary, but:

- `source.mode` was absent;
- `fieldProvenance` was absent;
- `sourceTrace.source` was
  `docx-local-convert-pdf-strict-vision`;
- the draft contained visual page evidence and the converted PDF filename.

The decisive assertion was therefore:

```text
actual source.mode: undefined
required source.mode: docx-deterministic
```

## Proven production call graphs

Legacy normal UI:

```text
normal batch-import UI
→ runBatchRecognition
→ LegacyBatchRunCoordinator
→ processDraftImportBatch
→ processDocxByLocalConvertAndStrictVision
→ processStrictVisualQuestionFile
→ legacy merge / review-draft persistence
```

Bridge DOCX route:

```text
ProductionImportBridge
→ deterministic-source-loaded
→ runDocxImport
→ ProductionDocxSourcePort.parseDocxSource
→ deterministic DOCX importer
→ shared validation / review-draft persistence
```

## Canonical comparison decision

No canonical comparison was recorded as `EXACT` or `SAFE_REFINEMENT` for this
case. The required comparator must compare `source.mode` and complete stable
field provenance. Ignoring either difference is explicitly forbidden.

Marking the visual legacy output as `docx-deterministic` would fabricate source
mode and field provenance. Making the two paths genuinely identical instead
requires changing the normal UI production route to the deterministic owner,
which is the C2-11 migration and is prohibited until Phase 5 is accepted.

## Counters

| Counter | Result |
| --- | ---: |
| Browser scenarios completed | 1 failure-first scenario |
| Canonical accepted cases | 0 |
| Canonical differences | not suppressible; required provenance absent |
| Wrong attachments | 0 observed |
| Raw JSON leakage | 0 observed |
| Placeholder leakage | 0 observed |
| Controlled-write bypass | 0 observed |
| Formal Admission bypass | 0 observed |
| Bridge formal writes | 0 |
| Real API calls | 0 |

## Decision

`NOT_EQUIVALENT`

Global stop condition:

`normal UI cannot generate a credible legacy snapshot canonically equivalent to
the deterministic Bridge snapshot without fabricated provenance or an early
production-owner migration`.
