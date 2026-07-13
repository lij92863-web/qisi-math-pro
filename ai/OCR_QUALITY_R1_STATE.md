# OCR QUALITY R1 — State

- Start commit: `1361d7e7f81d2f23819a995a0f9d1808adf19982`
- Baseline tag: `pre-ocr-quality-r1-1361d7e`
- Current branch: `stage/ocr-quality-r1`
- Current phase: Program B / Phase 1 complete
- Status updated: 2026-07-13 Asia/Shanghai

## Entry conditions

- Program A decision: `POST_R2_CORRECTION_ACCEPTED_WITH_LIMITATIONS`.
- Formal Admission: production-wired.
- True deterministic E2E: passed.
- Controlled-write: unchanged and mandatory.
- Route B: frozen research-only.
- Program A main/tag: sealed at the start commit.
- Starting working tree: clean; local main, origin/main, and live main equal.

## Real benchmark authority

- `QISI_ALLOW_REAL_OCR_BENCH=1`: not present.
- `QISI_ALLOW_MODEL_DOWNLOAD=1`: not present.
- Real OCR/API calls: forbidden until the first flag is explicitly present.
- Model downloads: forbidden until the second flag is explicitly present.
- Private corpus directory `local-test-materials/ocr-quality-r1/`: absent.
- Eligible private documents: 0; production promotion is forbidden below 10.

## Completed

- Created and pushed annotated baseline tag `pre-ocr-quality-r1-1361d7e`.
- Created and pushed `stage/ocr-quality-r1` from the verified Program A seal.
- Phase 0 baseline completed with all 11 mandatory gates passing.
- Phase 1 defined the ten-layer OCR failure taxonomy and fail-closed evidence
  boundary.
- Phase 1 defined the private corpus split protocol, document-level leakage guard,
  double-review process, and the fewer-than-10 no-promotion rule.
- Added the R1 document/question ground-truth schema with annotator A, verifier B,
  and disagreement-resolution evidence.
- Audited five candidate classes from official sources. All remain research-only
  and unevaluated; no model was downloaded and no engine was promoted.
- Defined deterministic CER, formula, structure, safety, human-cost, and
  document-level stratified-bootstrap scoring.
- Phase 1 targeted tests passed 9/9; all 11 mandatory gates passed with browser
  preflight/dry-run `realApiCalled=false`.

## Pending

- Phase 2 work packages B2-1 through B2-10, subject to their evidence gates.
- Phases 3–8 attacks, audits, final benchmark, CTO review, and seal.

## Blockers / limitations

- Real quality improvement cannot be measured until an approved private corpus
  exists and `QISI_ALLOW_REAL_OCR_BENCH=1` is explicitly set.
- Work may continue on reproducible synthetic/research/shadow infrastructure;
  no engine may be production-promoted from that evidence.

## Next exact action

Commit and push the Phase 1 architect package, then start B2-1 with a failing test
for the reproducible Benchmark Runner. Keep real engines and private documents
disabled while `QISI_ALLOW_REAL_OCR_BENCH=1` is absent.
