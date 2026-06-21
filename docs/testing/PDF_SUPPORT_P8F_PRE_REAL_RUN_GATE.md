# PDF Support P8F Pre-Real-Run Full Regression Gate

## Stage

P8F — pre-real-run full regression gate

## Date

2026-06-22

## Pre-Gate Status

| Item | Value |
| --- | --- |
| Branch | `main` |
| Latest commit | `19206ea stage P8E0 audit objective answer normalization repair eligibility` |
| Working tree | clean |
| Real-run count used | 0 / 20 |

## Gate Results

### Unit Tests

| Command | Result |
| --- | --- |
| `node --test tests/pdf-support-controlled-write-answer-ownership.test.js` | ✅ 16/16 |
| `node --test tests/pdf-master-browser-runner.test.js` | ✅ 7/7 |
| `npm test -- tests/pdf-real-case.test.js` | ✅ 10/10 |
| `npm test -- tests/pdf-support-aligner.test.js` | ✅ 26/26 |
| `npm test -- tests/pdf-support-block-parser.test.js` | ✅ 19/19 |

### Safety Verification

| Command | Result |
| --- | --- |
| `npm run smoke:batch:mock` | ✅ 20/20 |
| `npm run verify:safe` | ✅ 137/137 |
| `npm run verify:pdf-known-bad` | ✅ 65/65 |
| `npm run verify:batch-safety` | ✅ All pass |
| `npm run verify:diff-scope` | ✅ No changed files |

### Runner Gates

| Command | Result |
| --- | --- |
| `node scripts/pdf-master-browser-runner.js preflight` | ✅ ok: true, all checks pass |
| `node scripts/pdf-master-browser-runner.js dry-run` | ✅ ok: true |

### Safety Invariant Checks

| Invariant | Status |
| --- | --- |
| DOCX+DOCX stable chain | ✅ 20/20 smoke |
| known-bad unsafe answers blocked | ✅ 65/65 |
| Attempt 12 unsafe ownership not expanded | ✅ prefix, only solutions 1,2 |
| parser-objective-answer-rejected preserved | ✅ backward compatible |
| P8C rejection taxonomy working | ✅ 16/16 |
| P8D runner summary consistency fixed | ✅ 7/7 |
| No qisi-*.js changes | ✅ (only controlled-write.js in P8C, runner.js in P8D) |
| No app.js changes | ✅ |
| No real-run | ✅ |
| No AI/OCR calls | ✅ |
| No semantic guessing | ✅ |
| No special question fallback | ✅ |

## P8E0 Decision

P8E0 concluded: **P8E NOT ALLOWED.** All three rejected answers (2, 8, 9) were genuinely rejected — no normalization mis-fire to repair. P8E1 skipped.

## Gate Decision

**P8F PASSED.** All gates green. Ready for P8G controlled real-run loop.

## Next Stage

**P8G** — controlled real-run loop with max 20 attempts. Each real-run must be preceded by full gate verification and followed by ledger recording and classification.
