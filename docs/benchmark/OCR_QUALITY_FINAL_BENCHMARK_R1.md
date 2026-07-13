# OCR Quality R1 Final Benchmark

## Final decision

```text
NO_ENGINE_ELIGIBLE_FOR_PROMOTION
```

This is a benchmark availability and safety-evidence report, not a claim of OCR
quality improvement.

## Authority and corpus

- Corpus size: 0 eligible private documents.
- `QISI_ALLOW_REAL_OCR_BENCH=1`: absent.
- `QISI_ALLOW_MODEL_DOWNLOAD=1`: absent.
- Real OCR/API calls: 0.
- Model downloads: 0.
- Real Holdout runs: 0.
- Production-promoted engines: none.
- Shadow engines measured on private corpus: none.

The private directory `local-test-materials/ocr-quality-r1/` does not exist. The
minimum production-promotion rule requires at least 10 eligible documents, and the
quality gate additionally requires an untouched Holdout. Neither prerequisite is
present, so no real engine execution was legal or possible in this phase.

## Per-document results

No eligible documents. There are no document rows, source hashes, page metrics,
correction sessions, or per-document costs to report.

## Per-category results

| Category | Eligible documents | Result |
| --- | ---: | --- |
| clear electronic PDF | 0 | not measured |
| scanned PDF | 0 | not measured |
| skewed | 0 | not measured |
| low resolution | 0 | not measured |
| formula-dense | 0 | not measured |
| geometry diagram | 0 | not measured |
| double-column | 0 | not measured |
| watermark/annotation | 0 | not measured |
| long answer/solution | 0 | not measured |
| known-bad | 0 | not measured |
| DOCX-converted image | 0 | not measured |
| non-contiguous numbering | 0 | not measured |
| multiple choice | 0 | not measured |
| true/false | 0 | not measured |
| fill-in-the-blank | 0 | not measured |

## Aggregate quality

- raw CER: not measured.
- normalized CER: not measured.
- formula token F1: not measured.
- formula exact match: not measured.
- question precision/recall: not measured.
- question-number accuracy: not measured.
- stem/option/answer/solution/image accuracy: not measured.
- ownership accuracy: not measured.
- 95% bootstrap CI: not calculated.
- mean/median/p95: not calculated.

No aggregate, category, or candidate-versus-baseline improvement distribution is
reported. Producing a numeric value from synthetic fixtures would misrepresent the
plan's real-quality objective.

## Fatal safety metrics

Real Holdout safety remains unavailable:

- wrong answer attachment: not measured on real Holdout.
- wrong solution attachment: not measured on real Holdout.
- fabricated question: not measured on real Holdout.
- raw JSON leakage: not measured on real Holdout.
- placeholder leakage: not measured on real Holdout.
- unsafe sequence accepted: not measured on real Holdout.
- ownership mismatch accepted: not measured on real Holdout.
- controlled-write bypass: not measured on real Holdout.
- FormalAdmission bypass: not measured on real Holdout.

Synthetic attack evidence introduced 0 wrong attachments, fabricated formal
questions, controlled-write/FormalAdmission bypasses, or enabled canaries across
the 22-class Phase 3 suite. This is synthetic gate evidence only and establishes no
result for the real Holdout.
No production safety PASS is claimed.

## Human correction cost

- corrected questions/fields: not measured.
- manual correction time: not measured.
- re-recognition count: not measured.
- manual review rate: not measured.
- human efficiency improvement: not measured.

The required 15% correction-time reduction cannot be evaluated. No estimate is
derived from CER, source-code tests, or synthetic fixtures.

## Cost and hardware

- API cost: CNY 0 (zero real calls).
- Test OS: Microsoft Windows 10 Pro (reported locally as Windows 10 专业版).
- Test CPU: 12th Gen Intel(R) Core(TM) i5-12400F.
- Test memory: 17032749056 bytes.
- Test GPU: NVIDIA GeForce RTX 4060.
- Runtime: Node v24.16.0.

This hardware ran unit/integration/browser safety tests only. It did not run a local
OCR model, so no OCR latency, VRAM, throughput or energy conclusion is available.

## Engine status and deployment complexity

| Engine | Version/status | Measurement | Deployment complexity |
| --- | --- | --- | --- |
| qwen-vl-plus | legacy-unpinned current configuration | not called; not measured | existing cloud transport requires credentials, region/privacy/cost control |
| PaddleOCR / PP-OCR | research-only; no weights | not installed; not measured | local runtime/model packaging and target-machine proof required |
| PaddleOCR-VL | research-only; no weights | not installed; not measured | larger local pipeline/device validation required |
| olmOCR | research-only; no weights | not installed; not measured | official path is Linux/GPU heavy; Windows feasibility unproven |
| local-ocr | unavailable default engine | service boundary unit-tested; recognition not run | one-click scripts exist; an authorized model plugin is still absent |
| mock/synthetic | unit-tested deterministic fixtures | scorer/runner/attacks only | no external dependency; cannot represent real OCR quality |

## Production gate evaluation

The fatal-safety gate is not evaluated on real Holdout data. Structural
non-regression, significant weak-point improvement, paired 95% CI, correction-time
reduction, latency/cost acceptability, and rollback under a real engine are also not
evaluated. Therefore:

- production engine additions: none
- production engine replacements: none
- production canary: disabled
- preprocessing: disabled
- current production behavior: unchanged
- allowed continuation: research/shadow infrastructure only

## Reproducibility evidence available

The R1 offline runner/scorer is unit-tested for pinned purpose/split,
engine/version, hardware, timeouts, seed, document-level bootstrap, complete
document accounting, JSON/Markdown determinism and privacy. The 22-class synthetic
attack matrix is reproducible. These prove harness behavior, not real OCR accuracy.

The next valid real benchmark requires explicit authority plus an annotated,
leakage-controlled private corpus. Until then the only honest decision is
`NO_ENGINE_ELIGIBLE_FOR_PROMOTION`.
