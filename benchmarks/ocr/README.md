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

## OCR Quality R1 runner

The R1 runner scores pre-generated document results. It does not invoke an OCR
adapter, download a model, read a source PDF/image, or make a network request:

```text
node scripts/benchmark/run-ocr-benchmark.js <config.json>
```

The JSON config must explicitly pin:

- `benchmarkId`, `corpusVersion`, and `scorerVersion: ocr-scoring-r1`
- fixed `runPurpose` and matching `evaluationSplit` (`calibration`,
  `development`, or `final-holdout` + `holdout`)
- engine `name` and immutable `version` (not `latest`, `current`, or `unknown`)
- hardware `profileId`, OS, CPU, GPU and memory
- timeout, integer random seed, and bootstrap iteration count
- JSON truth/result paths and separate JSON/Markdown output paths
- input kind: `synthetic` or `private`

Private JSON is accepted only under
`local-test-materials/ocr-quality-r1/` and only when
`QISI_ALLOW_REAL_OCR_BENCH=1`. The source documents themselves are never runner
inputs. Synthetic input cannot point into the private directory.

The JSON and Markdown reports are generated from the same deterministic score
object. They contain config metadata, hashes, aggregate metrics, sanitized
per-document metrics, status and failure code. They exclude full truth, recognized
text, raw responses, source paths and failure messages. Timeout, missing and other
failed documents remain explicit and make `promotionEligible=false`.
Every truth document must declare the configured split. A mismatch aborts before
report writing, duplicate document ids are rejected, and unexpected result
documents are reported as failures instead of being silently ignored.
