# P9A Post-P8 Code Quality and Boundary Audit

## Stage

P9A — Post-P8 code quality and boundary audit (read-only)

## Objective

只读审查 P8C/P8D/P8E0/P8G 的最新代码和文档，判断是否出现屎山化趋势，明确下一阶段方向。

## Commits Reviewed

| Stage | Commit | Files Changed |
| --- | --- | --- |
| P8C | `270c2d8` | `qisi-pdf-support-controlled-write.js` (+131), `tests/...` (+272), doc (new) |
| P8D | `8f32d38` | `scripts/pdf-master-browser-runner.js` (+93/-5), `tests/...` (+235), doc (new) |
| P8E0 | `19206ea` | doc only |
| P8F | `bae3d45` | doc only |
| P8G | `3b5d58f` | doc only |

Business code touched: **only 2 files** (controlled-write.js in P8C, runner.js in P8D).

---

## 1. is `classifyObjectiveAnswerRejection` purely diagnostic?

**Verdict: ✅ Purely diagnostic.**

`classifyObjectiveAnswerRejection` is called AFTER `normalizeObjectiveAnswerToLabels` returns `ok: false`. It does NOT participate in the normalization decision. It receives the already-rejected result and enriches the warning object with diagnostic metadata.

The function:
- Maps the existing `reason` field to a `rejectionCode` string
- Adds a human-readable `rejectionDetail`
- Collects `answerEvidence` from the parser item (read-only)
- Computes `normalizedCandidate` from the structural diagnostic (read-only)

It does NOT:
- Change the `ok`/`not ok` decision
- Influence `fieldDecisions`
- Influence `effectiveAnswerItems`
- Modify the parser answer item
- Override controlled-write policy

**No屎山 here. It's a clean diagnostic layer.**

---

## 2. Is the rejection taxonomy over-bloated?

**Verdict: ✅ Appropriately scoped.**

The taxonomy maps 10 specific reasons → 10 specific rejection codes, plus 1 `unknown-objective-answer-rejection` fallback. No categorization overlap, no redundant codes.

The lookup table (`OBJECTIVE_ANSWER_REJECTION_CLASSIFICATION`) is a static constant — no dynamic dispatch, no switch/case explosion, no conditional logic. It's a simple key-value map.

The rejection codes follow a consistent naming convention: `rejection-<category>`. Machine-readable, grep-friendly.

**No屎山 here. Clean lookup table pattern.**

---

## 3. Is the warning object backward-compatible?

**Verdict: ✅ Fully backward-compatible.**

Old fields preserved unchanged:
- `code: 'parser-objective-answer-rejected'` — still present
- `reason` — still present
- `structuralCandidate` — still present
- `structuralReason` — still present
- `originalAnswer` — still present

New fields are additive only:
- `rejectionCode` — NEW, machine-readable
- `rejectionDetail` — NEW, human-readable
- `normalizedCandidate` — NEW, diagnostic
- `answerEvidence` — NEW, evidence context

Any code that reads `warning.code` or `warning.reason` continues to work. New code can optionally read `warning.rejectionCode`.

**No屎山 here. Additive extensibility.**

---

## 4. Do P8D runner fields clearly distinguish layers?

**Verdict: ✅ Clear distinction. Now 5 layers instead of 2.**

Before P8D: only `safeAnswerNumbers` (from draft snapshot) and `fusedQuestionNumbers`.

After P8D, the runner report/ledger explicitly names each layer:

| Field | Source | Meaning |
| --- | --- | --- |
| `detectedAnswerNumbers` | Parser gate | What the parser found |
| `safeAnswerNumbers` | **Controlled-write accepted** (was draft snapshot) | What controlled-write approved |
| `controlledWriteAcceptedAnswerNumbers` | Controlled-write | Same as safeAnswerNumbers |
| `controlledWriteRejectedAnswerNumbers` | Controlled-write | What controlled-write rejected |
| `draftSnapshotAnswerNumbers` | Draft | What ended up in draft (may include repair path fills) |
| `baselineCandidateAnswerNumbers` | Intersection | What should count toward completeness |

Each layer has a separate field. No field does double duty. The downgrade logic (`pass-full` → `pass-safe-partial` when controlled-write has rejections) is explicit and traceable.

**No屎山 here. Layered transparency.**

---

## 5. Is the runner taking on too much business logic?

**Verdict: ✅ Small, focused additions.**

The runner's core job is orchestration + diagnostics. P8D added:
1. Extracting controlled-write numbers from existing diagnostic data — *reads existing data, no new logic*
2. Computing `baselineCandidateAnswerNumbers` as intersection — *one-line filter*
3. Downgrade logic for `alignMode` and `result` — *two if-blocks*

Total new logic in `runRealRun`: ~25 lines. All pure boolean checks on already-available data.

