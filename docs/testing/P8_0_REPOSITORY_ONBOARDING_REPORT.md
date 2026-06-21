# P8-0 Repository Onboarding and Requirement Comprehension Report

## Stage

P8-0 — Repository onboarding and requirement comprehension

## Date

2026-06-22

---

## 1. Repository Status

| Check | Result |
| --- | --- |
| `git status --short` | Clean (empty) |
| `git branch --show-current` | `main` |
| `git branch -vv` | `main` → `origin/main` at `7a7d33f` |
| `git remote -v` | `origin https://github.com/lij92863-web/qisi-math-pro.git` |
| `git pull --ff-only` | Already up to date |
| Latest commit | `7a7d33f stage P8A audit pdf answer rejection chain` |

Recent commit history:

```
7a7d33f stage P8A audit pdf answer rejection chain
8c428c5 stage P7 record controlled pdf real run
1225643 stage P6 harden pdf master runner diagnostics
5cc4c8a stage P5 stabilize pdf support controlled write
d71388c stage P4.3 constrain aligner to validator result
e0d2f60 stage P4.2 add pdf support sequence validator
039663d stage P4.1 define normalized pdf support items
fac921e stage P3.2 add pdf support swing invariants
6391b5c stage P3.1 audit pdf support swing root cause
d95f13c stage P2 add attempt 12 sequence diagnostic fixture
4cff461 stage P1.3 audit app js boundary
114873d stage P1.2 document verification command matrix
97c360d stage P1.1 tighten repository ignore rules
2ddf2bc stage PDF support record answer coverage real-run
300a1fd stage PDF support record answer coverage real-run
```

---

## 2. Files Read

### Top-level specification files

| File | Status |
| --- | --- |
| `AGENTS.md` | ✓ Read |
| `package.json` | ✓ Read |

### AI constitution / governance files

| File | Status |
| --- | --- |
| `ai/AGENT_CONSTITUTION.md` | ✓ Read |
| `ai/MODULE_BOUNDARIES.md` | ✓ Read |
| `ai/STABLE_CHAINS.md` | ✓ Read |
| `ai/ACCEPTANCE_CRITERIA.md` | ✓ Read |
| `ai/TESTING_GUIDE.md` | ✓ Read |
| `ai/CODEX_WORKFLOW.md` | ✓ Read |
| `ai/AUTOMATION_STAGE_ROADMAP.md` | ✓ Read |
| `ai/CODEX_TASK.local.md` | Present but not read in this stage |

### Skills

| File | Status |
| --- | --- |
| `skills/batch-import/SKILL.md` | ✓ Read |
| `skills/docx-stable-chain/SKILL.md` | ✓ Read |
| `skills/pdf-support-safe-align/SKILL.md` | ✓ Read |
| `skills/app-js-boundary/SKILL.md` | ✓ Read |
| `skills/local-ai-ocr-boundary/SKILL.md` | ✓ Read |
| `skills/testing-verification/SKILL.md` | ✓ Read |
| `skills/review-page-draft/SKILL.md` | ✓ Read |
| `skills/git-stage-workflow/SKILL.md` | ✓ Read |
| `skills/qisi-module-refactor/SKILL.md` | ✓ Read |

### Stage documents

| File | Status |
| --- | --- |
| `docs/testing/VERIFY_COMMAND_MATRIX.md` | ✓ Read |
| `docs/audits/APP_JS_BOUNDARY_AUDIT.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_ATTEMPT_12_SEQUENCE_DIAGNOSTIC.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_SWING_ROOT_CAUSE_AUDIT.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_NORMALIZED_ITEM_SPEC.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_SEQUENCE_VALIDATOR_SPEC.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_ALIGNER_VALIDATOR_INTEGRATION.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_CONTROLLED_WRITE_SPEC.md` | ✓ Read |
| `docs/testing/PDF_MASTER_RUNNER_DIAGNOSTIC_SPEC.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_P7_REAL_RUN_REPORT.md` | ✓ Read |
| `docs/testing/PDF_SUPPORT_P8A_ANSWER_REJECTION_AUDIT.md` | ✓ Read |

### Core business modules

| File | Status |
| --- | --- |
| `qisi-pdf-support-block-parser.js` | ✓ Read (1092 lines) |
| `qisi-pdf-support-aligner.js` | ✓ Read (549 lines) |
| `qisi-pdf-support-controlled-write.js` | ✓ Read (732 lines) |
| `scripts/pdf-master-browser-runner.js` | ✓ Read (2373 lines) |

