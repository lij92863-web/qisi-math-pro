# BM-AUTO A4 R3 Master Plan

Stage: BM-AUTO-A4-R3-MASTER-PLAN
Branch: main
Start commit: 1860326 stage BM-AUTO add A4 R3 shard verifier

## Total Remaining Callsites

105 naked A4 callsites remain in app.js.

## Total Shards

11 shards, each with 5-10 callsites.

## Shard Size

Max 10 callsites per shard, ordered by safety priority.

## Shard Order

| Order | Shard | Sites | Blocked | Audit | Candidate | Helpers |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | R3-S001 | 10 | 0 | 0 | 10 | cleanDisplayTextForBatchSave |
| 2 | R3-S002 | 10 | 0 | 0 | 10 | cleanDisplayTextForBatchSave |
| 3 | R3-S003 | 10 | 0 | 2 | 8 | cleanDisplayTextForBatchSave, cleanDisplayOptionsForBatchSave |
| 4 | R3-S004 | 10 | 0 | 2 | 8 | cleanDisplayOptionsForBatchSave |
| 5 | R3-S005 | 10 | 0 | 3 | 7 | cleanDisplayOptionsForBatchSave, addWarningOnce |
| 6 | R3-S006 | 10 | 2 | 7 | 1 | addWarningOnce, cleanDisplayFieldsOnly, cleanDisplayTextForBatchSave |
| 7 | R3-S007 | 10 | 4 | 6 | 0 | cleanDisplayTextForBatchSave, cleanDisplayOptionsForBatchSave |
| 8 | R3-S008 | 10 | 7 | 3 | 0 | cleanDisplayOptionsForBatchSave, addWarningOnce |
| 9 | R3-S009 | 10 | 10 | 0 | 0 | cleanDisplayTextForBatchSave, cleanDisplayOptionsForBatchSave |
| 10 | R3-S010 | 10 | 10 | 0 | 0 | cleanDisplayOptionsForBatchSave, addWarningOnce, cleanDisplayFieldsOnly, cleanDisplayTextForBatchSave |
| 11 | R3-S011 | 5 | 5 | 0 | 0 | addWarningOnce |

## Safe-First Policy

Shards are ordered from least risky (pure display-only, no ownership markers) to most risky (PDF paths, controlled-write adjacent, support attachment). Earlier shards are more likely to contain replacement candidates.

## Blocked Categories

| Category | Count |
| --- | ---: |
| BLOCKED_CONTROLLED_WRITE | varies by shard |
| BLOCKED_PDF_OWNERSHIP | varies by shard |
| BLOCKED_SUPPORT_ATTACHMENT | varies by shard |
| BLOCKED_ANSWER_SOLUTION_OWNERSHIP | varies by shard |
| BLOCKED_UNKNOWN | 0 |

Per the ownership audit, 0 of 105 callsites have `replacementAllowed: true` without first creating and passing callsite-specific fixtures. All 105 require fixtures before replacement can be considered.

## Replacement Rules

1. Only replace if ownership audit says `replacementAllowed: true` AND fixture tag exists in the fixture test file.
2. Controlled-write adjacent callsites are always blocked.
3. PDF ownership callsites require explicit PDF-path fixture proof.
4. Support attachment callsites require fixture proof of no support injection.
5. Answer/solution ownership callsites require fixture proof of no ownership change.

## Testing Rules

- After each shard: run core tests + verify:batch-safety + preflight + dry-run.
- Every 3 shards: run full verify:safe + smoke:batch:mock + verify:pdf-known-bad + controlled-write ownership.
- Any shard touching PDF-path callsites: run full PDF safety immediately.
- If any test fails: stop, do not commit replacement, document the failure.

## Commit Policy

- Each shard gets its own commit: `stage BM-AUTO process A4 R3 shard <ID>`.
- If a shard has zero replacements, still commit the shard audit doc.
- After 5 shards: create or update progress report.
- Push after every commit.

## Stop Policy

Stop the shard loop if:
- All shards processed.
- No shard has replacementAllowed callsites and 5 consecutive shards have zero replacements.
- Any hard stop condition occurs (baseline test fails, verify:safe fails, etc.).

If 5 consecutive shards have zero replacements, create `BM_AUTO_A4_R3_STOP_NO_REPLACEABLE_SHARDS.md`.

## Decision

R3 shard campaign ready to execute. Proceed with shard execution loop starting at R3-S001.
