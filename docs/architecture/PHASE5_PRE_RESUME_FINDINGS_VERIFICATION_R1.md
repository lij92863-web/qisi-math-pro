# Phase 5 Pre-Resume Findings Verification R1

## Baseline and method

- Repository: `C:\Users\Administrator\Desktop\题库系统`
- Branch: `stage/app-shell-slimming-r3`
- Verified HEAD: `4cb3fd724e2d7d5a5bed5267e5eb32d9c34761a6`
- Working tree at verification start: clean
- Reviewed baseline report:
  `docs/release/PDF_PROJECTION_OWNER_CORRECTION_R3.md`
- Production owner: `qisi-pdf-candidate-projection.js`
- Verification method: static production call-graph reading plus inspection of
  existing production-linked tests. No production algorithm was copied into a
  test, no real API was called, and no code was changed before this document.

Current call graph:

```text
normal UI
  processDraftImportBatch
    -> existing parser / aligner / controlled-write
    -> PdfCandidateProjection.projectPdfCandidates

PDF-only V2 / Bridge shadow
  ProductionPdfSourcesPort
    -> QisiBatchEngineV2 with legacy attachment deferred
    -> PdfCandidateProjection.createPdfEngineProjectionContext
  ProductionImportBridge
    -> injected PdfCandidateProjection.projectPdfCandidates
```

The Bridge remains a scaffold overall. Only its projection port is
production-wired. The normal UI entry remains the legacy path.

## Finding A — raw JSON rejected provenance contradiction

- Relevant production file: `qisi-pdf-candidate-projection.js`
- Exact functions: `provenanceEntry`, `projectPdfCandidate`
- Exact verified ranges: lines 228-253 and 375-559 at the baseline commit;
  especially the raw JSON branch at 422-432.
- Current input: a `rawJsonCandidate=true` parsed question whose PDF-AI strict
  engine and/or support controlled-write decisions have already produced
  `controlled-write` provenance entries.
- Current output: the branch clears field values and mutates `kind`, `status`,
  `reason`, and `reasonCode` to rejected, but it does not delete the
  `controlledWriteAccepted:true` property created by `provenanceEntry`.
- Production path: both `projectPdfCandidate` direct input and
  `projectPdfCandidates` batch input reach the same branch; the Bridge invokes
  the batch form through its required projection port.
- Really reachable: yes. Existing tests already construct
  `rawJsonCandidate=true`, but only assert rejected support and absence of raw
  text; they do not assert the provenance boolean invariant.
- Existing test coverage: partial in
  `tests/pdf-candidate-projection-known-bad.test.js`; no contradiction assertion.
- Type-field note: `type` is not in the production `FIELDS` controlled-write
  provenance list and therefore cannot carry this boolean contradiction in the
  current owner. Its raw JSON value is already cleared by the returned
  `type: rawJsonCandidate ? '' : ...` expression. The regression must still
  assert that `type` is empty and absent from accepted fields; it must not invent
  type provenance.
- Conclusion: **CONFIRMED** for every provenance-bearing controlled-write field;
  the raw `type` value is **ALREADY_PROTECTED**.

## Finding B — canonical comparator provenance blind spot

- Relevant production file: `qisi-pdf-candidate-projection.js`
- Exact functions: `stableCodes`, `stableEvidenceIdentities`,
  `compareCanonicalPdfCandidates`
- Exact verified range: lines 938-1063; provenance checks at 974-982.
- Current input: two canonical candidates with equal field values, equal
  provenance kinds, and equal aggregate raw evidence identities but different
  per-field source/page/block/decision/reason attribution.
- Current output: no difference, because only
  `fieldProvenance.<field>.kind` is compared. Aggregate raw evidence comparison
  cannot detect answer/solution evidence swaps when the global set is unchanged.
- Production path: the true-browser and Node shadow tests call the production
  comparator after legacy and Bridge projection.
- Really reachable: yes. Both outputs carry per-field provenance, but the
  comparator discards all stable coordinates except kind.
- Existing test coverage: current comparator tests cover kind, accepted/rejected
  fields, validation, warning codes, and aggregate evidence identity only. They
  do not cover swapped field evidence, source id, reason code, or accepted flag.
- Conclusion: **CONFIRMED**.

## Finding C — multiple support PDF source ambiguity

- Relevant production file: `qisi-pdf-candidate-projection.js`
- Exact functions: `createPdfEngineProjectionContext`, `sourceRoles`
- Exact verified ranges: lines 636-734 and 737-744; ambiguous selection at
  lines 659-686.
- Current input: more than one PDF source with `answer`, `solution`, or `full`
  role plus evidence rows from those sources.
- Current output: all support evidence pages are merged into one `rawTextPages`
  list, while parser ownership metadata uses `supportSources[0]` as the file.
- Production path: `ProductionPdfSourcesPort` calls the context builder from the
  PDF-only V2 route, and `ProductionImportBridge` later consumes that context.
- Really reachable: yes. Source-role classification permits multiple records;
  the context builder has no cardinality guard.
- Existing test coverage: only one combined answer+solution support PDF is
  covered. No ambiguity regression exists.
- Contract verification: repository fixtures, local test-material docs, and
  production-linked tests consistently use one question PDF plus one combined
  answer+solution PDF. No product definition, grouping key, ownership proof, or
  production test establishes a legal multi-support-source contract. Separate
  answer and solution files therefore cannot be merged safely in this task.
- Conclusion: **CONFIRMED**. Adding the required cardinality fail-closed guard
  does not conflict with a verified existing multi-source product contract.

## Finding D — duplicate accepted controlled-write conflict

- Relevant production file: `qisi-pdf-candidate-projection.js`
- Exact function: `mergeControlledWriteDecisions`
- Exact verified range: lines 564-634; decision selection at 569-581 and
  effective item selection at 584-600.
- Current input: multiple real controlled-write result objects containing the
  same `questionNumber + field`, with more than one accepted decision/effective
  item.
- Current output: `fieldDecisionMap` keeps the first accepted decision, and
  `itemMap.has(questionNumber)` keeps the first effective item. A later accepted
  value or evidence conflict is silently discarded.
- Production path: the legacy batch path accumulates real per-file controlled-
  write results and calls `projectPdfCandidates`; the batch adapter always calls
  this merge function before projecting candidates.
- Really reachable: yes whenever more than one decision result is supplied;
  no stable-payload equality/conflict check exists.
- Existing test coverage: identical answer-only and solution-only results are
  merged, but duplicate accepted decisions for the same field are not tested.
- Projection-layer feasibility: the merge layer has the real decision and its
  same-result effective item, including canonical value and available source,
  page, block, and evidence identity. It can reject conflicts without changing
  the frozen controlled-write algorithm.
- Conclusion: **CONFIRMED**.

## Required failure-first tests

The confirmed findings require production-linked tests that import the shared
owner and initially fail for the exact baseline reasons:

1. raw JSON rebuilds rejected provenance and leaves no accepted fields;
2. comparator detects swapped per-field evidence, source-id mismatch,
   reason-code mismatch, and accepted-flag contradiction;
3. multiple support sources throw `pdf-support-source-ambiguous` before parser,
   controlled-write, persistence, or Formal Admission;
4. identical duplicate accepted decisions deduplicate, while value/evidence
   conflicts throw `controlled-write-conflict`; accepted plus rejected preserves
   the existing accepted policy and two rejected decisions never upgrade.

## Frozen boundaries

No finding requires changing the six frozen high-risk files. No validator
relaxation, provenance fabrication, Route B restoration, UI switch, real-run,
real API call, or C2-11 work is authorized.
