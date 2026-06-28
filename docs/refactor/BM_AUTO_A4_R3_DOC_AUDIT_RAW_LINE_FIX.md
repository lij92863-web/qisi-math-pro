# BM-AUTO A4 R3 Doc Audit Raw Line Fix

Stage: BM-AUTO-A4-R3-DOC-AUDIT-RAW-LINE-FIX
Branch: main
Start commit: f786397

## Problem

Previous medium campaign summary doc audit did not sufficiently enforce raw physical line count and escaped newline detection. The doc audit passed for all 3 medium docs but the check criteria were not stringent enough.

## Root Cause

The original `auditSource` function checked line count, section count, and required fields, but did not:
- Check for physical lines containing literal backslash-n used as line separator (escaped newline abuse)
- Enforce minimum heading count
- Check average line length

## Files Changed

- `scripts/bm-a4-doc-audit.js` — Added escaped newline detection, heading count check, average line length
- `tests/qisi-app-display-cleaners-doc-audit.test.js` — Added 4 new tests (escaped newline, 3 regression tests for medium docs)
- `docs/refactor/BM_AUTO_A4_R3_DOC_AUDIT_RAW_LINE_FIX.md` — This document

No production code changed. No qisi-utils.js changed. No app.js changed.

## Validation

- 3 medium docs physical line counts: 81, 55, 31 (all >= 20)
- No escaped newline detected in any of the 3 docs
- Doc audit tests: 12 pass, 0 fail
- Doc audit run: correctly flags issues across all BM_AUTO docs

## Raw Line Counts After Fix

| Document | Physical Lines | Max Line Length | Escaped NL |
| --- | ---: | ---: | --- |
| MEDIUM_CAMPAIGN_SUMMARY | 81 | 129 | false |
| MEDIUM_REMAINING_REGISTER | 55 | 102 | false |
| MEDIUM_WRAPPER_REMOVAL_GATE | 31 | 56 | false |

## Safety

- app.js changed: no
- qisi-utils.js changed: no
- production behavior changed: no
- controlled-write touched: no
- parser/aligner/runner touched: no
- forbidden files changed: no

## Decision

Doc audit raw line enforcement fixed. All 3 medium docs are properly formatted with real physical newlines.
Medium campaign facts preserved: 65 total R3 replaced, 40 remaining, wrappers remain.
