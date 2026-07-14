# Program C Corrective RC3 Report

Date: 2026-07-14
Branch: `stage/program-c-corrective-r1`
Fixed base: `79fea1e1cad0c682c42539dd575370f3919f1d05`
Seal resolver: `v1.2.0-rc3-program-c-corrective^{}`

## Decision

`PROGRAM_C_CORRECTIVE_RC3_ACCEPTED`

The fixed RC2 tree was independently audited and blocked. This corrective RC3
closes both recorded blockers without rewriting the audited RC2 tag, modifying
the frozen PDF owners, calling a real AI/OCR endpoint, or merging `main`.

## Historical disposition and fixes

```text
RC2 independent audit:
blocked

RC3 fixes:
B-01 fixed
B-02 fixed

production fixture route:
0

true producer-chain browser:
passed

app B/C/D:
0 / 0 / 0

old RC2 tag:
unchanged
```

### B-01 — production fixture route and false browser proof

The production controller and Bridge no longer accept a fixture producer,
caller-selected producer route, final-candidate transport, or test registry.
The former candidate fixture files were deleted. Isolation tests prove that
production source cannot import or dynamically resolve test harness code.

The replacement normal-UI browser matrix uses actual DOCX/PDF files. It starts
with the visible UI, enters `AppProxy.runBatchRecognition`, and allows injection
only at the outer recognition-engine boundary. Production source roles,
producers, parser, PDF projection, controlled-write, validation, ReviewDraft
construction, atomic persistence, verified readback, edit, and formal admission
remain live code.

The matrix passed 17/17 scenarios:

1. DOCX+DOCX deterministic stable;
2. DOCX vision;
3. PDF full question producer;
4. PDF safe-partial;
5. PDF known-bad ownership;
6. PDF support conflict;
7. PDF support ambiguity;
8. raw JSON rejection;
9. formula fallback;
10. cancellation;
11. duplicate click;
12. persistence failure;
13. reload/readback;
14. manual field edit;
15. formal confirmation;
16. parser-failure counterfactual;
17. controlled-write-missing PDF counterfactual.

### B-02 — app B/C/D ownership

The app shell now owns only bounded UI commands and view mapping for Program C.
Production route policy is uniquely owned by
`qisi-production-import-route-policy.js`. Duplicate/answer-conflict decisions
are uniquely owned by `qisi-question-duplicate-policy.js` and are applied using
fresh rows inside the formal repository transaction. Review confirmation and
batch submit are owned by `qisi-review-workflow-service.js`; review statistics,
dedupe, cleanup, and deletion are owned by
`qisi-draft-maintenance-service.js`.

The machine-readable responsibility matrix and AST gate independently enforce:

```text
app route selection = 0
app duplicate policy = 0
app persistence lifecycle = 0
Program C shell wrappers = 9
AST closure errors = 0
```

## Formal and persistence boundaries

- Bridge stops after atomic ReviewDraft persistence and verified readback;
  `Bridge formal writes=0`.
- Formal writes require the Review workflow, Batch Formal Submit, Formal
  Admission, and repository transaction in that order.
- The repository rechecks duplicate, similarity, answer-conflict, draft
  version, request ID, and idempotency binding using fresh transactional rows.
- Concurrent equal drafts produce one formal commit and one stable rejection.
- One request ID cannot confirm two different drafts.
- Per-draft batch submission is idempotent and partial failures are resumable.
- Cancellation and write failure cannot leave a partial ReviewDraft or formal
  transaction.

## Verification

| Gate | Result |
| --- | --- |
| internal CTO | `PROGRAM_C_CORRECTIVE_INTERNAL_CTO_ACCEPTED` |
| `verify:personal-stable` | 16/16 suites; 1,848/1,848 tests |
| true producer-chain browser | 17/17 scenarios |
| `verify:safe` | 1,692/1,692 plus batch smoke 20/20; exit 0 |
| `verify:batch-safety` | DOCX 20/20; PDF 65/65; smoke and no-real-ai passed |
| base migration execution | 15/15 |
| corrective counterfactual | 80/80 |
| corrective benchmark | 11 scenarios, 20 samples/profile; 0 failures/timeouts |
| app-shell architecture | accepted; 9 wrappers; 0 errors |

All reported failed, cancelled, skipped, todo, and timeout counters are zero.
The safety result is:

```text
wrong attachment = 0
raw JSON leakage = 0
placeholder leakage = 0
controlled-write bypass = 0
Formal Admission bypass = 0
Bridge formal writes = 0
legacy fallback = 0
fixture production reachability = 0
realApiCalled = false
frozen PDF files modified = none
```

## Release boundary

This RC3 is an implementation candidate, not personal stable. It requires a
fresh-session independent audit using the fixed commit, annotated RC3 tag,
independent-audit specification, and RC3 evidence index. This implementation
session does not perform that audit and does not promote or merge `main`.

`PROGRAM_C_CORRECTIVE_RC3_ACCEPTED`
