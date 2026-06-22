# BM-AUTO Call Graph Migration Control System

## Purpose

This document defines the automatic migration control system (BM-AUTO) that governs all future real migrations from `app.js`. Its role is to **prevent scaffold-only changes from being misclassified as real migrations**, and to ensure every migration step produces measurable, verifiable progress toward app.js responsibility contraction.

---

## 1. Classification Taxonomy

Every migration is classified into exactly one of four categories:

### REAL_MIGRATION
The migration **physically moved** business logic out of app.js.

**Hard criteria (ALL must be true):**
- `app.js` net line reduction >= 10 lines (delta <= -10)
- Old function definitions **no longer present** in app.js
- app.js **calls the new module** (via `window.Qisi.*` or equivalent reference)
- The target module **exports the moved functions** with identical or equivalent behavior
- All safety tests pass
- Route B untouched
- controlled-write untouched

### PARTIAL_MIGRATION
The migration changed the call path but did not achieve meaningful app.js contraction.

**Triggers (ANY):**
- app.js calls the new module BUT delta > -10 (negligible line reduction)
- app.js calls the new module BUT old definitions still present (duplicate code)
- Call path restructured without removing app.js responsibility

### SCAFFOLD_ONLY
The migration added infrastructure without moving any business logic out of app.js.

**Triggers (ANY):**
- app.js unchanged (delta = 0)
- New module created but **not called** by app.js
- New module created but only contains empty shells or re-exports
- Facade/module added without any app.js responsibility transfer

### INVALID
The migration is rejected outright. Must stop immediately.

**Triggers (ANY):**
- Route B integrated into production path
- controlled-write modified
- Any banned file modified (app.js core logic, qisi modules outside allowlist)
- Any safety test fails
- Requires new dependencies
- Requires AI/OCR calls
- real-run was executed without authorization

---

## 2. Why BM00-BM20 Are Scaffold Only

BM00 through BM20 established the **infrastructure scaffolding** for the migration system:

| Stage | What was built | Why scaffold |
|-------|---------------|-------------|
| BM01-BM03 | Architecture audit, safety harness, app shell boundary | Analysis only, no code moved |
| BM04 | App facade | New module, app.js not reduced |
| BM05 | Runtime registry | Infrastructure, no business logic moved |
| BM06 | Batch orchestrator interface | Interface definition, no migration |
| BM08-BM09 | Review draft state, view model | New modules, app.js still owns all logic |
| BM10 | File dispatcher | New empty module shell |
| BM11 | DOCX pipeline facade | Facade wrapping existing code |
| BM12 | PDF safe partial pipeline | Facade, no app.js reduction |
| BM13 | App facade wiring | Wiring, no migration |
| BM14 | Storage facade | Facade, no app.js reduction |
| BM15-BM16 | UI events, renderer | New modules, app.js unchanged |
| BM17 | Legacy cleanup | Cleanup only |
| BM18 | Script order audit | Audit only |
| BM19 | Full regression report | Report only |
| BM20 | Base migration handoff | Handoff document |

**Common pattern:** BM00-BM20 created new modules and facades, but never removed function definitions from app.js. The modules existed alongside app.js code — app.js retained full responsibility. This is necessary infrastructure work, but it is NOT real migration.

---

## 3. Why BM23 Is Partial Migration

BM23 moved 4 functions (`fileTypeText`, `getFileType`, `formatFileSize`, `makeBatchId`) from app.js to `qisi-file-dispatcher.js`, replacing them with `window.Qisi.FileDispatcher.*` references.

**Why partial:**
- The functions were moved successfully
- app.js calls the module
- BUT: the net line delta was approximately +1 (new module references added but the old definitions were small — 4 one-liners)
- The app.js contraction was negligible

BM23 proved the **mechanism** works (definitions can be moved, references can replace them), but did not achieve meaningful contraction. It is a valid **partial** migration — a stepping stone, not an endpoint.

---

## 4. Why BM24 Is Real Migration

BM24 moved 7 batch role functions from app.js to `qisi-file-dispatcher.js`:

- `getBatchFileRoles`, `batchHasRole`, `batchHasQuestionRole`, `batchHasAnswerRole`, `batchHasSolutionRole`, `batchIsFullRole`, `batchIsSupplementalImage`

**Why real:**
- app.js net reduction: **-19 lines**
- All 7 old function definitions **removed** from app.js
- 7 new `window.Qisi.FileDispatcher.*` references added to app.js
- All 7 functions exported by `qisi-file-dispatcher.js` with identical logic
- 5 behavioral tests added, all passing
- Route B untouched, controlled-write untouched
- All safety gates pass

BM24 is the **canonical positive sample** — it demonstrates the complete real migration pattern end-to-end.

---

## 5. Hard Standards for Real Migration

A migration is **real** if and only if:

1. **Call graph impact is measurable**: app.js loses >= 10 lines of function definitions
2. **Old code is deleted, not duplicated**: function definitions are removed from app.js, not wrapped
3. **New module is the single source of truth**: app.js calls the module; the module exports the functions
4. **Behavior is preserved**: tests for the moved functions pass identically
5. **Safety invariants hold**: controlled-write untouched, Route B isolated, all gate tests pass

---

## 6. Fake Migration Detection

A migration is **fake** (SCAFFOLD_ONLY or INVALID) if it exhibits any of:

- **Empty facade pattern**: new module created, app.js unchanged
- **Wrapper-not-move pattern**: old function wraps new module call but definition stays
- **Duplicate pattern**: function exists in both app.js and module
- **Dead code pattern**: module created but never called by app.js
- **Side-effect pattern**: migration changes controlled-write, Route B, or banned files
- **AI/OCR creep**: migration introduces AI or OCR dependencies

**The system must reject fake migrations before they reach commit.**

---

## 7. Automatic Migration Loop

The BM-AUTO loop operates as follows:

```
1. INVENTORY → scan app.js for eligible candidate functions
2. SCORE     → rank candidates by impact, filter by hard gates
3. SELECT    → pick the highest-scoring eligible group
4. MIGRATE   → move functions to target module, update app.js references
5. VERIFY    → classify the result (REAL / PARTIAL / SCAFFOLD / INVALID)
6. GATE      → if REAL + all tests pass → continue to next round
               else → STOP
```

Each iteration must produce a classification before the next round can begin.

---

## 8. Automatic Continue Conditions

The loop **continues** to the next round ONLY if ALL of:

- `classification === REAL_MIGRATION`
- `app.js delta <= -10`
- All safety tests pass (verify:safe, verify:batch-safety, verify:diff-scope, etc.)
- Route B untouched (verified by route-b-hold tests)
- controlled-write untouched (verified by controlled-write ownership tests)
- diff scope passed (QISI_ALLOWED_DIFF configured)
- At least one eligible candidate remains in inventory

---

## 9. Automatic Stop Conditions

The loop **stops immediately** if ANY of:

- `classification !== REAL_MIGRATION` (got PARTIAL, SCAFFOLD, or INVALID)
- No eligible candidates remain in inventory
- `app.js delta > -10` (negligible or no contraction)
- Any banned file needs modification
- New dependencies required
- controlled-write would be modified
- Route B would be integrated
- real-run would be required
- AI/OCR would be required
- Any test fails

---

## 10. Prohibition on Empty Facades

**No more empty facade modules shall be created.** The BM00-BM20 phase is complete. All future module creation must:

- Be driven by an eligible inventory candidate
- Serve as the target of a real function migration
- Contain business logic moved from app.js on the same commit
- Never be an empty shell created "for future use"

The era of scaffolding is over. The era of contraction has begun.
