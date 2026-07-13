# OCR Quality R1 Failure Taxonomy

## Purpose and boundary

This taxonomy separates recognition quality from downstream safety. OCR output is
evidence, never truth. A failure in a lower layer may propagate upward, but it must
be recorded at every affected layer instead of being collapsed into a single
"OCR inaccurate" label. Unsafe or untraceable output must fail-closed and remain
available only for manual review.

## Ten failure layers

| Layer | Name | Observable failure | Evidence to retain | Acceptance boundary |
| --- | --- | --- | --- | --- |
| 1 | 图像质量 | blur, skew, perspective, low contrast, low resolution, clipping, rotation | source hash, page, dimensions, transformation metadata, quality tags | never overwrite the source image; preprocessing is measured separately |
| 2 | 文字检测 | missed, duplicated, merged, or fabricated text regions | detector blocks, bounding boxes, confidence, page reference | missing regions are allowed; invented regions are not |
| 3 | 文字识别 | substitutions, deletions, insertions, punctuation or digit errors | raw text, block text, engine/version, requestId | normalization must not erase mathematical distinctions |
| 4 | 公式识别 | malformed LaTeX, split formula, wrong operator, delimiter or superscript | raw formula evidence, token stream, renderability result, bbox | non-renderable or conflicting formulas require review |
| 5 | 阅读顺序 | column interleave, header/footer injection, reordered blocks | block id, column, order, source order, adjacency evidence | never sort a multi-column page by y-coordinate alone |
| 6 | 题目结构 | missing/wrong question anchor, stem, option, image or source order | structured candidate plus originating block ids | no semantic completion or fabricated question |
| 7 | 答案/解析结构 | answer/solution parsed as option, wrapper leakage, incomplete pair | answer and solution sequences, raw blocks, warnings | rejected solution cannot leave an answer-only attachment |
| 8 | ownership | answer, solution, formula or image attached to the wrong question | expected question numbers, continuity, duplicate/rewind checks, provenance | only deterministic full, prefix or fail-closed outcomes |
| 9 | 安全接受 | raw JSON, placeholder, invalid sequence or ownership mismatch accepted | validator and controlled-write decisions, reason codes | any fatal safety signal rejects automatic acceptance |
| 10 | 人工修正成本 | excessive field edits, re-recognition, review time or correction count | timed review session and aggregate edit counters; no private raw text in logs | report cost independently from recognition scores |

## Root-cause and impact labels

Every finding records a primary layer, affected layers, document/page identity,
engine and version, deterministic reproduction input/config, severity, and evidence
reference. Fatal safety findings include wrong answer attachment, wrong solution
attachment, fabricated question, raw JSON leakage, placeholder leakage,
controlled-write bypass, FormalAdmission bypass, and untraceable ownership.

Accuracy improvements at Layers 1-7 do not waive Layers 8-9. Layer 10 is measured
only through approved review observations and must not be inferred from CER.

## Status

Designed and unit-tested as a classification protocol. No real OCR benchmark was
authorized or run, and no engine is production-promoted by this document.