### Test files

| File | Status |
| --- | --- |
| `tests/fixtures/pdf-real-case-minimal.js` | ✓ Read (597 lines) |
| `tests/pdf-real-case.test.js` | ✓ Read (694 lines) |
| `tests/pdf-support-block-parser.test.js` | ✓ Read (739 lines) |
| `tests/pdf-support-aligner.test.js` | ✓ Read (728 lines) |
| `tests/batch-smoke-mock.test.js` | ✓ Read (1342 lines) |
| `tests/pdf-master-browser-runner.test.js` | ✓ Read (245 lines) |
| `tests/pdf-support-controlled-write-answer-ownership.test.js` | ✗ **not found; P8B should add it** |

---

## 3. Project Goal

奇思数学 Pro is a local-first high-school math question-bank and batch-import system.

Primary workflow:
```
Upload question PDF + answer/solution PDF
→ Auto-recognize questions, answers, solutions
→ Write to review draft
→ Teacher reviews and submits to question bank
```

Core engineering principle:
```
宁可空，不能错挂 (Better empty than wrong)
Missing answer/solution is acceptable.
Wrongly attached answer/solution is unacceptable.
```

The current governance batch is focused on the **dual-PDF (PDF+PDF) import pipeline** — stabilizing it to produce reliable drafts without wrong answer/solution attachment.

---

## 4. Stable Chain Summary

### 4.1 Stable Chain A: DOCX+DOCX (primary stable path)

- DOCX+DOCX is the stable baseline for batch import.
- Must never be broken by PDF/AI/OCR changes.
- Protected by `verify:docx-stable`, `smoke:batch:mock`, and `verify:batch-safety`.
- Required behavior: question count, order, options, answer, solution, images all preserved.

### 4.2 Stable Chain B: PDF support fail-closed

- PDF support can attach answers/solutions only when alignment is reliable.
- Only three valid modes: `full`, `prefix`, `fail-closed`.
- Protected by `verify:pdf-known-bad`.
- Known-bad jump-back sequences must stay blocked.

### 4.3 Stable Chain C: Review draft workspace

- Review page must show uncertainty (missing answers, missing solutions, etc.).
- Draft editor must preserve LaTeX source, options, and raw evidence.

### 4.4 Stable Chain D: Local AI/OCR boundary

- No real AI/OCR in default tests.
- `verify:no-real-ai` guards against accidental calls.
- Real tests require explicit authorization.

### 4.5 Skill boundary summary

| Concern | Rule |
| --- | --- |
| DOCX stable chain | Must not regress; primary stable path |
| PDF support safe align | Fail-closed when uncertain; no semantic guessing |
| app.js boundary | Cannot absorb large business logic; qisi-*.js preferred |
| local AI/OCR boundary | No real calls without explicit real-test task |
| Testing / verification | Mock-first; `verify:safe` is default gate |
| controlled-write | Field-level independent answer/solution validation |
| runner / browser runner | preflight → dry-run → real-run (authorized only) |

---

## 5. PDF Support Data Flow

### Current pipeline

