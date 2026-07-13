# OCR QUALITY R1 — State

- Start commit: `1361d7e7f81d2f23819a995a0f9d1808adf19982`
- Baseline tag: `pre-ocr-quality-r1-1361d7e`
- Current branch: `stage/ocr-quality-r1`
- Current phase: Program B / Phase 0
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

## Pending

- Phase 1 failure taxonomy, corpus protocol, ground-truth schema, engine
  feasibility, and scoring protocol.
- Phases 2–8 implementation, attacks, audits, benchmark, CTO review, and seal.

## Blockers / limitations

- Real quality improvement cannot be measured until an approved private corpus
  exists and `QISI_ALLOW_REAL_OCR_BENCH=1` is explicitly set.
- Work may continue on reproducible synthetic/research/shadow infrastructure;
  no engine may be production-promoted from that evidence.

## Next exact action

Run Program B Phase 0 baseline gates, commit/push this state, then begin Phase 1
architect documents.
