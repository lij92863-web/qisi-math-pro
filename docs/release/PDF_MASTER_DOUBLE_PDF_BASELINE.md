# PDF Master Double PDF Baseline

## Baseline Commit

- Commit: 142c2d3
- Stage: PDF-MASTER-STAGE8-BASELINE
- Source validation: Stage 6 real browser runner and Stage 7 final regression

## Real Double PDF Status

- Real API attempts used: 1
- Final classification: pass-safe-partial
- Question count: 12
- Answer count: 12
- Solution count: 1
- Align mode: fail-closed
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Prefix/fail-closed behavior: yes
- Wrong attach risk: not detected by sanitized warnings
- Formal submit: no

## Guarded Behavior

- DOCX stable chain remains covered by `verify:docx-stable`.
- PDF known-bad support remains fail-closed by `verify:pdf-known-bad`.
- Batch safety remains covered by `verify:batch-safety`.
- Real AI/OCR calls remain blocked outside explicitly authorized real-run surfaces by `verify:no-real-ai`.
- Raw OCR text, API keys, and real PDF contents are not committed.

## Stage 8 Verification

- verify:pdf-known-bad: passed
- verify:batch-safety: passed
- verify:docx-stable: passed
- verify:safe: passed
- verify:diff-scope: passed

## Known Limits

- The current baseline accepts safe partial attachment for the authorized double PDF case.
- Support solutions beyond question 1 were not attached automatically because sequence reliability was uncertain.
- Missing solutions should be handled by a later bounded repair task, fixture-first and fail-closed.

## Next Recommendation

Plan a separate repair stage for real support solution coverage without weakening PDF support sequence validation.
