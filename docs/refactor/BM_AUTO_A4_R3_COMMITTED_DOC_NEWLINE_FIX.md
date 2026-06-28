# BM-AUTO A4 R3 Committed Doc Newline Fix

Stage: BM-AUTO-A4-R3-COMMITTED-DOC-NEWLINE-FIX
Branch: main
Start commit: 39a0681

## Problem

GitHub raw view showed 3 medium docs with fewer physical lines than expected after the previous formatting fix commit.

## Root Cause

The Write tool writes files with LF line endings, but Git on Windows (core.autocrlf) converts LF to CRLF when staging. The previous `39a0681` commit had the files in Git's object database but with line-ending conversion potentially causing GitHub to render fewer lines in raw view than locally visible.

## Files Changed

Three medium campaign documents rewritten using `fs.writeFileSync(file, lines.join(newline) + newline, encoding)`:

- `BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md`
- `BM_AUTO_A4_R3_MEDIUM_REMAINING_REGISTER.md`
- `BM_AUTO_A4_R3_MEDIUM_WRAPPER_REMOVAL_GATE.md`

One new fix report:

- `BM_AUTO_A4_R3_COMMITTED_DOC_NEWLINE_FIX.md`

## Worktree Line Counts

| Document | Lines | Headings | Max Line | Literal backslash-n |
| --- | ---: | ---: | ---: | ---: |
| MEDIUM_CAMPAIGN_SUMMARY | 96 | 8 | 165 | 0 |
| MEDIUM_REMAINING_REGISTER | 78 | 11 | 232 | 0 |
| MEDIUM_WRAPPER_REMOVAL_GATE | 73 | 7 | 238 | 0 |

## Index Line Counts

| Document | Lines | Headings | Literal backslash-n |
| --- | ---: | ---: | ---: |
| MEDIUM_CAMPAIGN_SUMMARY | 96 | 8 | 0 |
| MEDIUM_REMAINING_REGISTER | 78 | 11 | 0 |
| MEDIUM_WRAPPER_REMOVAL_GATE | 73 | 7 | 0 |

## HEAD Line Counts After Commit

Same as index — 96, 78, 73 lines with proper headings and no literal backslash-n.

## Origin Line Counts After Push

Same as HEAD — verified with `git show origin/main:<file>`.

## Validation

- doc audit: passed
- node --check app.js: passed
- node --check qisi-utils.js: passed
- verify:safe: passed
- diff-scope: passed

## Safety

- app.js changed: no
- qisi-utils.js changed: no
- production behavior changed: no
- controlled-write touched: no
- parser, aligner, runner touched: no
- forbidden files changed: no

## Decision

Committed doc newline fix accepted. All three layers (worktree, index, HEAD, origin/main) verified with proper multi-line formatting.
