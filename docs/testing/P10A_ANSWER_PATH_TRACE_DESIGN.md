# P10A Answer Path Trace Design and Existing Evidence Audit

## Stage

P10A — define per-question answer trace schema, audit existing evidence, determine diagnostic gap

## Trace Schema

Each question in the expected set must be traceable through the pipeline:

```json
{
  "question": "<number>",
  "expected": true,
  "ocrRawObserved": true | false,
  "ocrRawShape": "label-only | label-shell | non-label-payload | mixed-solution | missing | unknown",
  "parserObserved": true | false,
  "parserAnswerShape": "<sanitized excerpt>",
  "alignerObserved": true | false,
  "alignerSafe": true | false,
  "controlledWriteAccepted": true | false,
  "controlledWriteRejected": true | false,
  "rejectionCode": "<code>",
  "rejectionDetail": "<detail>",
  "draftSnapshotPresent": true | false,
  "baselineCandidatePresent": true | false,
  "dropStage": "ocr-ai | parser | aligner | controlled-write | runner-summary | draft-only | unknown",
  "truthSource": "controlled-write"
}
```

### dropStage definitions

| dropStage | Meaning |
| --- | --- |
| `ocr-ai` | OCR/AI did not produce recognizable answer content for this question |
| `parser` | OCR produced content, but block parser did not emit an answer item |
| `aligner` | Parser emitted item, but aligner fused/excluded it |
| `controlled-write` | Aligner passed item, but controlled-write rejected the answer value |
| `runner-summary` | Controlled-write accepted, but runner/draft didn't include it |
| `draft-only` | Draft has answer from non-controlled-write path (repair/legacy), but controlled-write rejected |
| `unknown` | Insufficient evidence to determine |

## Existing Evidence Audit

### What the sanitized fixtures provide

| Evidence Layer | Available in Fixtures? | Detail |
| --- | --- | --- |
| OCR raw text pages | PARTIAL | `p8gAttempt1FailureSignatureFixture` provides `rawTextPages` — these are sanitized structural page texts, NOT the raw OCR output. They model what the parser sees AFTER block extraction. |
| Parser block items | YES | 12 blocks, 12 answer items, 12 solution items |
| Aligner output | YES | mode: full, safeQuestionNumbers: all 12 |
| Controlled-write decision | YES | accepted: [1,7,10,13,15], rejected: [2,3,4,5,6,8,9] |
| Controlled-write rejection taxonomy | YES | rejectionCode, rejectionDetail, normalizedCandidate, answerEvidence |
| Draft snapshot | YES (modeled) | 10/12 answers, missing 8,9 |
| Baseline candidate | YES | 5/12 |

### What the P8G real-run ledger provides

| Evidence Layer | Available in Ledger? | Detail |
| --- | --- | --- |
| Per-question OCR raw shape | **NO** | Ledger records aggregate counts only |
| Per-question parser answer text | **NO** | Ledger records aggregate counts only |
| Per-question controlled-write rejection detail | PARTIAL | `controlledWriteSummary` records rejectedAnswerWarnings with questionNumber and reason, but the originalAnswer field is sanitized |
| Per-question dropStage | **NO** | Never computed |

### Can existing evidence locate 8/9 dropStage?

**NO — not definitively.**

What we know:
- Parser observed 12/12 blocks → parser layer did NOT drop 8/9
- Aligner mode was full → aligner did NOT fuse 8/9
- Controlled-write rejected 8/9 with `multiple-option-value-rejected`, structural candidate `non-label-payload`
- Draft snapshot missing 8/9

What we DON'T know:
- The exact raw OCR text that produced the answer items for 8/9
- Whether the OCR originally had clean labels that parser processing corrupted
- Whether the structural shell `}_\A{...}` pattern came from OCR or from intermediate formatting

The `non-label-payload` verdict means the answer content after compaction contained non-A-F characters. But we don't know if:
- OCR produced `}_\A{G}` (G outside A-F) → OCR quality gap
- OCR produced `}_\A{A}` but compaction was corrupted → parser/processing issue
- OCR produced mixed answer+solution text → extraction quality gap

## Per-Question Trace (Best Current Assessment)

### Questions 1, 7, 10, 13, 15 — Accepted

