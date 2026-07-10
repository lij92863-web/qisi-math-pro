# Benchmark Specification R2

## Reproducibility record

Each run records commit, corpus version/hash, truth version, normalization version, scoring script hash, engine/version/config, mock/real status, OS, Node/browser version, CPU/memory note, timestamps, and duration. Private source files remain outside Git.

## Text and formula metrics

- raw CER = Levenshtein(reference,prediction) / max(reference length,1);
- normalized CER after NFC, configured whitespace, and full/half-width normalization;
- exact line match;
- LaTeX command/brace/operator/identifier/number token precision, recall, F1;
- formula exact match.

Normalization never erases mathematical distinctions.

## Structure metrics

Question detection precision/recall, question-number accuracy, stem completeness, option completeness, answer/solution extraction accuracy, and image attachment accuracy. Matching uses only questionNumber plus sourceOrder; semantic similarity is forbidden.

## Safety counters

Report independently: wrong answer attachment, wrong solution attachment, fabricated question, raw JSON leakage, placeholder leakage, unsafe sequence accepted, answer/solution mismatch accepted, and controlled-write bypass. Any wrong attachment is fatal.

## Manual cost

Per document: questions corrected, fields corrected, correction minutes, re-recognition attempts, and manual-review rate.

## Performance

Cold start, upload-to-review, first review render, switch p50/p95, save, reload, export, peak memory, and image payload. Warmup, sample count, dataset size, and timer source are fixed.

## Corpus

Ten categories: clear DOCX, electronic PDF, scanned PDF, skew, low resolution, formula-heavy, geometry image, long solution, discontinuous numbering, known-bad. Synthetic fixtures are labeled synthetic. Missing real categories are reported, never fabricated.

## Acceptance

No core regression above 10%; at least one proven bottleneck improves 20% for performance changes. OCR promotion follows the adapter promotion gate. Baseline and final use identical inputs/config/scoring.
