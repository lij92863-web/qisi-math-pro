# OCR Reading Order R1

## Contract

Every input block must contain:

```text
id, page, bbox, column, order, type, rawText, confidence
```

`order` is preserved as engine/source order. The derived sequence is emitted as
`readingOrder`; source evidence is never overwritten. Missing/invalid page,
bounding box, column, order, type, text or confidence fails closed with
`invalid-block-contract`. A duplicate `(page, id)` also fails closed.

## Deterministic priority

The pure owner applies this fixed order:

1. page
2. explicit column region
3. explicit `question-anchor` group
4. geometric adjacency inside that group
5. source order, then stable id tie-break

It never performs a whole-page y-only sort. It never inspects `rawText` to infer a
question number, formula meaning, option label or ownership. Blocks containing
`A/B/C/D` or formula tokens receive no special semantic treatment.

Explicit `header` and `footer` blocks are excluded from the content sequence but
returned in `excludedBlocks` with warnings, so evidence is preserved. Other block
types, including text, formula and image, remain in deterministic visual order.

## Evidence status

- Implemented: yes, as `qisi-ocr-reading-order.js`.
- Unit-tested: single column, double column, mixed figure/text, cross-column
  anchor, multiline formula, header/footer, and invalid contract.
- Production-wired: no.
- Benchmark-measured on real documents: no.
- Production-promoted: no.

The module remains a scaffold owner until an authorized real OCR benchmark and
later selection/promotion gate establish value without safety regression.