The runner does NOT:
- Call normalization functions
- Execute controlled-write
- Make field-level policy decisions
- Modify draft data

**No屎山 here. Thin diagnostic glue.**

---

## 6. Does P8E0 "P8E NOT ALLOWED" have sufficient evidence?

**Verdict: ✅ Evidence sufficient.**

P8E0 assessed each rejected answer against 9 structural criteria:

- Answer 2: Failed 4 criteria (not structural shell, not matching option, not A-F label, not normalizable)
- Answers 8/9: Failed 1 criterion (compaction yielded non-A-F payload)

The P8B fixture (`p7AnswerRejectionFixture`) independently proves that structural shells with non-A-F content are correctly rejected, and structural shells with A-F content (like `}B_\A{D}` → `BD`) are correctly accepted. The `normalizeObjectiveAnswerToLabels` function handles both cases correctly.

**No屎山 here. Correct audit conclusion.**

---

## 7. Was P8G pass-safe-partial correctly stopped?

**Verdict: ✅ Correctly stopped.**

P8G attempt 1 result:
- 7 answers rejected (2,3,4,5,6,8,9) — same rejection reasons as P7 fixture
- P8E0 already confirmed these rejections are structurally correct
- No fix to apply — further real-runs would waste AI/OCR calls on the same failure signature
- Stopped after 1 attempt with ledger recording

Per real-run rules: "同一 failure signature 不得无修复重复跑" — satisfied.

**No屎山 here. Disciplined stop.**

---

## 8. Is there any switch/case explosion or implicit special-casing?

**Verdict: ✅ None found.**

Grep audit results:
- No `if (question === '8')` or `if (question === '9')` anywhere in business code
- No `case 8:`, `case 9:` patterns
- No `questionNumber === '2'` special handling
- No `fusedQuestionNumbers.includes('8')` bypass logic
- The `OBJECTIVE_ANSWER_REJECTION_CLASSIFICATION` uses a static key-value map, not switch/case

**No屎山 here. Generic rules only.**

---

## 9. Is there any special-casing for answer 2/8/9?

**Verdict: ✅ None found.**

The fixture `p7AnswerRejectionFixture` names 2,8,9 in its `expected` block — but that's test data describing expected behavior, not business logic. The business code (`normalizeObjectiveAnswerToLabels`, `classifyObjectiveAnswerRejection`) has zero references to specific question numbers.

**No屎山 here. Fixture data ≠ business logic.**

---

## 10. Is there a case for further controlled-write modification?

**Verdict: ❌ No.**

P8E0 conclusively showed that `normalizeObjectiveAnswerToLabels` correctly:
- Accepts structural shells with valid A-F labels
- Rejects structural shells with non-A-F payload
- Rejects non-matching values
- Rejects unsafe math commands

The remaining gap (answers 8/9 missing) is NOT due to a controlled-write defect. It's due to the upstream OCR/AI answer extraction producing non-label-payload content in structural shells. Fixing controlled-write to accept non-label-payload would be a safety regression.

**Controlled-write is correct. Do not modify further.**

---

## 11. Next direction: code fix, OCR/prompt improvement, or safe partial productization?

**Verdict: Upstream answer extraction improvement (P9C).**

The root cause of the remaining gap is clear:
- The OCR/AI produces answer text that is structurally wrapped (`}_` pattern) with non-A-F payload
- controlled-write correctly rejects this
- The repair UI path fills some answers (2-6) from solution text but can't fill 8/9

Three options:
1. **Code fix** — rejected (P8E0 proved not a code defect)
2. **Upstream answer extraction** — eligible for investigation (P9C)
3. **Safe partial productization** — fallback if P9C says not eligible (P9I)

The gap is in the quality of the answer text extracted from PDF, not in the safety gate. If the answer extraction can produce cleaner labels (e.g., `A` instead of `}A_\A{A}`), controlled-write would accept them.

**Recommendation: Enter P9C to audit upstream answer extraction opportunity.**

---

## Overall Verdict

```
NO 屎山 DETECTED.

P8C-P8D changes are clean, minimal, backward-compatible, and correctly layered:
- P8C: diagnostic taxonomy (additive, no policy change)
- P8D: runner field separation (transparency, no policy change)
- P8E0: correct audit conclusion
- P8F: correct gate
- P8G: disciplined stop

Business code changes: only 2 files, +224 lines total.
No special-casing, no semantic guessing, no fail-closed weakening.
All new code is generic, testable, and documented.
```

## P9A Acceptance

```
[x] 只新增审计文档
[x] 未改业务代码
[x] 未改测试
[x] 未 real-run
[x] 明确判断：无屎山化趋势
[x] 明确判断：不再允许继续修 controlled-write
[x] 明确下一阶段方向：P9B → P9C (upstream extraction audit)
```

## Next Stage

**P9B** — 固化 P8G attempt 1 failure signature 为脱敏 fixture。
