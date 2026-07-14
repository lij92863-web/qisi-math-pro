# Program C Corrective Internal CTO R1

Date: 2026-07-14
Branch: `stage/program-c-corrective-r1`
Fixed base: `79fea1e1cad0c682c42539dd575370f3919f1d05`
Reviewed implementation endpoint: `ee305e469e0dd44565eb6741cc8aff1575778516`

## Decision

`PROGRAM_C_CORRECTIVE_INTERNAL_CTO_ACCEPTED`

This is the implementation session's internal acceptance. It begins at the
normal-UI production entry and does not replace the required fresh-session
independent RC3 audit.

## Required answers from the normal UI entry

1. **Is the production fixture route zero?** Yes. Production Bridge exports no
   fixture runner, production modules cannot resolve a test harness, and every
   former fixture selector or final-candidate transport fails closed.
   `fixtureProductionReachability=0`.
2. **Does the browser use real files?** Yes. The browser matrix creates real
   DOCX and PDF `File` objects, imports them with the visible normal-UI controls,
   and observes persisted database readback after `AppProxy.runBatchRecognition`.
3. **Is the mock boundary only the outer engine?** Yes. The harness injects
   only the outer recognition engine response. It cannot inject candidates,
   routes, parser output, projection output, controlled-write decisions, or
   persistence results.
4. **Does the parser execute?** Yes. Successful DOCX and PDF traces contain
   `parser-entered`. A normal-UI parser-failure counterfactual terminates the
   import without a ReviewDraft write.
5. **Does PDF projection execute?** Yes. Successful PDF traces contain
   `pdf-projection-entered`, and the persisted safe-partial fields are derived
   from production projection rather than test candidates.
6. **Does controlled-write execute?** Yes. Successful PDF traces contain
   `controlled-write-evaluated`. Removing its result in the normal-UI
   counterfactual makes the import fail closed and persist no draft.
7. **Is the route-policy owner unique?** Yes.
   `qisi-production-import-route-policy.js` is the sole production decision
   owner; the controller, Bridge, source ports, and shell only consume its
   immutable decision.
8. **Is app route selection zero?** Yes. The corrective AST gate reports no
   route-selection policy in `app.js`; the shell only assembles and delegates.
9. **Is app duplicate policy zero?** Yes. `app.js` contains no fingerprint,
   similarity, answer-conflict, or duplicate-admission decision.
10. **Is duplicate status rechecked in the formal transaction?** Yes.
    `StorageRepository.confirmDraftToQuestion` reads current rows inside the
    atomic transaction and applies `qisi-question-duplicate-policy.js` before
    any formal commit. Concurrent equal drafts yield one winner and one stable
    rejection; a stale pre-commit view cannot bypass the fresh-row check.
11. **Is app persistence lifecycle zero?** Yes. Batch statistics, dedupe,
    cleanup, reload/readback, delete, and reviewed-batch submission lifecycles
    are absent from the shell and delegated to bounded owners.
12. **Is the Review workflow owner unique?** Yes.
    `qisi-review-workflow-service.js` uniquely owns confirm and batch-submit
    orchestration; `qisi-draft-maintenance-service.js` owns maintenance, and
    repository modules retain transaction authority.
13. **Is batch submit idempotent and resumable?** Yes. Per-draft stable request
    IDs make a committed retry idempotent, while partial failure leaves failed
    items retryable without resubmitting successful items.
14. **Are Bridge formal writes zero?** Yes. Bridge authority ends after atomic
    ReviewDraft persistence and verified readback. `bridgeFormalWrites=0`.
15. **Is Formal Admission the unique admission boundary?** Yes. Every formal
    insert is Review workflow to Batch Formal Submit to Formal Admission to the
    formal repository transaction. Direct shell, Bridge, and persistence-owner
    bypass counts are zero.
16. **Are the frozen files unchanged?** Yes. `git diff --name-only` from the
    fixed base is empty for all six frozen files, and every SHA-256 equals the
    corrective baseline record.
17. **Is `realApiCalled` false?** Yes. Browser networking blocks any unmocked
    model request, no real-run/proxy gate was invoked, and
    `verify:no-real-ai` passed. `realApiCalled=false`.
18. **Is the stable runner fully green?** Yes.
    `verify:personal-stable` accepted all 16 ordered suites and all 1,848 tests,
    with failed, cancelled, skipped, todo, timeout, and safety counters zero.
19. **Can the true browser fail when parser/projection safety is broken?** Yes.
    The normal-UI parser-failure case fails before ReviewDraft persistence.
    The PDF projection path records projection entry, and its controlled-write
    output is mandatory: the controlled-write-missing counterfactual fails
    closed with no persisted draft. Thus success cannot be produced by a
    prebuilt candidate that bypasses parser or PDF projection safety.
20. **Is the RC2 tag unchanged?** Yes. Local and live remote tag object remain
    `91c757c0c2d5d77d990e34de5f4bc93840363f58`; both peel to the fixed commit
    `79fea1e1cad0c682c42539dd575370f3919f1d05`.

## Executed acceptance evidence

| Gate | Internal result |
| --- | --- |
| `npm run verify:personal-stable` | 16/16 suites; 1,848/1,848 tests |
| true normal-UI producer matrix | 17/17 scenarios |
| `npm run verify:safe` | 1,692/1,692 plus batch smoke 20/20; exit 0 |
| `npm run verify:batch-safety` | DOCX 20/20; PDF 65/65; no-real-ai and smoke passed |
| base migration execution gate | 15/15 |
| corrective counterfactual matrix | 80/80 |
| app-shell AST closure | accepted; 9 wrappers; 0 errors |
| benchmark | 11 scenarios, 20 samples/profile; failures/timeouts 0 |

## Safety counters

```text
production fixture route = 0
app route selection = 0
app duplicate policy = 0
app persistence lifecycle = 0
wrong attachment = 0
raw JSON leakage = 0
placeholder leakage = 0
controlled-write bypass = 0
Formal Admission bypass = 0
Bridge formal writes = 0
legacy fallback = 0
realApiCalled = false
frozen files modified = none
```

No core limitation is being accepted conditionally. The implementation is
eligible for a documentation-only RC3 seal and then a fresh-session independent
audit.

`PROGRAM_C_CORRECTIVE_INTERNAL_CTO_ACCEPTED`
