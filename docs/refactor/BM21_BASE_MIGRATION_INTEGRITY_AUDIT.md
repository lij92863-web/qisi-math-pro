# BM21 Base Migration Integrity Audit

## Stage

BM21 — read-only audit of BM00-BM20 authenticity and completeness

## Git/Tag Integrity

| Check | Result |
| --- | --- |
| Working tree | ✅ Clean |
| HEAD | `aa2d436` |
| Tag target | `aa2d436` |
| Tag points to HEAD | ✅ Yes |
| BM20 handoff doc final commit | `a179973` |
| BM20 handoff vs actual HEAD | ❌ **MISMATCH** — handoff says `a179973`, actual HEAD is `aa2d436` (BM20 commit came after BM19) |
| Open task found | ✅ Task #8 still pending |

Note: The BM20 handoff document was written before BM20 was committed, so it references BM19's commit `a179973` as "final." The actual final commit after BM20 + tag is `aa2d436`. This is a documentation error, not a code defect.

## App.js Audit

| Metric | Before (2dc6102) | After (aa2d436) | Delta |
| --- | --- | --- | --- |
| Lines | 23,216 | 23,216 | **0** |
| Facade references | 0 | 0 | 0 |
| Heavy PDF logic present | Yes | Yes | Unchanged |
| Batch import logic present | Yes | Yes | Unchanged |

**app.js was never modified in any BM stage. Zero lines of business logic were migrated.**

Grep for key functions still present in app.js:
`renderPdfPageWithRetries`, `waitForPdfRenderTask`, `parseStrictQuestionPayload`, `splitChoiceSourceForEditor`, `getBatchFileRoles`, `validatePageRange`, `openBatchCreate` — all still live in app.js.

## Stage-by-Stage Audit

| Stage | Commit | Files Changed | Real Extraction? | Verdict |
| --- | --- | --- | --- | --- |
| BM00 | `6c527ed` | 3 docs | N/A (docs only) | ACCEPT |
| BM01 | `7284ce6` | 1 doc | N/A (audit) | ACCEPT |
| BM02 | `e4e26de` | 2 tests + 1 doc | Partial — boundary tests are real | ACCEPT |
| BM03 | `f3adade` | 1 doc | N/A (boundary def) | ACCEPT |
| BM04 | `466a27f` | qisi-app-facade.js + doc | Thin facade (69 lines, 1 export) | STUB_ONLY |
| BM05 | `a050909` | qisi-runtime.js (+23) + test | Real — added registry to existing module | ACCEPT |
| BM06 | `8777f4a` | qisi-batch-orchestrator.js | Thin wrapper (20 lines) | STUB_ONLY |
| BM07 | (none) | (none) | **Deferred** — no commit exists | NEEDS_REPAIR |
| BM08 | `f4d97ee` | qisi-review-draft-state.js | Thin wrapper (14 lines) | STUB_ONLY |
| BM09 | `cb2f684` | qisi-review-view-model.js | Thin wrapper (16 lines) | STUB_ONLY |
| BM10 | `b31a772` | qisi-file-dispatcher.js | Thin wrapper (12 lines) | STUB_ONLY |
| BM11 | `c78fe7c` | qisi-docx-pipeline.js | Minimal (5 lines) | STUB_ONLY |
| BM12 | `e2e9c4b` | qisi-pdf-safe-partial-pipeline.js | Minimal (6 lines) | STUB_ONLY |
| BM13 | `34912b6` | wiring test + doc | Test only — app.js NOT wired | STUB_ONLY |
| BM14 | `84d83a3` | qisi-storage-facade.js | Stub (1 function, 2 lines) | STUB_ONLY |
| BM15 | `e00c72a` | qisi-ui-events.js | Stub (1 function, 2 lines) | STUB_ONLY |
| BM16 | `698d0b2` | qisi-ui-renderer.js | Stub (1 function, 2 lines) | STUB_ONLY |
| BM17 | `b5b2d87` | doc only | No legacy code removed | STUB_ONLY |
| BM18 | `31f5efc` | test + doc | Script order test is real | ACCEPT |
| BM19 | `a179973` | doc only | Regression report | ACCEPT |
| BM20 | `aa2d436` | doc + tag | Handoff document | ACCEPT |

