# Recognition Quality Decision R2

## Decision

No production recognition-quality change is authorized in WP2M.

The R2 harness and ten-category synthetic corpus prove that scoring is
deterministic, not that any OCR engine or preprocessing change improves real
documents. `QISI_ALLOW_REAL_OCR_BENCH` was not enabled, no real OCR/API was
called, and no private benchmark corpus was committed. Treating synthetic
scores as real quality evidence would violate the benchmark and no-fabrication
rules.

## Preserved invariants

- DOCX+DOCX remains the stable main chain.
- PDF remains safe-partial/manual-review.
- wrong answer attachment must remain zero.
- Route B remains research-only.
- controlled-write remains the only formal-write truth gate.
- no semantic question-number or answer ownership guesses are introduced.
- frozen PDF owners remain unchanged.

## Deferred evidence-driven candidates

Rotation/perspective/deskew, contrast/threshold/denoise, multi-column reading
order, option evidence boxes, and provenance enrichment require the same
authorized corpus/config/hardware baseline and counterfactual failures before a
production work package may be opened. Every preprocessing transform must be
toggleable, preserve the original, and record its matrix and metadata.

## Reproduction

Run `node --test tests/ocr-benchmark-scoring.test.js`, then the mandatory safety
matrix. Real benchmark execution remains disabled unless the explicit R2
authorization conditions are satisfied.
