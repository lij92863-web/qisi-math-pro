# Program C Phase 7 Internal CTO Review

## Decision

`PROGRAM_C_PHASE7_CTO_ACCEPTED`

The Phase 6 decision was accepted before this review began. This review then
started again from the production entry and independently reran the required
gates. It does not accept a production claim merely because it appears in a
development report.

The implementer and the internal reviewer may be operating in the same
execution environment. This is therefore an internal acceptance review. It
does not replace the fresh-session independent audit required after Program C
is sealed.

## Reviewed identity

```text
Program start commit: b15e6fbe24c525c95a573b51a0c7ab68e77f4790
Lost-session recovered branch head: 7a4b945a3c0c50c33166c5c63689b7fca4e0c797
Recovery checkpoint commit: 2ebe00b390caae556fdb8ed0e03087ad0965cb24
Phase 7 reviewed endpoint: e6c14c54e3c12b9e3c705589823eb1b44ffcacf9
Branch: stage/app-shell-slimming-r3
```

At Phase 7 entry, local HEAD, the tracking ref, and the live GitHub branch were
all `e6c14c54e3c12b9e3c705589823eb1b44ffcacf9`; the tree, index, and untracked
release evidence were clean.

## Required questions

### Production

1. **Who owns normal UI import?** `NormalUiImportController` is the thin UI
   command owner and every visible import action delegates to
   `ProductionImportBridge`, the production workflow owner.
2. **Is the Bridge in production mode?** Yes. The normal UI trace records
   `bridgeMode=production` in every import scenario.
3. **Does every reachable route enter the Bridge?** Yes. Create, retry, rerun,
   and error-recovery entry points converge on the controller and Bridge. The
   independent 15-scenario browser run observed no alternate import owner.
4. **Can Bridge failure fall back to legacy?** No. Failure is sanitized and
   terminates in the explicit failed state. `legacyFallbackCalls=0`.
5. **Is there a dynamic legacy caller?** No. Runtime load/order analysis,
   namespace ownership, proxy exports, and browser traces found none.
6. **Who uniquely owns ReviewDraft persistence?**
   `DraftPersistenceService` owns commands and verified readback;
   `StorageRepository` uniquely owns the atomic database transaction.
7. **Can the Bridge formally write a question?** No. It stops after verified
   ReviewDraft persistence and has no Formal Admission or formal repository
   authority. `Bridge formal writes=0`.
8. **Is Formal Admission the unique admission path?** Yes. Teacher confirmation
   calls `BatchFormalSubmit`, then `FormalAdmissionPolicy`, then
   `StorageRepository.confirmDraftToQuestion`.
9. **Does app.js write the formal database directly?** No. The independent
   storage/formal boundary tests found zero formal mutation or transaction
   ownership in the shell.

### Retirement

10. **Has processDraftImportBatch disappeared?** Yes, from production source,
    shell exports, runtime namespaces, and normal UI reachability.
11. **Has V2 disappeared?** The retired `processDraftImportBatchV2` owner is
    absent from production. Supported Question V2 schema/engine names remain
    because they are live contracts, not a legacy batch owner.
12. **Were old domain implementations deleted?** Yes. C2-11 removed the giant
    owner and C2-12/C2-13 removed the reachable or proven-dead converter,
    reconciler, OCR, persistence, formal repository, merge, and fallback
    implementations from the shell.
13. **Was the implementation merely moved into a new giant file?** No. New
    owners are bounded by one responsibility and explicit ports. The existing
    2,046-line batch engine and 1,330-line frozen PDF projection are disclosed
    pre-existing single-domain hotspots, not copied shell implementations.
14. **How many duplicate production owners remain?** Zero. The detailed owner
    manifest, responsibility uniqueness gate, symbol scan, and runtime graph
    agree.
15. **Is a deprecated owner reachable?** No. Deprecated/test-only coordinators
    and Route B are absent from `main.html` production reachability.

### Safety

16. **Is DOCX stable?** Yes. `verify:docx-stable` independently passed 20/20.
17. **Does PDF remain fail-closed safe-partial?** Yes. PDF known-bad passed
    65/65 and unsafe ownership remained rejected rather than guessed.
18. **Wrong attachment count?** Zero across the normal UI evidence.
19. **Raw JSON or placeholder leakage?** Zero.
20. **Controlled-write bypass count?** Zero. Controlled-write ownership passed
    21/21 and the production boundary test found no bypass edge.
21. **Formal Admission bypass count?** Zero. Bridge/formal isolation and the
    real AppProxy formal transaction tests passed.
22. **Is Route B frozen?** Yes. The hold gate passed 6/6, with no production
    import or call edge.
23. **Can cancellation cause a partial write?** No. Pre-transaction cancellation
    writes nothing; cancellation/abort during a transaction rolls back; an
    already active atomic commit completes before cancellation is reported.
