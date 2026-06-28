# BM-AUTO Full Round 009 REAL_MIGRATION

Stage: BM-AUTO-FULL-ELIGIBLE-MIGRATION-CAMPAIGN
Branch: main
Start commit: `dea3cf6`
End commit: (not-completed)
Target helper group: `isFatalQwenServiceError`
Target module: `qisi-utils.js`
Changed files:

- `app.js`
- `qisi-utils.js`
- `tests/qisi-utils-is-fatal-qwen-service-error.test.js`
- `docs/refactor/BM_AUTO_FULL_ROUND_009_PLAN.md`
- `docs/refactor/BM_AUTO_FULL_CANDIDATE_POOL_UPDATE_AFTER_006.md`

---

## Purpose

- Move the pure error pattern matching helper from `app.js` to `qisi-utils.js`.

---

## Candidate audit

### Selected candidate

- **Name:** isFatalQwenServiceError
- **Why eligible:** Pure helper, deterministic, no side effects, no DOM/DB/AI/OCR/async
- **Why low-risk:** Only depends on JS built-ins (String, .toLowerCase, .includes)

### Rejected candidates

1. **replaceQisiImageTokensForLatex** (score 82, 32 lines): Rejected — no call sites in app.js (never called)
2. **normalizeEditorChoiceLabel** (score 98): Rejected — only 4 lines, below 10-line minimum
3. **ommlChildren** (score 94): Rejected — only 2 lines alone, needs group migration
4. **splitMergedRecognizedItems** (score 94): Rejected — depends on 3 app.js functions
5. **isLikelyRealQuestionFigure** (score 90): Rejected — depends on 4 app.js functions

---

## Migration

- **Old app.js function names:** isFatalQwenServiceError
- **Old app.js approximate locations:** lines 1344-1363
- **Old behavior summary:** Takes error object, returns boolean based on string pattern matching for fatal Qwen service errors
- **New module exports:** isFatalQwenServiceError added to qisi-utils.js api object
- **app.js explicit call sites:** 34 call sites updated to window.Qisi.Utils.isFatalQwenServiceError
- **Before lines:** 23026
- **After lines:** 23005
- **Delta:** -21

---

## Behavior equivalence

- **Preserved behavior:** All error pattern matching logic identical
- **Edge cases:** null, undefined, empty string, non-standard input all handled same way
- **Tests added:** 16 tests covering normal, empty, null, undefined, various error types, case insensitivity, boundary, real case, mutation, output shape, malformed input

---

## Execution verification

```
node scripts/base-migration-verify-execution.js --before .bm_app_before.js --after app.js --module qisi-utils.js --old-names isFatalQwenServiceError
```

- classification: REAL_MIGRATION
- old definitions removed: yes
- app calls new module: yes
- module exports moved functions: yes

---

## Tests

- `node --check app.js`: passed
- `node --check qisi-utils.js`: passed
- `node --test tests/qisi-utils-is-fatal-qwen-service-error.test.js`: passed (16/16)
- `node --test tests/base-migration-execution-gate.test.js`: passed (15/15)
- `node --test tests/pdf-route-b-hold.test.js`: passed (6/6)
- `npm.cmd run verify:safe`: passed (20/20)
- `npm.cmd run verify:batch-safety`: passed (20/20)
- `npm.cmd run smoke:batch:mock`: passed (20/20)
- `npm.cmd run verify:pdf-known-bad`: passed (65/65)
- `node --test tests/pdf-support-controlled-write-answer-ownership.test.js`: passed (21/21)
- `node scripts/pdf-master-browser-runner.js preflight`: passed
- `node scripts/pdf-master-browser-runner.js dry-run`: passed

---

## Safety

- controlled-write touched: no
- parser touched: no
- aligner touched: no
- runner touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no
- package changed: no
- main.html changed: no
- verifier changed: no

---

## Decision

- classification: REAL_MIGRATION
- accepted: yes
- continue next round: yes
