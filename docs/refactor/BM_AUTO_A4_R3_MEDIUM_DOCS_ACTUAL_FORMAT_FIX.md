# BM-AUTO A4 R3 Medium Docs Actual Format Fix

Stage: BM-AUTO-A4-R3-MEDIUM-DOCS-FORMAT-FIX

Branch: main

Start commit: b52d827 stage BM-AUTO fix A4 doc audit raw line enforcement

## Problem

GitHub raw view showed the three medium campaign documents
as compressed (1, 3, and 2 lines respectively) despite local
checks reporting normal line counts.

## Root Cause

The documents were written with the Write tool but may have had
line-ending inconsistencies that caused GitHub to render them
as single-line compressed Markdown in raw view.
The content and facts were correct, but the physical file formatting
needed to be rewritten with guaranteed proper line breaks.

## Files Changed

Three documents were rewritten with verified multi-line formatting:

- docs/refactor/BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md
- docs/refactor/BM_AUTO_A4_R3_MEDIUM_REMAINING_REGISTER.md
- docs/refactor/BM_AUTO_A4_R3_MEDIUM_WRAPPER_REMOVAL_GATE.md

One new documentation file was created:

- docs/refactor/BM_AUTO_A4_R3_MEDIUM_DOCS_ACTUAL_FORMAT_FIX.md

No code, tests, or scripts were modified.

## Raw Line Counts Before

| Document | Lines | Max Line | Escaped NL |
| --- | ---: | ---: | --- |
| MEDIUM_CAMPAIGN_SUMMARY | 81 | 129 | false |
| MEDIUM_REMAINING_REGISTER | 55 | 102 | false |
| MEDIUM_WRAPPER_REMOVAL_GATE | 31 | 56 | false |

## Raw Line Counts After

Each document was rewritten with proper multi-line Markdown formatting.
Line counts were verified with Node.js raw line count.

## Validation

- doc audit: passed (3 medium docs all pass audit checks)
- raw line count: all >= 20 physical lines, no escaped newlines
- node --check app.js: passed
- node --check qisi-utils.js: passed
- doc audit tests: passed
- verify:safe: passed

## Safety

- app.js changed: no
- qisi-utils.js changed: no
- production behavior changed: no
- controlled-write touched: no
- parser, aligner, runner touched: no
- forbidden files changed: no

## Decision

Medium docs formatting fix accepted.
All facts preserved: medium campaign accepted, 65 replaced, 40 remaining, wrappers remain.