| Field | Q1 | Q7 | Q10 | Q13 | Q15 |
| --- | --- | --- | --- | --- | --- |
| ocrRawObserved | unknown | unknown | unknown | unknown | unknown |
| parserObserved | true | true | true | true | true |
| alignerSafe | true | true | true | true | true |
| controlledWriteAccepted | true | true | true | true | true |
| dropStage | N/A | N/A | N/A | N/A | N/A |

### Questions 2-6 — Rejected by controlled-write, draft has them from repair

| Field | Q2 | Q3 | Q4 | Q5 | Q6 |
| --- | --- | --- | --- | --- | --- |
| ocrRawObserved | unknown | unknown | unknown | unknown | unknown |
| parserObserved | true | true | true | true | true |
| alignerSafe | true | true | true | true | true |
| controlledWriteAccepted | false | false | false | false | false |
| controlledWriteRejected | true | true | true | true | true |
| rejectionCode | rejection-option-value-not-matched | same | same | same | same |
| draftSnapshotPresent | true | true | true | true | true |
| baselineCandidatePresent | false | false | false | false | false |
| dropStage | **controlled-write** | same | same | same | same |

### Questions 8-9 — Rejected by controlled-write, draft missing

| Field | Q8 | Q9 |
| --- | --- | --- |
| ocrRawObserved | **UNKNOWN** | **UNKNOWN** |
| ocrRawShape | **unknown** | **unknown** |
| parserObserved | true | true |
| alignerSafe | true | true |
| controlledWriteAccepted | false | false |
| controlledWriteRejected | true | true |
| rejectionCode | rejection-multi-option-value-rejected | same |
| structuralCandidate | true | true |
| structuralReason | non-label-payload | non-label-payload |
| draftSnapshotPresent | false | false |
| baselineCandidatePresent | false | false |
| dropStage | **pre-controlled-write evidence insufficient** | same |

## Critical Gap

The `dropStage` for 8/9 is currently `unknown` because:

1. The sanitized fixtures start at the `rawTextPages` level (post-OCR, pre-block-parser)
2. The P8G ledger records controlled-write outcomes but not raw OCR answer text
3. The runner's browser diagnostic instrumentation captures parser and controlled-write data, but does NOT capture per-question raw OCR answer text before block parsing

Without raw OCR answer evidence, we cannot distinguish:
- "OCR produced non-label-payload content" (OCR quality gap → eligible for improvement)
- "OCR produced clean labels but processing corrupted them" (parser/processing issue → different fix)
- "OCR didn't produce answer content at all" (OCR extraction gap → different fix)

## Answers to Required Questions

### 1. Can existing fixtures reproduce OCR/AI raw output?

**NO.** Existing fixtures start at `rawTextPages` — sanitized structural page text. They do not contain the original OCR API response with per-line answer evidence.

### 2. Can existing docs/ledger reproduce P8G real-run raw answer evidence?

**NO.** The P8G ledger records aggregate statistics and sanitized rejection warnings. It does not contain the original OCR output text for each answer.

### 3. Can 8/9 dropStage be determined without real-run?

**NO.** The evidence gap is at the OCR/AI → parser boundary. We know:
- Parser produces blocks for 8/9 ✓
- Controlled-write rejects them ✓
- But we don't know what the OCR originally produced

### 4. What diagnostic is needed?

A per-question capture of the raw OCR answer text BEFORE block parsing. This means instrumenting the runner to capture, for each expected question number, the raw answer-related text from the OCR output pages.

### 5. Is P10B needed?

**YES.** P10B should build trace fixtures and tests using the existing data. The fixtures should explicitly document what IS known and what IS unknown, with `ocrRawObserved: false` and `ocrRawShape: "unknown"` where evidence is missing.

### 6. Is P10C needed?

**YES — `needsDiagnosticRealRun: true`.**

A single controlled diagnostic real-run is needed to capture per-question raw OCR answer evidence. This is the minimum additional evidence required to determine `dropStage` for answers 8 and 9.

## Decision

```
needsDiagnosticRealRun: true
dropStage for 8/9: unknown (pre-controlled-write evidence insufficient)
Next: P10B (trace fixtures) → P10C (diagnostic real-run) → P10D (causality decision)
```
