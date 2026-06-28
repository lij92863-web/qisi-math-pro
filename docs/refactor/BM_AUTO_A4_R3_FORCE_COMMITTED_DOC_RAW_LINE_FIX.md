# BM-AUTO A4 R3 Force Committed Doc Raw Line Fix

Stage: BM-AUTO-A4-R3-FORCE-COMMITTED-DOC-RAW-LINE-FIX
Branch: main
Start point: after failed remote raw verification

## Problem

Previous reports claimed that three medium documents had been rewritten as multi-line Markdown, but remote committed raw content still appeared compressed.

## Root Cause

The prior verification relied on local reporting that did not match the committed object visible from origin/main. This fix validates the worktree, index, HEAD object, and origin/main object explicitly.

## Files Changed

- docs/refactor/BM_AUTO_A4_R3_MEDIUM_CAMPAIGN_SUMMARY.md
- docs/refactor/BM_AUTO_A4_R3_MEDIUM_REMAINING_REGISTER.md
- docs/refactor/BM_AUTO_A4_R3_MEDIUM_WRAPPER_REMOVAL_GATE.md
- docs/refactor/BM_AUTO_A4_R3_FORCE_COMMITTED_DOC_RAW_LINE_FIX.md

## Validation Plan

The fix must pass raw line checks at four levels:

1. worktree file content
2. staged index content
3. HEAD committed object
4. origin/main committed object

## Safety

| Check | Value |
| --- | --- |
| app.js changed | no |
| qisi-utils.js changed | no |
| production behavior changed | no |
| controlled-write touched | no |
| parser/aligner/runner touched | no |
| forbidden files changed | no |

## Decision

- This is a docs-only formatting correction.
- Medium campaign acceptance depends on origin/main raw object passing line-count checks.
- A4 staged migration remains incomplete.
- Wrappers remain.

