# Program C Phase 5 Pre-Resume Safety Patch R1

Stage:
PROGRAM C PHASE 5 PRE-RESUME SAFETY PATCH

## Baseline

- start commit: `4cb3fd724e2d7d5a5bed5267e5eb32d9c34761a6`
- branch: `stage/app-shell-slimming-r3`
- working tree at start: clean
- correction report reviewed:
  `docs/release/PDF_PROJECTION_OWNER_CORRECTION_R3.md`, completely, before
  changing production code

## Findings verification

- raw JSON provenance contradiction: confirmed for all six projection fields.
  The old rejection branch changed `kind/status` in place and could retain
  `controlledWriteAccepted:true`. The raw `type` value was already cleared and
  has no field-provenance entry, so no type provenance was invented.
- comparator provenance blind spot: confirmed. It compared only per-field
  `kind`, so equal values plus a swapped or otherwise mis-owned evidence set
  could compare equal.
- multiple support source ambiguity: confirmed. The context builder merged all
  support evidence but selected `supportSources[0]` as the ownership file. No
  verified product contract or grouping key authorizes multi-support merging;
  the production contract remains one question PDF plus one combined
  answer-and-solution support PDF.
- duplicate accepted conflict: confirmed. The merge layer selected the first
  accepted decision/item without checking stable value and evidence identity.
- evidence / line ranges: the pre-change evidence, reachability, call graph,
  tests, and baseline ranges are recorded in
  `docs/architecture/PHASE5_PRE_RESUME_FINDINGS_VERIFICATION_R1.md`. The final
  owner has raw rejection at lines 422-440, controlled-write merge/conflict at
  570-651, the support-source cardinality guard at 703-709, and canonical
  provenance/comparator logic at 1009-1131.

All four findings were documented and committed before production changes.

## Implementation

- changed production files: `qisi-pdf-candidate-projection.js` only
- changed test files:
  `tests/pdf-candidate-projection-invariants.test.js`,
  `tests/pdf-canonical-comparator-provenance.test.js`,
  `tests/pdf-support-source-ambiguity.test.js`,
  `tests/pdf-controlled-write-conflict.test.js`,
  `tests/pdf-projection-single-owner.test.js`, and
  `tests/e2e/pdf-projection-browser-shadow.test.js`
- high-risk files changed: none of the six frozen files
- duplicate production owner introduced: no; the architecture guard checks the
  owner symbol/call graph plus provenance, support-level, manual-review,
  duplicate-accepted merge, raw-rejection, and Bridge-fallback signatures

The normal UI still uses `processDraftImportBatch`. The overall
`ProductionImportBridge` remains a layer-3 scaffold and shadow participant; this
patch does not describe it as the production UI workflow.

## Raw JSON invariant

- acceptedFields: empty for a raw JSON candidate
- rejected provenance state: every projection field is rebuilt as a fresh
  `rejected` provenance entry while real diagnostic source/page/block/engine and
  decision identity are retained
- controlledWriteAccepted contradictions: zero; a non-controlled-write entry
  cannot retain `controlledWriteAccepted:true`

## Comparator

- compared provenance fields: for each of `questionNumber`, `stem`, `options`,
  `answer`, `solution`, and `images`, the comparator checks `kind`, `sourceId`,
  `page`, stable-sorted `blockIds`, `controlledWriteDecisionId`,
  `controlledWriteAccepted`, `manuallyEdited`, and `reasonCode`
- ignored volatile fields: only the established volatile diagnostics:
  `requestId`, timestamps, `createdAt`, `updatedAt`, `durationMs`, and temporary
  file paths; no provenance/ownership/support decision is ignored
- answer/solution swapped evidence test: passed; it reports error-level
  `pdf-canonical-provenance-mismatch` differences for both fields
- sourceId mismatch test: passed with an error-level structured difference
- reasonCode mismatch test: passed with an error-level structured difference

Every comparator difference now has `path`, legacy/Bridge values, `severity`,
and a stable `code`. Comparison is property-scoped, not a whole-candidate
stringification.

