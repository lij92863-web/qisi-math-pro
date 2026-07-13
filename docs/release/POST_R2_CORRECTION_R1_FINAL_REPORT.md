# Post-R2 Correction R1 Final Report

Decision: POST_R2_CORRECTION_ACCEPTED_WITH_LIMITATIONS

## Git scope before final report

- Verified baseline/main: `6ab88d0551be5af24d134f17906ba0c42631b2ea`
- Work branch: `stage/post-r2-correction-r1`
- Pre-report accepted head: `acd2d6731fef08b1df0c22128a3f8c34b61ee3a5`
- Program A history before this report: 37 commits, 80 changed paths,
  6,113 insertions, and 198 deletions.
- Live `origin/main` was fetched immediately before sealing and remained exactly
  at the verified baseline. The work tree was clean and the proposed release
  tag did not exist.

## Correction delivered

- Formal Admission is the source-aware unified batch formal-entry policy.
- Question schema v2 and immutable per-field provenance are validated by the
  canonical contracts owner.
- Repository transaction owns atomic question/image/draft/batch writes with
  optimistic versioning, idempotency, rollback, and stable error codes.
- Batch formal submit and the production review validator are wired through the
  policy/repository chain; app batch submit has zero direct formal DB writes.
- Missing, throwing, malformed, and invalid validators fail closed.
- True deterministic E2E enters through UI and marked recognition candidate
  transport, persists review drafts, applies admission/rejection, reloads, and
  exports. Seeded lifecycle tests remain explicitly named seeded.
- Archive limits, traversal/nested archive checks, temporary job cleanup, and
  private-safe logging close the Program A operational security scope.

## Attack, audit, and benchmark evidence

- Phase 3 sealed all 18 counterfactual attack classes independently, each with
  targeted tests, the complete mandatory matrix, an atomic commit, and push.
- Phase 4 code-quality audit: PASS, with one empty catch repaired and residual
  app-shell debt explicitly recorded.
- Phase 5 architecture audit: PASS for controlled-write, Formal Admission,
  repository ownership, fail-closed controllers, true E2E, manifest coverage,
  Route B, DOCX stable, and PDF safe-partial invariants.
- Phase 6 Benchmark audit: PASS. Production review 10/50/100 medians were
  0.247/1.349/1.982 ms. Metadata aggregation initially failed the 10% gate at
  +11.84%, then passed after a semantics-preserving hot-path correction with
  three isolated run changes of +3.42%, +6.06%, and -1.24% versus R2 final.
- Acceptance counters: wrong attachment = 0, formal submit bypass = 0,
  duplicate submit = 0, partial transaction = 0.

## Final validation

Final mandatory gates: PASS

- Base migration execution gate: PASS
- Route B hold gate: PASS; Route B remains research-only and unloaded.
- Batch mock smoke: PASS (20/20)
- `verify:safe`: PASS with zero skipped tests
- Batch safety and PDF known-bad gates: PASS
- Controlled-write answer ownership gate: PASS
- Browser preflight and dry-run: PASS, browser chain healthy,
  `realApiCalled=false`, `underlyingApiCallCount=0`
- DOCX stable and no-real-AI gates: PASS

## Limitations and next programs

- Real OCR: not measured or authorized in Program A. No engine accuracy,
  formula fidelity, correction-cost, or production-promotion claim is made.
- OCR adapters, registry, shadow mode, performance monitor, and aspirational
  ImportOrchestrator remain scaffold unless Program B promotes them with real
  corpus evidence.
- `app.js` remains 21,777 lines; the legacy batch function, six non-batch direct
  question-write sites, broad fallbacks, and diagnostic globals remain explicit
  Program C debt.

## Program B

Measure approved real OCR corpora, compare engines and teacher correction cost,
and promote only an engine that satisfies ownership, accuracy, latency, cost,
and deployment gates.

## Program C

Slim the app shell with bounded characterization/shadow packages, preserve one
owner per responsibility, eliminate remaining high-risk call sites, and rerun
architecture and performance audits.

## Git seal plan

1. Commit and push this final report on the work branch.
2. Reconfirm clean work tree and unchanged live `origin/main`.
3. `git switch main`.
4. `git merge --ff-only stage/post-r2-correction-r1`.
5. Create annotated tag `v1.1.0-rc2-post-r2-correction`.
6. Push main and the tag without force.
7. Verify local main, `origin/main`, and the tag all resolve to the sealed
   report commit.
