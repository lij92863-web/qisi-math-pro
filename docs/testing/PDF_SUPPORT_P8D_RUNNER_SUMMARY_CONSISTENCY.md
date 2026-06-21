# PDF Support P8D Runner Summary Consistency Report

## Stage

P8D — runner summary consistency repair

## Objective

修复 runner 报告中的口径不一致：

```
runner draft snapshot safe answer includes 2
controlled-write rejected answer includes 2
```

runner 报告不得把 draft snapshot 当成 baseline accepted。

## Problem Diagnosed

P7 暴露的口径不一致：

| Source | Answer 2 Status |
| --- | --- |
| Parser gate | Detected (full, 12/12) |
| Controlled-write | **Rejected** (`option-value-not-matched`) |
| Draft snapshot | **Has answer** (from review/repair path) |
| Old `safeAnswerNumbers` in ledger | Included 2 (from draft snapshot) |
| `baselineCandidateAnswerNumbers` | Should NOT include 2 |

旧 runner 用 `draftSnapshot.filter(draft => draft.hasAnswer)` 作为 `safeAnswerNumbers`，但 draft snapshot 可能包含来自 review/repair 路径的答案（不是 controlled-write accepted）。

## Changes Made

### 1. `makeLedgerEntry` — new fields

| New Field | Description |
| --- | --- |
| `controlledWriteAcceptedAnswerNumbers` | Answers accepted by controlled-write |
| `controlledWriteRejectedAnswerNumbers` | Answers rejected by controlled-write |
| `draftSnapshotAnswerNumbers` | Answers present in draft snapshot |
| `baselineCandidateAnswerNumbers` | Controlled-write accepted ∩ draft snapshot answers |

### 2. `buildSolutionDiagnostics` — new diagnostic fields

| New Field | Source |
| --- | --- |
| `controlledWriteAcceptedAnswerNumbers` | `controlledWrite.answerQuestionNumbers` |
| `controlledWriteRejectedAnswerNumbers` | `controlledWrite.rejectedAnswerNumbers` |
| `controlledWriteAcceptedSolutionNumbers` | `controlledWrite.solutionQuestionNumbers` |
| `controlledWriteRejectedSolutionNumbers` | `controlledWrite.rejectedSolutionNumbers` |

### 3. `runRealRun` — result classification fix

- `safeAnswerNumbers` now uses `controlledWriteAcceptedAnswers` (not draft snapshot)
- `alignMode` downgrades to `prefix` when controlled-write has rejections
- `result` downgrades from `pass-full` to `pass-safe-partial` when:
  - Controlled-write has rejected answers
  - Draft snapshot has missing answers
- `baselineCandidateAnswerNumbers` = intersection of controlled-write accepted and draft snapshot answers

### 4. `appendStage6Report` — new report lines

- Controlled-write accepted answers
- Controlled-write rejected answers
- Draft snapshot answers
- Baseline candidate answers

## Runner Report Now Distinguishes

```
parserGate safe answer numbers      → from parser gate
aligner safe answer numbers         → from aligner
controlledWrite accepted answers    → from controlled-write
controlledWrite rejected answers    → from controlled-write
draft snapshot answer numbers       → from draft
baseline candidate answer numbers   → intersection
```

## Key Safety Rule Enforced

```
If answer 2 is rejected by controlled-write,
it MUST NOT appear in baseline accepted answer set.
```

## P8D Acceptance Checklist

```
[x] runner 区分 parserGate / aligner / controlledWrite / draft / baseline candidate
[x] answer 2 rejected 时不进入 baseline accepted
[x] parserGate full 不再被误报为 complete (downgrade logic)
[x] runner ledger alignMode 与 controlled-write fused 状态一致
[x] stale runId 防护仍有效 (unchanged)
[x] preflight/dry-run 不调用 AI/OCR (verified)
[x] no qisi business code changes
[x] no app/main/package changes
[x] no real-run
```

## Next Stage: P8E0

P8E0 will audit whether there is sufficient structural evidence to justify an objective answer normalization repair for answers 2, 8, and 9.