24. **Can duplicate action create duplicate drafts?** No. Concurrent clicks
    share one Bridge execution and idempotency/version checks preserve one
    committed draft or return a conflict.

### Test authenticity

25. **Does the production E2E begin at normal UI import?** Yes. It invokes
    `AppProxy.runBatchRecognition`, observes controller/Bridge production mode,
    and checks UI state plus persisted ReviewDraft results.
26. **Does it seed ReviewDraft to bypass import?** No. The 15-scenario production
    import canary creates results through normal UI import. Separate seeded UI
    lifecycle tests are supplemental persistence/formal tests only.
27. **Does it import production modules?** Yes. The browser loads the real
    `main.html` production script graph. Only the external transport is injected
    through the explicit fixture registry, and real endpoints are blocked.
28. **Is the test validator stricter than production?** No. Browser and Node
    flows call the production validators and policies. Missing/throwing
    validator attacks confirm production itself fails closed.
29. **Are failures, timeout, skipped, or todo hidden?** No. The independent full
    safe run reported 1,631/1,631, 54 suites, with failed, cancelled, skipped,
    and todo all zero. Browser and benchmark timeout/failure counts were zero.
30. **Is the benchmark reproducible?** Yes. Committed scripts define machine,
    Node/browser identity, warmup, sample count, p50/p95, failure, timeout, and
    real-API fields. Phase 7 executed all four smoke modes. The one-run smoke is
    executability evidence only; Phase 6 retains the selected 10-run baseline.

### Architecture

31. **Do owners/layers agree with runtime?** Yes. Detailed and compatibility
    manifests agree with actual `main.html` ordering, namespaces, factories,
    dependencies, and browser startup.
32. **How many UI-to-formal-DB edges exist?** Zero.
33. **Do missing dependencies fail closed?** Yes. C2-13 execution attacks cover
    the state machine, classifier, source ports, projection, validators,
    controlled-write, persistence/repository, and Formal Admission factories.
34. **Has app.js exited domain responsibility?** Yes for Program C import,
    validation, OCR, persistence, formal admission, and repository algorithms.
    It retains UI composition, presentation state, and command adaptation.
35. **Is the largest remaining domain function reasonable?** Yes. The inventory
    reports 5,247 shell lines and 172 functions; the largest shell function is
    a 164-line unrelated exam drag handler, while the largest Program C UI
    function is the bounded 116-line manual-crop command.
36. **Did a new giant owner appear?** No. File size hotspots are disclosed and
    single-domain; the unique-owner and cross-layer gates reject a replacement
    monolith or copied implementation.
37. **Do remaining limitations block the core objective?** No. The disclosed
    module-size maintenance hotspots, missing historical p95/first-render data,
    and +14.0% 100-draft microbenchmark result do not restore a legacy owner,
    weaken safety, or add a user-visible blocking latency.

### Git

38. **What are the start/end commits?** Program start is
    `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`; the independently reviewed
    Phase 6 endpoint is `e6c14c54e3c12b9e3c705589823eb1b44ffcacf9`.
39. **Did local/tracking/live remote agree?** Yes, all three were `e6c14c5...`
    at Phase 7 entry. The Phase 7 report commit is pushed and rechecked as a
    separate sealing prerequisite.
40. **Was the tree clean?** Yes at review entry. This report is the sole Phase 7
    deliverable and is checked as the only delta before commit.
41. **Were frozen files preserved?** Yes. All six frozen PDF files have zero
    diff from the reviewed endpoint.
42. **Were prohibited commands or real APIs used?** No. No `real-run`, AI proxy
    test, model operation, force, amend, pull, rebase, reset, or broad-add command
    was used. Preflight/dry-run and all browser evidence record
    `realApiCalled=false` and zero underlying calls.

## Independent CTO rerun

The following results were produced after the Phase 6 commit, not copied from
the Phase 6 run:

| Review gate | Independent result |
| --- | --- |
| `npm.cmd run verify:safe` | 1,631/1,631, 54 suites; failed/cancelled/skipped/todo 0 |
| mandatory gates | 11/11 in prescribed order |
| normal-UI browser | 15/15 scenarios through production Bridge |
| DOCX stable | 20/20 |
| PDF known-bad | 65/65 |
| Route B hold | 6/6 |
| controlled-write answer ownership | 21/21 |
| single-owner/runtime/architecture/formal/persistence focus | 63/63 |
| benchmark smoke | 4/4 executable modes |
| browser/benchmark failures and timeouts | 0 |
| wrong attachment/raw JSON/placeholder/controlled-write bypass/Formal bypass | 0/0/0/0/0 |
| legacy fallback/Bridge formal writes | 0/0 |
| real API calls | 0 |

Phase 7 finds no core objective missing and no safety, architecture, test
authenticity, Git, or frozen-owner blocker. The only permitted decision is
therefore:

`PROGRAM_C_PHASE7_CTO_ACCEPTED`