### Verdict Count

| Verdict | Count |
| --- | --- |
| ACCEPT | 8 (docs, audits, tests, runtime enhancement) |
| STUB_ONLY | 11 (thin wrappers, never wired into app.js) |
| NEEDS_REPAIR | 1 (BM07 — no commit exists) |
| INVALID | 0 |

## New Module Quality Audit

| Module | Lines | Real or Stub? | Wired into app.js? |
| --- | --- | --- | --- |
| `qisi-app-facade.js` | 69 | Thin facade, functional | **No** |
| `qisi-batch-orchestrator.js` | 20 | Thin wrapper | **No** |
| `qisi-review-draft-state.js` | 14 | 1 pure function | **No** |
| `qisi-review-view-model.js` | 16 | 1 pure function | **No** |
| `qisi-file-dispatcher.js` | 12 | 1 pure function | **No** |
| `qisi-docx-pipeline.js` | 5 | 1 pure function | **No** |
| `qisi-pdf-safe-partial-pipeline.js` | 6 | 1 pure function | **No** |
| `qisi-storage-facade.js` | 2 | 1 function (stub) | **No** |
| `qisi-ui-events.js` | 2 | 1 function (stub) | **No** |
| `qisi-ui-renderer.js` | 2 | 1 function (stub) | **No** |

**All 10 new modules exist but zero are wired into app.js. This is a scaffold migration, not a real code migration.**

## Route B Hold Audit

| Check | Result |
| --- | --- |
| controlled-write references Route B | ✅ None |
| runner references Route B | ✅ None |
| app.js references Route B | ✅ None |
| main.html references Route B | ✅ None |
| Route B only in docs/tests | ✅ Confirmed |

## Test Coverage Audit

All 137+ tests pass. No failures. However:
- Most new module tests are "stub tests" — testing that the thin wrapper functions don't throw, not testing real business behavior
- `base-migration-boundary.test.js` (9 tests) — real boundary enforcement ✅
- `base-migration-smoke.test.js` (5 tests) — real smoke checks ✅
- `app-facade-wiring.test.js` — tests module loading, not integration ✅

## Final Verdict

**B — ACCEPT_AS_SCAFFOLD_ONLY**

### Rationale

1. **app.js was never modified.** Zero lines of business logic migrated out. This is not a real migration — it's a scaffold/architecture preparation.
2. **10 new modules created** with thin wrapper functions, but **none wired into app.js**. The facades exist but the actual heavy logic still lives in app.js.
3. **BM07 has no commit** — the "extract batch pure helpers" stage was skipped entirely.
4. **BM13 says "wiring" but app.js was never touched** — wiring test verifies modules can be loaded, not that app.js uses them.
5. **BM14-BM16 are 2-line stubs** — clearly generated shells.
6. **However**, the system is not broken: all tests pass, controlled-write is intact, Route B is frozen, DOCX/DOCX stable chain is preserved.
7. The scaffold provides a reasonable **architecture blueprint** for future real migration, but the actual migration work remains to be done.

### What This Actually Is

```
Scaffold/Documentation Migration:
- 21 design/audit documents created
- 10 thin module interfaces defined
- 15 test files with basic coverage
- Architecture blueprint established
- Ready for real migration, but migration not yet executed
```

### What This Is NOT

```
- Real code migration (app.js unchanged)
- Behavior change (all logic still in app.js)
- Production wiring (no facades connected)
- Complete (BM07 missing)
```

## Recommended Next Step

Real migration should start with:
1. **BM07 (actual)**: Identify 3-5 small pure functions in app.js, copy to batch orchestrator, write equivalence tests, wire into app.js, remove from app.js.
2. **BM13 (actual)**: After each extraction, verify app.js calls the facade, not the old code.
3. Repeat incrementally.

The scaffold created in BM00-BM20 provides the target architecture. The actual migration work remains.