```
rawTextPages (from OCR/AI page result)
    │
    ▼
┌─────────────────────────────────────────────┐
│ BLOCK PARSER (qisi-pdf-support-block-parser.js)
│                                              │
│ Responsibilities:                            │
│  - Normalize raw text pages (pageIndex,      │
│    sourceOrder, text)                        │
│  - Parse question markers (第N题, N., etc.)   │
│  - Parse label markers (答案, 解析, etc.)      │
│  - Split into support blocks per question    │
│  - Handle implicit sequencing when explicit   │
│    markers are absent                         │
│  - Detect duplicates, jump-backs, unknown     │
│    markers                                    │
│  - Emit answerItems and solutionItems with    │
│    sourceTrace and evidence metadata          │
│                                              │
│ Output: blocks[], answerItems[],              │
│         solutionItems[], warnings[]           │
│                                              │
│ Does NOT decide: which items are safe to      │
│ write to draft.                               │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ SEQUENCE VALIDATOR (validatePdfSupportSequence)
│   inside qisi-pdf-support-aligner.js          │
│                                              │
│ Responsibilities:                            │
│  - Validate answer/solution sequence          │
│    continuity                                 │
│  - Detect duplicate, jump-back, gap,          │
│    out-of-range numbers                       │
│  - Check answer/solution question set match   │
│  - Find reliable prefix                       │
│  - Report mode: full / prefix / fail-closed    │
│                                              │
│ Does NOT decide: field-level write policy.    │
│ Does NOT inspect answer/solution content.     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ ALIGNER (alignPdfSupport)                     │
│   inside qisi-pdf-support-aligner.js          │
│                                              │
│ Responsibilities:                            │
│  - Delegate to sequence validator             │
│  - Map validator result to safe answer/       │
│    solution items                             │
│  - Must NOT expand ownership beyond           │
│    validator result                           │
│  - Must NOT attach after gap, duplicate,      │
│    or jump-back                               │
│  - Answer complete ≠ solution complete        │
│                                              │
│ Does NOT decide: which fields to write        │
│ per draft question.                           │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ PARSER GATE (buildPdfSupportParserGate)       │
│   inside qisi-pdf-support-controlled-write.js │
│                                              │
│ Responsibilities:                            │
│  - Assemble rawTextPages from various sources │
│  - Call block parser + aligner               │
│  - Produce unified answers[], solutions[],    │
│    mode, fusedQuestionNumbers                 │
│                                              │
│ Does NOT decide: field-level write per        │
│ question.                                     │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ CONTROLLED WRITE                              │
│ (buildPdfSupportFieldLevelControlledWrite)    │
│   inside qisi-pdf-support-controlled-write.js │
│                                              │
│ Responsibilities:                            │
│  - Field-level write policy per question     │
│  - Objective answer: normalize to labels     │
│  - Legacy answer > parser answer for objective│
│  - Unsafe answer → reject with warning code  │
│  - Solution write independent from answer    │
│  - Fused question numbers block writes       │
│  - Record warnings, field decisions          │
│                                              │
│ This is the FINAL safety gate before draft.   │
│                                              │
│ Does NOT decide: runner report summary,       │
│ baseline classification.                      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│ RUNNER / DRAFT WRITE / REPORT                 │
│ (scripts/pdf-master-browser-runner.js,       │
│  app.js final write transaction)              │
│                                              │
│ Responsibilities:                            │
│  - preflight: environment check               │
│  - dry-run: wiring check (no AI/OCR)          │
│  - real-run: browser automation, upload,      │
│    wait, collect diagnostics                  │
│  - Draft cleanup before run                   │
│  - Ledger recording                           │
│  - Report: missing answers, missing solutions,│
│    alignMode, fusedQuestionNumbers            │
│                                              │
│ Current issue: draft snapshot answer set ≠    │
│ controlled-write accepted answer set.          │
└─────────────────────────────────────────────┘
```

### Layer boundaries (non-negotiable)

| Layer | Allowed | Forbidden |
| --- | --- | --- |
| Block parser | Parse markers, produce items with evidence | Decide field write safety |
| Sequence validator | Validate structural sequence | Inspect answer/solution content |
| Aligner | Map validator to safe items | Expand ownership beyond validator |
| Controlled write | Field-level policy, objective answer normalization | Use semantic guessing, special question fallback |
| Runner | Orchestration, diagnostics, ledger | Modify business logic, bypass gates |

### Layers that cannot cross-authority

- Parser gate `full` ≠ controlled-write `complete`
- Solution complete ≠ answer complete
- Answer complete ≠ solution complete
- Draft snapshot safe answer numbers ≠ controlled-write accepted answer numbers
- Runner ledger alignMode ≠ parser gate align output (different layers)

---

## 6. Current P7/P8A Problem Summary

### P7 Result (exact, from `PDF_SUPPORT_P7_REAL_RUN_REPORT.md`)

```
Result: pass-safe-partial

Answer coverage:   10/12 (missing: 8, 9)
Solution coverage: 12/12

Rejected answers:  2, 8, 9
Rejected solutions: none

Warning code:      parser-objective-answer-rejected

Parser gate align output: full
Runner ledger alignMode:   fail-closed
Fused question numbers:    2,3,4,5,6,7,8,9,10,13,15

Baseline generated:  no
Freeze/tag generated: no
```

### Problem has narrowed

The original problem was "large-scale PDF parsing instability" (Attempt 11/12 swing between answer and solution coverage). The current problem has been narrowed to:

```
answer 2 / 8 / 9 rejected by controlled-write at the objective answer normalization step.
```

This means:
- Parser and aligner prove sequence coverage (parserGate `full`) ✓
- Solution sequence is complete and safe ✓
- The failure is at `normalizeObjectiveAnswerToLabels` inside controlled-write
- Answer 2: `option-value-not-matched`
- Answers 8, 9: `multiple-option-value-rejected`

