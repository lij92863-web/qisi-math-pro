# BM22 Migration Status Reset

## BM21 Final Verdict

**B — ACCEPT_AS_SCAFFOLD_ONLY.** BM00-BM20 created architecture blueprints, thin module interfaces, and test harnesses, but migrated zero lines of business logic out of app.js.

## Why BM00-BM20 Is Scaffold-Only

1. `app.js`: 23,216 lines → 23,216 lines (delta: 0)
2. Facade references in app.js: 0
3. 10 new qisi-*.js modules created, none wired into app.js
4. BM07 (batch helper extraction) has no commit
5. BM13 (facade wiring) was test-only, app.js untouched
6. BM14-BM16 are 2-line stubs

## Current Safety State

| Check | Status |
| --- | --- |
| controlled-write truth gate | Intact |
| Route B research-only | Enforced by hold tests |
| DOCX+DOCX stable | All tests pass |
| PDF safe partial | All tests pass |
| known-bad | Blocked |
| All safety tests | 137+ passing |

## Abandoned Open Task

Task #8 "Complete BM06 through BM12" is **abandoned**. BM06-BM12 produced scaffold modules but did not complete actual business logic migration. The open task is superseded by BM21 audit findings.

## Real Migration Definition

A stage qualifies as "real migration" only if ALL of:
1. app.js lines decrease OR app.js calls new module instead of old logic
2. Migrated logic comes from existing app.js, not written fresh
3. New module has equivalence tests
4. Original behavior unchanged
5. DOCX+DOCX passed, PDF safe partial passed
6. Route B hold tests passed
7. Diff is auditable

Otherwise: scaffold, documentation, test harness, or audit.

## BM23 Entry Conditions

- BM22 committed and pushed
- Working tree clean
- Identify one small, pure app.js helper group for extraction
- Target: 3-5 small pure functions from app.js
- Destination: an existing scaffold module (e.g., qisi-batch-orchestrator.js)

## BM23 Prohibited

- Extracting PDF rendering logic
- Extracting AI/OCR logic
- Extracting controlled-write
- Extracting database writes
- Extracting DOM rendering
- Extracting event bindings
- Creating new empty modules
