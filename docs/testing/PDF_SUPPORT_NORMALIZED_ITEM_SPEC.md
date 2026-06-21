# PDF Support Normalized Item Spec

Stage P4.1 defines the metadata expected on normalized PDF support items. This is an auditability change, not a completeness change.

## Item Shape

Answer items keep the existing fields:

```js
{
  question: "1",
  answer: "A",
  sourceTrace: { ... },
  evidence: { ... },
  warnings: []
}
```

Solution items keep the existing fields:

```js
{
  question: "1",
  solution: "solution text",
  sourceTrace: { ... },
  evidence: { ... },
  warnings: []
}
```

The legacy `question`, `answer`, `solution`, `sourceTrace`, and `warnings` fields remain backward compatible.

## `sourceTrace`

| Field | Purpose | Safety use |
| --- | --- | --- |
| `questionNumber` | Normalized question marker for this item. | Structural evidence only; not sufficient alone. |
| `pageIndex` | Page where this answer/solution section starts. | May support page/order diagnostics. |
| `pageStart` / `pageEnd` | Block page span. | Useful for cross-page diagnostics. |
| `sourceOrder` | Source order where this section starts. | May support ordering diagnostics. |
| `sourceOrderStart` / `sourceOrderEnd` | Block source-order span. | Useful for cross-page/order diagnostics. |
| `blockIndex` | Parser block index after marker splitting. | Structural evidence for sequence diagnostics. |
| `sectionStartLine` / `sectionEndLine` | Line span for the answer/solution section. | Helps audit section boundaries. |
| `rawBlockExcerpt` | Sanitized excerpt from the parsed support block. | Diagnostic evidence; do not use for semantic ownership. |
| `sourceFileId` | Source support file identifier when available. | Diagnostic grouping only. |

## `evidence`

| Field | Purpose |
| --- | --- |
| `questionMarker` | Whether the item is backed by a structural question marker or expected-sequence label marker. |
| `labelMarker` | Whether the item is backed by an answer/solution label marker. |
| `label` | The label text, such as `答案`, `解析`, or `详解`. |
| `evidenceLevel` | `explicit-marker`, `section-marker`, or `unsafe`. |

## Safety Boundary

Metadata does not expand ownership.

The parser still emits safe items only from expected blocks without parser warnings. The aligner and controlled-write stages still decide whether a field is writable. A block having `sourceTrace` or `evidence` does not make the answer or solution safe.

## AI/OCR Distrust

AI/OCR-provided `question` fields can be wrong or stale. They are candidates only. Safe ownership must still be proven using structural evidence:

- expected question numbers,
- source order,
- block index,
- question markers,
- answer/solution labels,
- duplicate/jump-back/out-of-range checks,
- answer/solution sequence compatibility,
- parser gate and controlled-write results.

## Attempt 12

The Attempt 12 fixture keeps answer coverage at `12/12`, but solution ownership is only safe for `1,2`. Metadata is present on parsed items, including later solution markers, but those later items remain withheld/fused by the sequence gate.

Unsafe solution ownership for `3,4,5,6,7,8,9,10,13,15` must remain withheld unless a later stage proves the full structure safely. P4.1 does not provide that proof.