### P8A Key Findings

1. ParserGate `full` ≠ controlled-write `complete` (different layers)
2. Answer 2 appears in draft snapshot but is rejected by controlled-write (runner summary inconsistency)
3. Answer 8/9 raw shapes suggest non-label-payload structural candidates
4. Solution 12/12 does NOT unlock answer 8/9
5. Runner ledger `alignMode: fail-closed` derived from warnings, not parserGate (separate layer)
6. Fused question numbers 2-15 came from controlled-write union, not from parserGate

---

## 7. Attempt 12 Safety Invariant

### Observed shape

| Field | Result |
| --- | --- |
| Expected question numbers | `1,2,3,4,5,6,7,8,9,10,13,15` |
| Answer coverage | 12/12 |
| Solution coverage | Only safe for `1,2` (missing `3` causes sequence discontinuity) |
| Unsafe solution ownership | `3,4,5,6,7,8,9,10,13,15` |

### Fixture

`attempt12SequenceDiscontinuityFixture` in `tests/fixtures/pdf-real-case-minimal.js`

### Required safety assertions

- parserGate.mode ≠ "full" (must be "prefix")
- Solution write limited to `1,2`
- Fused question numbers = `3,4,5,6,7,8,9,10,13,15`
- Answer coverage remains complete from legacy-safe evidence
- Unsafe solutions NOT written
- Future code must NOT expand unsafe solution ownership for `3,4,5,6,7,8,9,10,13,15`

---

## 8. Known-Bad Safety Invariant

### What it protects against

The known-bad jump-back sequence `1,3,4,5,6,7,8,9,10,11,2` where question `2` appears out-of-order at the end. This pattern would cause later answers to be mis-attached if not caught.

### Fixture

`pdf-support-known-bad.js` (loaded in `tests/batch-smoke-mock.test.js`)

### Required behavior

- Jump-back detected (`2` after `11`)
- Mode is `prefix` or `fail-closed`, never `full`
- At most question `1` is safe
- Wrong answers for questions `3,4,5,6,7,8,9,10,11,12` are NOT written to draft
- Formula-like answer `sqrt2+1/2` for question 11 is NOT written

---

## 9. DOCX Stable Invariant

### Protection

- `verify:docx-stable` runs DOCX stable smoke
- `smoke:batch:mock` covers DOCX+DOCX mock chain
- DOCX stable fixture in `tests/fixtures/docx-docx-stable.js`

### Required behavior

- 3 questions with stem, options A-D, answer, solution all present
- No `pdf-support-sequence-unreliable` warnings leak into DOCX path
- No real AI/OCR calls in mock smoke
- DOCX tests must NOT be weakened by PDF support changes

---

## 10. app.js Boundary

### Current state (from P1.3 audit)

`app.js` is a high-risk legacy coordinator containing:
- Batch creation and orchestration
- PDF support fail-closed gate assembly
- AI/OCR proxy request construction
- Field warning propagation
- Draft write transactions
- Review page report computation

### Rules

- **Read freely**, but do NOT add new business logic
- New complex logic → `qisi-*.js` module
- Must declare `Why app.js must be touched` before editing
- Currently allowed only: small glue, imports, UI status updates
- Forbidden: new parser algorithms, new alignment logic, new OCR workflows

### Business logic that should move

- PDF support gate assembly → focused `qisi-pdf-support-*` module
- Field-level policy → stays in `qisi-pdf-support-controlled-write.js`
- Runner/report isolation → runner utilities

---

## 11. Real-Run Rules

### When real-run is allowed

Only in P8G (or equivalent explicitly authorized stage), with:
1. Clean working tree
2. All pre-tests passed
3. Runner preflight passed
4. Runner dry-run passed
5. `QISI_PDF_MASTER_REAL_RUN_ALLOWED=1` set
6. Each real-run recorded in ledger
7. Max 20 real-runs total, but NOT back-to-back blindly

### Stop conditions for real-run

- Same failure signature 2 consecutive times without intermediate fixture-first commit
- Suspected wrong attachment
- Must NOT retry immediately after failure

### Currently

P8-0 does NOT authorize real-run. Real-run is forbidden until P8F gate passes.

---

## 12. Test Matrix

### Current test commands

