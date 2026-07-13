# OCR Ownership and Safe Partial Decision R1

## Decision

```text
NO_HIGH_RISK_CHANGE_WITHOUT_HOLDOUT_FAILURE
```

As of 2026-07-13:

- eligible private documents: 0
- real Holdout failing cases: 0
- high-risk owner changes: none
- production-promoted: no

R3 permits a high-risk ownership change only after a real Holdout failure proves a
specific defect. Synthetic candidates and newly extracted structure can prove
fail-closed boundaries, but cannot prove that changing answer/solution ownership
improves a real document. The existing aligner, controlled-write, and
FormalAdmission owners therefore remain unchanged.

## Deterministic evidence retained

Any future ownership evaluation must continue to use all of:

- `expectedQuestionNumbers`
- `sourceOrder`
- answer sequence
- solution sequence
- continuity
- duplicate detection
- rewind detection
- answer/solution pairing consistency

The only safe outcomes remain on one line for audit: full, prefix, fail-closed.
Missing fields and manual review are acceptable; wrong attachment is not.

## Forbidden behavior retained

- gap 后继续
- 回跳后继续
- answer-only 保留
- semantic overlap 归属
- formula token 猜归属
- solution rejected while answer remains attached
- extracted candidate bypasses controlled-write
- OCR evidence bypasses FormalAdmission

The B2-6 structure extractor deliberately emits answer/solution as unvalidated
candidate evidence and fixes both `eligibleForControlledWrite` and
`eligibleForFormalAdmission` to false. It is not a replacement ownership owner.

## Evidence required to unlock a future change

A later authorized package must provide:

1. A private Holdout document admitted under the corpus protocol.
2. A reproducible current-owner failure with source hash, page, expected sequence,
   raw evidence reference, and sanitized reason code.
3. A failure-first test importing the real production owner, not a copied helper.
4. A single-owner minimal change with full/prefix/fail-closed unchanged.
5. Zero wrong answer/solution attachment on Development and untouched Holdout.
6. All mandatory gates plus rollback evidence.

Until all six exist, B2-7 is evaluated and held. No claim of improved ownership,
real OCR accuracy, or production promotion is made.
