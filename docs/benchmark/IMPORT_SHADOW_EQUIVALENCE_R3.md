# Import Shadow Equivalence R3 — Phase 5 Accepted Evidence

## Measurement scope

- baseline: `84e1b8a70f8a927345b8b3f55189585ec61d37ec`
- production/test result:
  `bba2fc48840fb8d11968b5fa86a820f51a6464f4`
- browser: Playwright Chromium against the real local application
- network: deterministic mock fixtures only
- real AI/API calls: `0`
- final drafts seeded by tests: `0`

The historical DOCX blocker was resolved by the accepted producer-identity
contract package. This measurement keeps source format, producer identity and
route identity separate; it does not relabel DOCX vision as deterministic.

## Canonical results

| Producer scenario | Accepted comparisons | Canonical differences | Classification |
| --- | ---: | ---: | --- |
| DOCX vision normal UI vs Bridge vision shadow | 1 | 0 | exact |
| DOCX deterministic normal UI vs Bridge | 0 | n/a | non-applicable: no normal-UI deterministic route |
| PDF normal UI full vs Bridge shadow | 1 | 0 | exact |
| PDF module full/safe-partial/missing/formula | 4 | 0 | exact |
| PDF ownership/raw/ambiguity/conflict/cancel | 5 | n/a | both paths or Bridge fail closed as required |

The DOCX vision-versus-deterministic counterfactual produces a stable
`producer.mode` difference. The PDF vision-versus-deterministic counterfactual
produces both `producer.mode` and per-field producer-provenance differences.

## Browser evidence

Normal UI evidence is not a seeded final draft:

```text
real DOCX or PDF source record
  -> AppProxy.runBatchRecognition
  -> LegacyBatchRunCoordinator
  -> processDraftImportBatch
  -> real legacy producer and shared production projection
  -> user-visible legacy review draft
```

The Bridge consumes the same producer contract/projection context, writes only
to an isolated test-local shadow sink, and is compared by the production
canonical comparator. It does not write production review drafts or questions.

## Safety totals

| Counter | Result |
| --- | ---: |
| Same-producer canonical differences | 0 |
| Different-producer false equivalence | 0 |
| Wrong attachments | 0 |
| Raw JSON leakage | 0 |
| Placeholder leakage | 0 |
| Controlled-write bypass | 0 |
| Formal Admission bypass | 0 |
| Bridge production review writes | 0 |
| Bridge formal writes | 0 |
| Real API calls | 0 |
| Failed / timeout / skipped / todo | 0 / 0 / 0 / 0 |

## Decision

`EXACT_FOR_SAME_PRODUCER_AND_FAIL_CLOSED_FOR_KNOWN_BAD`

Phase 5 acceptance is recorded in
`docs/release/PROGRAM_C_PHASE5_REAL_BROWSER_SHADOW_EQUIVALENCE_R3.md`.
