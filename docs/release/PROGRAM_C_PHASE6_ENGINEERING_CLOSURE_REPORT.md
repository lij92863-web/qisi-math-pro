# Program C Phase 6 Engineering Closure Report

## Decision

`PROGRAM_C_PHASE6_ENGINEERING_CLOSURE_ACCEPTED`

Phase 6 completed the counterfactual attack matrix, code-quality audit,
architecture consistency review, reproducible benchmark, full browser suite,
and prescribed gates without real AI/OCR calls or production data.

## Phase 6A - counterfactual attacks

The machine-readable attack record is
`docs/testing/PROGRAM_C_PHASE6_COUNTERFACTUAL_ATTACK_MATRIX_R3.json`.
It records 43/43 attacks with the required route, expected/actual behavior,
diagnostic, draft/formal writes, fallback, wrong-attachment, leakage, final UI
state, and pass/fail fields.

Coverage includes:

- 12 missing/throwing dependency attacks;
- 15 source, provenance, controlled-write, sequence, ownership, raw-data,
  placeholder, formula, and malformed-engine attacks;
- 16 transaction, idempotency, cancellation, stale context, refresh/two-tab,
  response-loss, progress, mode, shadow-write, and fallback/reachability
  attacks.

Results:

```text
attacks = 43/43 passed
fallback calls = 0
wrong attachment = 0
raw/placeholder leakage = 0
unexpected formal writes = 0
realApiCalled = false
```

The formula-fallback scenario deliberately creates one review draft with
mandatory review; duplicate/idempotent and concurrency scenarios deliberately
retain one committed draft/formal row. Those expected atomic writes are not
reported as bypasses.

## Phase 6B - code quality

`docs/architecture/PROGRAM_C_CODE_QUALITY_AUDIT_R3.md` reviews all required
owners and architecture gates.

Key results:

- `app.js`: 5,247 inventory lines, 172 detected functions;
- largest shell function: 164 lines, unrelated exam drag UI;
- largest Program C UI function: 116 lines, manual crop command;
- import orchestration/validation/persistence/formal algorithms in shell: 0;
- implicit globals: 0;
- missing-dependency permissive defaults: 0;
- catch-to-success fallback: 0;
- duplicate production owner: 0;
- new 1,000+ line mixed owner: 0.

The existing 2,046-line batch engine and 1,330-line frozen PDF projection are
explicit single-domain maintainability hotspots. They were not mechanically
split during closure because ownership is unique and behavior risk is high.

## Phase 6C - architecture consistency

The following evidence agrees:

- detailed `docs/architecture/owners.json` and `layers.json`;
- compatibility `architecture/owners.json` and `layers.json`;
- actual `main.html` load order and runtime namespaces;
- normal UI call graph;
- all 17 browser E2E cases, including the 15-scenario normal UI canary.

Hard results:

```text
UI -> formal DB bypass = 0
UI -> OCR adapter execution = 0
UI -> PDF parser/aligner/controlled-write = 0
Bridge -> formal DB = 0
deprecated production owner = 0
Route B production reachability = 0
test-only production adapter = 0
missing-dependency fallback = 0
duplicate owner = 0
```

The formal path remains:

```text
teacher confirmation
  -> BatchFormalSubmit
  -> FormalAdmissionPolicy
  -> StorageRepository.confirmDraftToQuestion
```

The normal import Bridge stops at verified ReviewDraft persistence.

## Phase 6D - benchmark

`docs/benchmark/PROGRAM_C_APP_SHELL_BENCHMARK_R3.md` records 10 measured runs
per scenario after warmup, p50/p95, timeout/failure counts, machine/Node/browser
identity, and comparison to the committed Phase 0 baseline.

Highlights:

- cold-start p50: 4,077.191 ms, 18.2% faster than baseline median;
- first ReviewDraft render: p50 18.842 ms, p95 30.695 ms;
- 300 ReviewDraft immutable build: p50 1.333 ms, p95 1.672 ms;
- persistence commit/readback: p50 0.123 ms, p95 0.227 ms in the
  deterministic repository harness;
- startup/owner-chain/browser failure and timeout: 0;
- `realApiCalled = false`.

The 100-draft validation p50 is disclosed at +14.0% versus the historical
median, above the suggested 10% target but below the 25% default blocker and
only 2.274 ms absolute. No safety check was weakened for performance.

## Phase 6E - verification

Final staged-content verification:

- Phase 5 and comparator/equivalence gates: passed;
- C2-11 production owner/browser state-machine gates: passed;
- C2-12 shell/owner convergence gates: passed;
- C2-13 owner/runtime/dependency gates: passed;
- Phase 6 counterfactual/benchmark/report gate: passed;
- full root Node suite: 1,614/1,614 across 54 suites;
- normal UI and true browser E2E: 17/17;
- combined Node and browser total: 1,631/1,631;
- full safe suite: passed with failed/skipped/todo/cancelled = 0;
- mandatory gates: 11/11 in prescribed order;
- DOCX stable, PDF known-bad, Route B, persistence, formal isolation,
  architecture, runtime dependency, and single-owner gates: passed;
- benchmark smoke: passed;
- `realApiCalled = false`.

All six frozen PDF files remain unchanged. No `real-run`, real endpoint,
production-data mutation, force, reset, pull, or rebase operation was used.

## Remaining risks

- batch engine, PDF projection, and Bridge command-table size remain future
  maintainability concerns, protected by single-owner and behavior gates;
- the historical benchmark lacked p95 and first-render data, so current p95 and
  first-render measurements become the reproducible future baseline;
- the 100-draft validation microbenchmark regression is disclosed above and is
  not a safety or user-visible latency blocker.

None is a missing Program C production boundary or an acceptance-with-
limitations substitute. The engineering closure requirements are complete.
