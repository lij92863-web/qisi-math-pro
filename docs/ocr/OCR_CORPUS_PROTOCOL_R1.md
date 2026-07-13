# OCR Quality R1 Corpus Protocol

## Private-data boundary

All real documents, page images, ground truth and reviewer notes live under:

```text
local-test-materials/ocr-quality-r1/
```

The repository ignores `local-test-materials/` in full. Private source material,
private ground truth, raw engine output and page-level excerpts must never enter
Git, ordinary test fixtures, reports or logs. Committable results are restricted to
schemas, synthetic fixtures and sanitized aggregates without full private text.

## Admission and size

- Recommended corpus: at least 20 eligible documents.
- 少于 10 份不得 production-promote; results are research/shadow only.
- Current eligible corpus: 0 documents. No real quality conclusion or production
  promotion is permitted.
- A document is eligible only after source hash, consent/authority, document type,
  page count, quality tags and annotation status are recorded privately.

## Split policy

The three immutable roles are:

1. **Calibration set**: scorer and annotation-protocol calibration only.
2. **Development set**: bounded implementation and parameter decisions.
3. **Holdout set**: one-way final evaluation and promotion decision only.

按文档划分，禁止同一试卷页面跨集合泄漏。All pages and derived images from one
source document inherit the same split. Near-duplicates, converted variants and
answer/solution companions are grouped with the originating document before the
split. A source hash or group id may appear in exactly one split. Holdout labels
must not be inspected while tuning an engine, preprocessing or selection policy.

Split membership is fixed before Development work and versioned in a private
manifest. A split change invalidates prior final results and requires a new corpus
version and rerun.

## Coverage matrix

The corpus should cover, with tags that may overlap:

- clear electronic PDF
- scanned PDF
- skewed pages
- low resolution
- formula-dense pages
- geometry diagrams
- double-column layout
- watermark or annotation
- long answer/solution
- known-bad safety cases
- DOCX-converted image
- non-contiguous numbering
- multiple choice
- true/false
- fill-in-the-blank

Per-category counts are reported. A category with fewer than three documents is
descriptive only and cannot support a category-level promotion claim.

## Annotation workflow

Annotator A creates the structured truth from the source. Verifier B independently
checks every required field against the source. Disagreements are recorded and
resolved by an identified resolver; neither original judgment is silently erased.
The final record validates against `ground-truth-r1.schema.json`.

Question identity is deterministic:
`documentId + page + sourceOrder + questionNumber`. Semantic similarity is not a
matching key. The private manifest also records annotation timestamps, schema
version and resolution status.

## Execution controls

Real engine execution additionally requires `QISI_ALLOW_REAL_OCR_BENCH=1`.
Model download additionally requires `QISI_ALLOW_MODEL_DOWNLOAD=1`. Without the
relevant flag, runners must fail closed or use public synthetic inputs. Timeout,
unavailable-engine and malformed-result cases remain explicit failures rather than
being dropped or counted as zero-score successes.

## Release rule

Only an untouched Holdout evaluation can feed a promotion decision. Even then,
the Program B safety gates, quality gates, deployment review and rollback proof
must all pass. Corpus size alone never authorizes promotion.
