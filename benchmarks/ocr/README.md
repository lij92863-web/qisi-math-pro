# OCR Benchmark R2

This harness scores recognition candidates without calling an OCR engine. Private
source files and private truth stay under ignored
`local-test-materials/ocr-benchmark/`; only schemas, synthetic fixtures, scripts,
and sanitized aggregate results may be committed.

## Reproducible inputs

Each run records corpus version, source hashes, truth version, engine/version,
configuration, hardware, operating system, Node version, and start/end time.
Structure matching uses only `(questionNumber, sourceOrder)`. Semantic matching is
forbidden.

The public synthetic corpus declares ten categories: clear DOCX, electronic PDF,
scanned PDF, skew, low resolution, formula-heavy, geometry image, long solution,
non-contiguous numbering, and known-bad. These fixtures exercise scoring; they are
not represented as real OCR quality evidence. Real corpus availability remains a
reported gap until separately authorized materials exist.

## Metrics

- Unicode NFC and full/half-width normalized text
- raw and normalized character error rate (CER)
- LaTeX token precision/recall/F1 and formula exact rate
- question detection precision/recall/F1
- option completeness
- wrong answer/solution attachment and fabricated-question counts
- approximate manual correction character edits

Run: `node scripts/benchmark/score-ocr-result.js truth.json result.json`.
No engine execution, network request, or real API call occurs.
