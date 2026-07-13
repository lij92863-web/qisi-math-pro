# OCR Quality R1 CTO Review

```text
OCR_QUALITY_R1_ACCEPTED_WITH_LIMITATIONS
```

The accepted result is the safety-preserving, reproducible OCR evaluation and
candidate infrastructure. It is not an acceptance of real OCR accuracy gains or
of any new production engine.

## Executive boundaries

- Eligible private documents: 0.
- Real Holdout runs: 0.
- Real OCR/API calls: 0.
- Model downloads: 0.
- Production-promoted engines: none.
- Shadow engines measured: none.
- Human efficiency improvement: not measured.
- Manual review required: yes.
- Production behavior: unchanged.

## Engine disposition

| Engine | CTO disposition | Evidence status |
| --- | --- | --- |
| qwen-vl-plus | existing legacy-unpinned configuration; not promoted or changed by Program B | not called and not measured |
| PaddleOCR / PP-OCR | research-only | no weights installed; not measured |
| PaddleOCR-VL | research-only | no weights installed; not measured |
| olmOCR | research-only | no weights installed; Windows feasibility unproven |
| local-ocr unavailable engine | research/shadow boundary only | service contract unit-tested; recognition not run |
| mock | research-only synthetic fixture | runner, scorer, and safety tests only |

No engine continues as a measured Shadow candidate because no private benchmark
was authorized or available. The no-write Shadow Mode scaffold remains available
for a future separately authorized evaluation; this is not a production or
benchmark-measured status.

## Code audit

The ten-area code audit accepted the Program B boundaries with limitations. It
also fixed purpose/split enforcement and complete result-document accounting in
the offline runner. Adapter response size, strict number parsing, and image magic
validation are code-enforced. The current app engine configuration remains legacy
and unpinned; Program B did not silently redefine it.

## Architecture audit

Adapters remain transport/format owners and cannot own answers, solutions,
controlled-write, FormalAdmission, or persistence. Reading order, structure
extraction, selection, promotion, Shadow reporting, and canary decisions each have
bounded owners. Promotion registry is empty, canary is disabled, preprocessing is
disabled, and the new engine candidates are not production-wired.

## Counterfactual attacks

All 22 named synthetic attacks and aggregate invariants passed after three bounded
boundary repairs. The synthetic suite introduced zero wrong attachments,
fabricated formal questions, controlled-write/FormalAdmission bypasses, or enabled
canaries. This proves fail-closed boundary behavior on fixtures; it does not
establish a result for an untouched private Holdout.

## Final benchmark

Corpus size was 0 and the real-benchmark and model-download authority flags were
absent. Per-document, category, CER, formula, structure, ownership, paired
confidence interval, latency, and human-correction metrics therefore remain not
measured. API cost was CNY 0. The final benchmark decision was
`NO_ENGINE_ELIGIBLE_FOR_PROMOTION`.

Real quality improvement was not measured. No 15% correction-time reduction,
quality significance, fatal-safety rate, or cost/latency eligibility is inferred
from unit tests or synthetic data.

## Manual review and deployment burden

PDF remains safe partial plus required manual review. Candidate conflicts remain
manual and cannot be resolved by field merging or semantic guessing. Controlled-
write and FormalAdmission remain mandatory.

- Installed model burden: none.
- Current local runtime burden: loopback service/scripts only; no service was
  started and no model was installed.
- Future local deployment burden: model packaging, runtime/device validation,
  updates, diagnostics, storage, and target-machine performance proof before any
  local engine could become eligible.

## Rollback

Program A seal `v1.1.0-rc2-post-r2-correction` is the immutable rollback point for
all Program B work. No production OCR behavior changed, so disabling or removing
the unpromoted Program B research/shadow infrastructure requires no data migration.
The work branch remains the only location until Phase 8 verifies live remote main,
performs an ff-only merge, and creates the Program B release tag.

The CTO decision is accepted with limitations because the implementation,
counterfactual safety, audits, and benchmark honesty satisfy the engineering
closure gates while the evidence required for any real-quality or production-
promotion claim is absent.