## Support source policy

- single support behavior: unchanged; one combined answer-and-solution PDF uses
  the existing parser, aligner, and controlled-write path
- multiple support behavior: more than one support source fails before parser,
  controlled-write, review persistence, or Formal Admission
- error code: `pdf-support-source-ambiguous`

## Controlled-write conflict policy

- identical duplicate: stable-identical accepted value/source/page/block/
  evidence/rule payloads deduplicate idempotently
- conflicting duplicate: a difference in stable value or evidence ownership
  fails closed; there is no first-wins or last-wins selection. One rejected plus
  one accepted preserves the existing explicit accepted policy; two rejected
  decisions remain rejected and never upgrade.
- error code: `controlled-write-conflict`

## Browser shadow equivalence

- cases: DOCX deterministic; PDF full; PDF prefix/safe-partial; PDF missing
  answer; PDF known-bad ownership; raw JSON; multiple support-source ambiguity;
  duplicate accepted controlled-write conflict
- canonical differences: `0` across accepted legacy/Bridge comparisons
- wrong attachments: `0`
- raw JSON leakage: `0`
- placeholders: `0`
- controlled-write bypass: `0`
- formal admission writes: `0`
- real API called: `false`; deterministic/mock engine data only and forbidden
  browser requests `0`

The normal UI remains legacy-visible. Bridge output is shadow-only and uses
in-memory review persistence in the browser harness; negative cases persist
zero review drafts and no case writes a formal question.

## Gates

- targeted tests: A target `27/27`, B target `20/20`, C/D plus architecture
  target `29/29`, and final new/runtime/architecture/browser composite `38/38`
- Phase 4 suite: the original `1387/1387` Phase-4 baseline remains contained in
  the current full suite; the final full suite passed `1434/1434`
- verify:safe: passed syntax checks, `1434/1434` tests across 54 suites,
  batch mock `20/20`, and no-real-AI verification
- mandatory gates: all 11 passed with exit code zero
- DOCX stable: passed `20/20`
- PDF known-bad: passed `65/65`; wrong attachment remained zero
- Route B: hold gate passed `6/6`; Route B remains frozen/research-only
- runtime dependency: runtime/manifest/architecture composite passed; browser
  startup retained the production dependency order
- architecture owner: PDF projection single-owner gate passed `3/3`
- skipped/timeouts: `0/0`; full suite also had zero failures, cancellations,
  and todos

Base Migration passed `15/15`, controlled-write answer ownership passed
`21/21`, and browser master `preflight` plus `dry-run` both returned `ok=true`,
`realApiCalled=false`, and `underlyingApiCallCount=0`. No `real-run`, AI proxy,
or AI vision proxy command was run.

## Git

- start commit: `4cb3fd724e2d7d5a5bed5267e5eb32d9c34761a6`
- findings commit: `126cf83d191019a661ffb83c3aca49062c4d62fc`
- raw invariant commit: `99ebbf7`
- comparator commit: `1744dd2`
- ambiguity/conflict commit: `654456c`
- end implementation commit: `584ddbc57ead2ebdc6074497737fd50d1ec3d9df`
- pushed: yes after every independent work package; this report/state seal is
  pushed separately after creation
- local/origin/live remote: verified equal after the implementation push and
  re-verified after the report seal
- working tree: clean after the final report seal

## Decision

`PHASE5_PRE_RESUME_SAFETY_PATCH_ACCEPTED`

## Phase status

- `PHASE_5_RESUME_ALLOWED`
- `PHASE_5_NOT_YET_ACCEPTED`
- `C2_11_PROHIBITED`

This bounded patch only removes the four verified blockers to resuming Phase 5.
It does not accept Phase 5, switch the normal UI to the Bridge, or enter C2-11.

## Next exact action

Resume the original Phase 5 full browser equivalence and independent CTO
acceptance. Do not begin C2-11 unless Phase 5 is later accepted by that separate
workflow.