| Command | Scope | P8-0 Result |
| --- | --- | --- |
| `npm run check` | Syntax check all key JS files | ✓ Passed |
| `npm test` | Full test suite (114 tests) | ✓ Passed (114/114) |
| `npm run smoke:batch:mock` | Batch mock smoke (19 tests) | ✓ Passed (19/19) |
| `npm run verify:docx-stable` | DOCX stable chain | ✓ Passed |
| `npm run verify:pdf-known-bad` | PDF known-bad (62 tests) | ✓ Passed (62/62) |
| `npm run verify:batch-safety` | DOCX+PDF+batch safety | ✓ Passed |
| `npm run verify:no-real-ai` | No real AI/OCR guards | ✓ Passed |
| `npm run verify:safe` | check+test+smoke+no-real-ai | ✓ Passed |
| `npm run verify:diff-scope` | Diff scope against QISI_ALLOWED_DIFF | ✓ Passed (no changed files) |

### Tests that exist

| Test file | What it covers |
| --- | --- |
| `tests/pdf-real-case.test.js` | Parser gate, controlled write, field-level, Attempt 12, Answer 8/9 |
| `tests/pdf-support-block-parser.test.js` | Block parsing, markers, coverage, enhanced markers |
| `tests/pdf-support-aligner.test.js` | Sequence validation, full/prefix/fail-closed, boundaries |
| `tests/batch-smoke-mock.test.js` | All mock safety: DOCX, PDF known-bad, controlled write |
| `tests/pdf-master-browser-runner.test.js` | Runner parse, permission, ledger, diagnostics |

### Missing test file

```
tests/pdf-support-controlled-write-answer-ownership.test.js not found; P8B should add it.
```

---

## 13. Complete Baseline Acceptance Criteria

A run may be classified as **complete baseline candidate** ONLY when ALL of the following are simultaneously true:

| Criterion | P7 Status | Required |
| --- | --- | --- |
| answer coverage = expectedQuestionNumbers full set | ❌ 10/12 | Must be 12/12 |
| solution coverage = expectedQuestionNumbers full set | ✅ 12/12 | Must be 12/12 |
| missing answers = [] | ❌ [8,9] | Must be empty |
| missing solutions = [] | ✅ | Must be empty |
| parserGate mode = full | ✅ full | Must be full |
| runner ledger alignMode = full | ❌ fail-closed | Must be full |
| controlledWrite accepted answers = full set | ❌ missing 2,8,9 | Must be full |
| controlledWrite rejected answers = [] | ❌ [2,8,9] | Must be empty |
| controlledWrite rejected solutions = [] | ✅ | Must be empty |
| fusedQuestionNumbers = [] | ❌ non-empty | Must be empty |
| no safety warnings | ❌ parser-objective-answer-rejected | Must be none |
| verify:pdf-known-bad passed | ✅ | Must pass |
| verify:docx-stable passed | ✅ | Must pass |
| runner report current run only | ✅ | Must be current |
| no stale artifact | ✅ | Must be clean |
| no semantic guessing | ✅ | Must be none |
| app.js untouched | ✅ | Must be untouched |
| fail-closed not weakened | ✅ | Must be preserved |

**P7 does NOT qualify as complete baseline candidate.**

---

## 14. pass-safe-partial / fail-closed / failed Criteria

### pass-safe-partial

Any of these is true, AND no wrong attachment:
- answer coverage incomplete
- solution coverage incomplete
- missing answers non-empty
- missing solutions non-empty
- fusedQuestionNumbers non-empty
- controlled-write rejected answers non-empty
- parserGate full but controlled-write not complete
- runner ledger prefix / fail-closed

After pass-safe-partial: **no baseline, no freeze, no tag, must return to fixture-first.**

### fail-closed

No shared safe prefix can be proven:
- Empty answer and solution sequences
- First question mismatch with expected
- Answer/solution set mismatch at position 1
- All items fused

### failed / suspicious wrong attach

Any of:
- Answer attached to wrong question number
- Solution attached to wrong question number
- known-bad wrong answer written
- DOCX stable broken
- Semantic guessing used
- Special question fallback added
- fail-closed weakened
- Old runId artifact counted as current success

---

## 15. Next Stage P8B Plan

### P8B Objective

```
固化物化 P7 中 answer 2/8/9 被 controlled-write rejected 的问题
为脱敏 fixture 和测试。
```

### P8B is NOT

- NOT fixing controlled-write code
- NOT fixing normalization
- NOT real-run
- NOT baseline
- NOT freeze

### P8B Allowed to modify

