# App Shell Migration Protocol R3

## Mandatory ordered gate

Every Program C implementation wave executes the following sequence without
compression. A later row cannot compensate for a missing earlier row.

1. **characterization test** — capture current production inputs, outputs,
   ordering, error codes, mutations, progress, cancellation, and behavior hash.
2. **extraction candidate** — define one domain, public API, injected dependencies,
   allowed side effects, exact source range, and rollback point.
3. **legacy/new shadow compare** — run both owners on immutable cloned inputs;
   neither shadow result may write, update UI, or call an external service twice.
4. **deterministic equivalence** — compare canonical outputs, warnings, provenance,
   error mapping, state transitions, mutations, and behavior hash. Any shadow
   mismatch blocks the switch.
5. **production switch** — change one explicit controller/app callsite only after
   equivalence; record loaded, integration-tested, and production-wired separately.
6. **old owner removal** — remove only the proven migrated range and its unreachable
   private helpers after the production callsite is verified.
7. **no duplicate** — automated ownership/call-graph guards prove one production
   owner and no hidden legacy fallback.
8. **targeted tests** — run owner, caller, failure, cancellation, retry, privacy,
   and Program A/B invariant tests.
9. **true E2E** — use production UI/controller wiring for deterministic DOCX and
   PDF safe-partial behavior; seeded or mock-only flow is labelled honestly.
10. **full gates** — run the complete 11-command mandatory matrix plus all newly
    affected state-machine/module/performance/attack gates.
11. **commit** — update state/evidence, verify exact paths and cached diff, create
    one atomic commit, push the work branch, and recheck the remote ref.

## Evidence packet per wave

Each wave starts failure-first and records:

- baseline commit, branch, exact source/caller ranges, behavior hash, and test IDs;
- immutable shadow inputs and separately named legacy/new outputs;
- explicit mismatch fields rather than an averaged success score;
- production switch callsite and proof that the new module is production-wired;
- old-owner deletion diff, duplicate-owner scan, and no hidden legacy fallback;
- rollback point and the exact reverse switch/removal command scope;
- targeted/true E2E/full-gate commands, counts, skipped tests, and zero real calls;
- state update, `QISI_ALLOWED_DIFF`, `verify:diff-scope`, staged exact paths,
  cached diff check, commit, push, and local/remote work-branch equality.

Before the final seal, fetch and compare local main, `origin/main`, and live remote
main. A changed remote main is a global stop, never an invitation to pull or merge.

## Stop and repair policy

A failed characterization, shadow mismatch, unsafe output, duplicate owner,
regression, hidden timeout, unexpected skip, real API call, or dirty out-of-scope
diff stops the current package before commit. At most three bounded repairs may
address the demonstrated cause. A repair cannot broaden the domain. Persistent
failure blocks the Program and is never reported as accepted.

## Prohibited shortcuts

- **copy then retain**: a copied implementation cannot coexist indefinitely with
  the legacy owner.
- Moving **multiple domains** in one work package is forbidden.
- A **mock replacing production behavior** is not equivalence or production proof.
- Moving **reactive state** into a domain service merely to reduce app.js lines is
  forbidden; UI state remains in the UI/controller layer.
- No semantic guessing, ownership expansion, rejected-field washing, direct formal
  write, OCR policy rewrite, controlled-write bypass, or Route B activation.
- No `reset --hard`, force push, broad add, pull, rebase, or unapproved merge.
- No PDF `real-run`, real OCR/API benchmark, or model download without its separate
  explicit authority flag.

## Wave registry

| Wave | Single domain | Required switch/removal evidence |
| --- | --- | --- |
| C2-1 | Import State Machine | transition-table characterization; initially no production switch |
| C2-2 | Batch Context | legacy context snapshot equivalence; old context builder removed |
| C2-3 | Source Role Classifier | deterministic role-plan equality; semantic fallback absent |
| C2-4 | DOCX Coordinator | true DOCX E2E equality; app orchestration range removed |
| C2-5 | PDF Coordinator | safe-partial/known-bad equality; parser/aligner/controlled-write owners retained |
| C2-6 | Candidate Normalizer | canonical candidate equality; repair owners delegated, not copied |
| C2-7 | Import Validation | decision/provenance equality; validators composed, not reimplemented |
| C2-8 | Review Draft Builder | warnings/missing/rejected/manual flags equal; no formal write |
| C2-9 | Draft Persistence | transaction/idempotency/reload/delete equality; no formal question write |
| C2-10 | Import Diagnostics | allowlisted metadata equality; private content absent |
| C2-11 | Legacy Owner Retirement | every prerequisite production-wired; wrapper at most 200 lines; no duplicate |
| C2-12 | UI Shell Closure | UI/controller-only responsibility and zero forbidden direct owners |
| C2-13 | Dead/Duplicate Removal | call graph, runtime manifest, coverage, browser trace; at most five related blocks |
| C2-14 | Performance | same-condition baseline/final; measured benefit or revert |

## Rollback verification

Rollback must remain possible at each commit: switch the single callsite back to
the preceding production owner, restore only that wave's removed bounded range,
and rerun targeted plus full gates. No rollback may weaken current schemas,
FormalAdmission, Repository transactions, controlled-write, OCR policy, or data
already committed under those owners.
