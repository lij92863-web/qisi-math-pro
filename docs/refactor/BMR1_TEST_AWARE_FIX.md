# BMR1 Test-Aware Fix

## Root Cause

B. TEST_STATIC_RULE_NEEDS_MODULE_AWARE_UPDATE

## Problem

The BMR1 migration removed 63 lines from `app.js`. The ownership audit test used fixed absolute line numbers for `app.js` context windows, so two fixtures drifted away from their intended risky callsites:

- `PDF support context blocked`
- `support attachment context blocked`

The failed assertions expected `result.decision.startsWith('BLOCKED') === true`, but the stale line numbers now pointed at unrelated nearby code and returned non-blocked fixture-required decisions.

## Fix

`tests/qisi-app-display-cleaners-r3-ownership-audit.test.js` now finds callsites through stable source anchors instead of hard-coded absolute line numbers.

The test helper searches `app.js` text for real callsite fragments, including:

- PDF support cleanup callsites.
- PDF support warning attachment callsites.
- Answer/solution ownership cleanup callsites.
- Non-risky fixture-required display cleanup callsites.
- Migrated module call style: `window.Qisi.SupportRepair.repairChoiceOptions(...)` and `window.Qisi.SupportRepair.tryRepairedCandidate(...)`.

The audit still calls the existing `auditCallsite` logic with the resolved app.js line, so the ownership decision is still based on app.js context.

## Why This Is Not Test Weakening

The fix does not change expected blocked outcomes to allowed outcomes.

It keeps coverage for:

- PDF support context blocked.
- Support attachment context blocked.
- Controlled-write context blocked.
- Answer/solution ownership context blocked.
- Non-risky context not being reported as blocked.
- Migrated module call style being visible to app.js-context ownership audit.

The change removes only the stale fixed-line dependency. It keeps the ownership boundary assertions and adds coverage for the BMR1 module-call style.

## Verification

| Command | Result |
| --- | --- |
| `node --test tests/qisi-app-display-cleaners-r3-ownership-audit.test.js` | passed |
| `node scripts/base-migration-verify-execution.js --before .bm_auto_round_1_app_before.js --after app.js --module qisi-support-repair.js --old-names repairChoiceOptions,tryRepairedCandidate` | REAL_MIGRATION |
| `node --test tests/support-repair.test.js` | passed |
| `node --test tests/base-migration-execution-gate.test.js` | passed |
| `node --test tests/pdf-route-b-hold.test.js` | passed |
| `npm.cmd run smoke:batch:mock` | passed |
| `npm.cmd run verify:safe` | passed |
| `npm.cmd run verify:batch-safety` | passed |
| `npm.cmd run verify:pdf-known-bad` | passed |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | passed |
| `node scripts/pdf-master-browser-runner.js preflight` | passed |
| `node scripts/pdf-master-browser-runner.js dry-run` | passed |

## Safety

- controlled-write touched: no
- Route B integrated: no
- real-run called: no
- AI/OCR called: no

## Decision

BMR1 can be accepted.
