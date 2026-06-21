# PDF Master Current Decision

## Status

As of commit `ba078f2` (P10K-B), the double-PDF pipeline has reached a stable decision point.

## What Works

| Pipeline Layer | Status |
| --- | --- |
| Block parser | ✅ 12/12 support blocks detected |
| Sequence validator | ✅ Full mode |
| Aligner | ✅ Full mode |
| Controlled-write | ✅ Only safe answers written |
| Runner diagnostics | ✅ Per-layer reporting |
| Q2 safe wrapper | ✅ Accepted (P10I-Q2) |
| DOCX stable | ✅ Protected |
| known-bad | ✅ Blocked |
| Attempt 12 | ✅ Limited |

## Current Coverage

| Metric | Value |
| --- | --- |
| Answer auto-coverage | 9-10/12 |
| Solution auto-coverage | 12/12 |
| Missing answers | 2-3 (typically 8, 9) |
| Wrong answers | 0 (by design) |
| Result | pass-safe-partial |

## Product Strategy

**safe partial + manual review.**

- Write only when controlled-write confirms safety
- Leave uncertain answers empty
- Q8/Q9 type dirty structural shells → teacher fills in review page
- Do NOT force 12/12 completion
- Do NOT add AI passes to compensate for OCR quality gaps
- Do NOT relax fail-closed rules

## Parked / Frozen

| Item | Status |
| --- | --- |
| Route A (text post-processing) | Insufficient (P10K-VERIFY) |
| Route B (answer-only AI pass) | Research-only (P10L-HOLD) |
| P10L controlled-write enrichment | Frozen |
| Complete baseline target | Superseded by safe partial |

## Principles (Unchanged)

- 宁可空，不能错挂
- controlled-write = 唯一 truth gate
- No semantic guessing
- No special question fallback
- DOCX stable chain must not regress