```
tests/fixtures/pdf-real-case-minimal.js      (add p7AnswerRejectionFixture)
tests/pdf-real-case.test.js                   (add test)
tests/batch-smoke-mock.test.js                (add mock smoke)
tests/pdf-support-aligner.test.js             (add assertions)
tests/pdf-support-controlled-write-answer-ownership.test.js  (NEW FILE)
docs/testing/PDF_SUPPORT_P8B_ANSWER_REJECTION_FIXTURE.md    (NEW FILE)
```

### P8B Forbidden to modify

```
qisi-*.js
scripts/
app.js
main.html
app.css
package.json
package-lock.json
AGENTS.md
ai/
skills/
```

### P8B Fixture Requirements

New fixture `p7AnswerRejectionFixture` must express:
1. answer 8/9 rejected by controlled-write
2. answer 2 has runner snapshot safe vs controlled-write rejected inconsistency
3. solution 12/12 does NOT unlock answer 8/9
4. parserGate full ≠ controlled-write complete
5. fusedQuestionNumbers non-empty → no complete baseline
6. parser-objective-answer-rejected preserved as warning, not silently swallowed

### P8B Test Assertions

1. rejected answer 8/9 not written to draft
2. rejected answer 2 reason is diagnosable
3. solution complete does not unlock answer ownership
4. parserGate full ≠ controlled-write complete
5. P7 pass-safe-partial not treated as complete
6. known-bad still blocks unsafe wrong answers
7. Attempt 12 unsafe ownership not expanded

### P8B Required Tests

```
node --test tests/pdf-support-controlled-write-answer-ownership.test.js
npm test -- tests/pdf-real-case.test.js
npm test -- tests/pdf-support-aligner.test.js
npm test -- tests/pdf-support-block-parser.test.js
npm run smoke:batch:mock
npm run verify:safe
npm run verify:pdf-known-bad
npm run verify:batch-safety
npm run verify:diff-scope
```

---

## 16. Stop Conditions

P8-0 must stop immediately if:
- [ ] `git status --short` is not empty → **PASSED (clean)**
- [ ] `git pull --ff-only` fails → **PASSED (up to date)**
- [ ] Required tests fail → **PASSED (all green)**
- [ ] Any forbidden file was modified → **PASSED (nothing modified)**
- [ ] Real AI/OCR/API was called → **PASSED (not called)**
- [ ] Real-run was attempted → **PASSED (not attempted)**

---

## 17. Open Questions / Missing Files

### Missing files

| File | Status |
| --- | --- |
| `tests/pdf-support-controlled-write-answer-ownership.test.js` | **Not found** — P8B should add it |

### Open questions for P8B-P8F

1. What structural evidence exists for answer 8/9 beyond the `}A_\A{A}` sanitized shape?
2. Is answer 2 truly `option-value-not-matched` or is there a structural candidate path?
3. Why does runner draft snapshot include answer 2 but controlled-write rejects it? (P8D will resolve)
4. Why are fusedQuestionNumbers 2-15 when parserGate fused is empty? (P8D will clarify)
5. Can answer 8/9 rejection be reproduced with only sanitized fixture data?

### Files intentionally NOT read

- `ai/CODEX_TASK.local.md` — local-only task file, not required for P8-0 comprehension
- `local-test-materials/` — local real test materials, forbidden from default reading
- `app.js` — high-risk legacy coordinator; P1.3 audit was sufficient for this stage

---

## P8-0 Acceptance Checklist

```
[x] 只新增 docs/testing/P8_0_REPOSITORY_ONBOARDING_REPORT.md
[x] 未修改 qisi-*.js
[x] 未修改 tests
[x] 未修改 scripts
[x] 未修改 app.js
[x] 未修改 main.html
[x] 未修改 package 文件
[x] 未调用 AI/OCR/API
[x] 未 real-run
[x] 已列出所有阅读过的文件
[x] 已准确复述 P7 结果
[x] 已解释 parserGate full 与 runner fail-closed 不等于 complete
[x] 已解释 answer 2/8/9 rejection 是下一步核心
[x] 已说明为什么 P8B 必须 fixture-first
[x] 已列出 P8B 允许/禁止修改范围
[x] 已列出 complete baseline 验收条件
[x] 已列出 pass-safe-partial / fail-closed / failed 标准
[x] verify:safe passed (114 tests)
[x] verify:batch-safety passed
[x] verify:diff-scope passed
```

---

## P8-0 Completion

P8-0 is complete. All required reading is finished, all comprehension requirements are documented, all tests pass, and no files were modified. Ready to proceed to **P8B: fixture-first reproduction of P7 answer 2/8/9 rejection**.
