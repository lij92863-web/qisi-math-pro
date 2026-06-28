# BM-AUTO Migration Protocol

Stage: Historical BM-AUTO documentation
Historical-Status: retained for audit trail

## Purpose

This document defines the operational protocol for BM-AUTO — the concrete steps, commands, and acceptance criteria for each automatic migration round.

---

## 1. Protocol Overview

BM-AUTO enforces a **strict gate-before-migration** protocol. Every migration round must pass through three phases:

```
Phase 1: INVENTORY + SCORE  →  Identify what can be moved
Phase 2: MIGRATE + VERIFY   →  Move it and classify the result
Phase 3: GATE + DECIDE       →  Pass all gates or stop
```

No phase may be skipped. No migration may proceed without passing all gates from the previous round.

---

## 2. Phase 1: Inventory + Score

### Inventory
```bash
node scripts/base-migration-inventory.js
```

Produces a JSON catalog of all `const name = (...) => { }` function definitions in app.js, annotated with:
- Line range and count
- Risk markers (DOM, DB, AI/OCR, controlled-write, async)
- Eligibility flag
- Suggested target module

### Score
```bash
node scripts/base-migration-score.js
```

Ranks eligible candidates by:
- Estimated lines removed from app.js
- Call graph impact (utility vs. single-use)
- Risk level
- Module match quality

Produces scored groups sorted by impact.

### Hard Gates (applied during scoring)
A candidate is **ineligible** if ANY of:
1. Has DOM access (`document.`, `window.`, `localStorage`, `addEventListener`, `innerHTML`, `querySelector`, `render`)
2. Has DB access (`indexedDB`, `QisiDb`)
3. Has AI/OCR access (`OCR`, `AI`, `fetch`)
4. Has controlled-write access (`controlledWrite`, `buildPdfSupport`, `parsePdf`)
5. Is async (`async`, `await`)
6. Fewer than 10 lines
7. Target module does not exist

---

## 3. Phase 2: Migrate + Verify

### Migration
The migration itself is executed by a human or agent following the BM24 pattern:

1. Copy function definitions from app.js to target module
2. Add exports to module's return statement
3. Replace app.js definitions with `window.Qisi.ModuleName.functionName` references
4. Add behavioral tests covering the moved functions
5. Update tests to require from the module instead of relying on app.js internals

### Verify
```bash
node scripts/base-migration-verify-execution.js \
  --before <snapshot-before.js> \
  --after app.js \
  --module <target-module.js> \
  --old-names <comma-separated-function-names>
```

The verifier MUST return `REAL_MIGRATION` for the round to continue.

---

## 4. Phase 3: Gate + Decide

### Required Gates (ALL must pass)

| Gate | Command | What it verifies |
|------|---------|-----------------|
| execution-gate | `node --test tests/base-migration-execution-gate.test.js` | Classification rules hold |
| route-b-hold | `node --test tests/pdf-route-b-hold.test.js` | Route B still isolated |
| verify:safe | `npm run verify:safe` | Full test suite + no-real-ai |
| verify:batch-safety | `npm run verify:batch-safety` | DOCX stable + PDF known-bad |
| verify:diff-scope | `npm run verify:diff-scope` | Only allowed files changed |
| preflight | `node scripts/pdf-master-browser-runner.js preflight` | Environment ready |
| dry-run | `node scripts/pdf-master-browser-runner.js dry-run` | Browser chain works |

### Decision Matrix

| Classification | All Gates Pass? | Decision |
|---------------|----------------|----------|
| REAL_MIGRATION | YES | **CONTINUE** to next round |
| REAL_MIGRATION | NO | **STOP** — fix failures first |
| PARTIAL_MIGRATION | ANY | **STOP** — not enough contraction |
| SCAFFOLD_ONLY | ANY | **STOP** — no business logic moved |
| INVALID | ANY | **STOP** — safety violation |

---

## 5. BM21/BM23/BM24 Sample Classification

The execution gate test (`tests/base-migration-execution-gate.test.js`) permanently encodes the classification of three known samples:

| Sample | Expected Classification | Rationale |
|--------|------------------------|-----------|
| BM21 | SCAFFOLD_ONLY | app.js delta = 0, no logic migrated |
| BM23 | PARTIAL_MIGRATION | Functions moved but delta negligible (+1) |
| BM24 | REAL_MIGRATION | 7 functions moved, delta = -19 |

These samples serve as **regression tests** — any change to the classification logic must still correctly classify all three.

---

## 6. Banned Operations During Any Migration Round

The following are **absolutely prohibited** during any BM-AUTO migration round:

- Modifying `app.js` outside the allowlist (only replacing old definitions with module references)
- Modifying any `qisi-*.js` file outside the target module
- Modifying `tests/file-dispatcher.test.js`, `tests/review-draft-state.test.js`, `tests/review-view-model.test.js`, `tests/batch-orchestrator.test.js`
- Modifying `main.html`, `app.css`, `package.json`, `package-lock.json`
- Modifying `AGENTS.md`, `ai/`, `skills/`
- Running `real-run`
- Running `test:ai-proxy` or `test:ai-vision-proxy`
- Integrating Route B into any production path
- Modifying controlled-write logic
- Creating new empty facade modules

---

## 7. Commit Convention

Each BM-AUTO round produces exactly one commit:

```
stage BM-AUTO round N migrate <group-name>
```

Where `<group-name>` is the scored group name (e.g., `draftSummaryHelpers`).

The round number `N` starts at 1 and increments monotonically.

---

## 8. Loop Termination

The BM-AUTO loop terminates when:

**Natural completion:**
- Inventory returns zero eligible candidates
- All eligible candidates have lineCount < 10

**Safety stop:**
- Any round produces non-REAL classification
- Any gate fails
- A banned file would need modification

**Manual stop:**
- Operator issues stop command
- real-run authorization is required but not granted

---

## 9. Recovery From Failed Round

If a round fails (non-REAL classification or gate failure):

1. **Do NOT** attempt to fix by modifying more files
2. **Do NOT** bypass the classification system
3. **Revert** the failed migration attempt
4. **Remove** the candidate from inventory (mark as `attempted: true, result: failed`)
5. **Re-run** inventory + score to find the next candidate
6. **Report** the failure with classification and reasons

---

## 10. Integration With Existing Safety Harness

BM-AUTO extends — but does not replace — the existing safety harness:

- **controlled-write** remains the single truth gate for PDF processing
- **Route B** remains research-only
- **DOCX+DOCX** remains the stable primary chain
- **PDF safe partial** remains the target (not 12/12 complete)
- **verify:safe** and **verify:batch-safety** remain mandatory

BM-AUTO adds one new invariant: **every migration must be REAL or it doesn't happen.**
