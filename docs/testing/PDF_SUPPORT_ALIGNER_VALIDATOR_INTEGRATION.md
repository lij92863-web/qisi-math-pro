# PDF Support Aligner / Validator Integration

Stage P4.3 constrains `alignPdfSupport` to the sequence validator result.

## Contract

`alignPdfSupport` must only emit:

- `full`,
- `prefix`,
- `fail-closed`.

It receives normalized answer and solution items, delegates sequence safety to `validatePdfSupportSequence`, then maps the validator result into the legacy aligner output shape.

## Preserved Output

The aligner output keeps:

- `mode`,
- `reliable`,
- `safeQuestionNumbers`,
- `safeAnswerItems`,
- `safeSolutionItems`,
- `fusedQuestionNumbers`,
- `fusedWarnings`,
- `warnings`,
- `report.reasons`.

## Safety Rules

The aligner must not:

- expand ownership because answer coverage is complete,
- expand ownership because solution coverage is complete,
- attach after a gap,
- attach after duplicate or jump-back markers,
- attach out-of-range question numbers,
- use semantic similarity, keywords, or special question fallbacks.

The safe range is the validator-proven shared structural prefix or the full expected sequence when the validator is `full`.

## Attempt 12

For Attempt 12, the validator reports `prefix` with safe numbers `1,2`. Therefore aligner output must keep:

- `safeSolutionItems` only for `1,2`,
- `fusedQuestionNumbers` as `3,4,5,6,7,8,9,10,13,15`,
- no unsafe solution writes.

## Known-Bad

Known-bad jump-back support remains `prefix` or `fail-closed`. A later item that looks plausible must not be made safe unless the structural sequence is reliable.

## DOCX Boundary

DOCX+DOCX mock import does not depend on PDF support ownership expansion. Batch smoke tests remain the guard that this PDF aligner integration did not affect the DOCX stable path.
