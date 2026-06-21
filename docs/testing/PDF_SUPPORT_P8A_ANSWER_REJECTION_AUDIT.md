# PDF Support P8A Answer Rejection Audit

## Objective

Audit the P7 answer rejection chain for answers `2`, `8`, and `9` without changing business code.

This stage is read-only except for this report. It does not run real recognition, does not modify `qisi-*.js`, `scripts/`, `tests/`, `app.js`, `main.html`, or package files, and does not generate a baseline, freeze note, release audit, or tag.

## Sources Read

- `docs/testing/PDF_SUPPORT_P7_REAL_RUN_REPORT.md`
- `qisi-pdf-support-controlled-write.js`
- `qisi-pdf-support-aligner.js`
- `qisi-pdf-support-block-parser.js`
- `scripts/pdf-master-browser-runner.js`
- `tests/pdf-real-case.test.js`
- `tests/batch-smoke-mock.test.js`
- `tests/fixtures/pdf-real-case-minimal.js`

## P7 Facts

- Result: `pass-safe-partial`
- Expected question numbers: `1,2,3,4,5,6,7,8,9,10,13,15`
- Detected answer numbers: full expected set
- Detected solution numbers: full expected set
- Parser gate align output mode: `full`
- Parser gate safe answer count: 12
- Parser gate safe solution count: 12
- Runner ledger alignMode: `fail-closed`
- Draft snapshot safe answer numbers: `1,2,3,4,5,6,7,10,13,15`
- Controlled-write accepted answer numbers: `1,3,4,5,6,7,10,13,15`
- Controlled-write accepted solution numbers: full expected set
- Controlled-write rejected answer numbers: `2,8,9`
- Controlled-write rejected solution numbers: none
- Controlled-write warning code: `parser-objective-answer-rejected`
- Controlled-write fused question numbers: `2,3,4,5,6,7,8,9,10,13,15`
- Missing answers in final draft: `8,9`
- Missing solutions: none

## Chain Summary

The parser and aligner proved sequence coverage for answer and solution items. That is necessary but not sufficient for writing answer fields.

The final rejection happened in `buildPdfSupportFieldLevelControlledWrite`, specifically in the objective-answer branch:

1. The draft is classified as objective by `isObjectiveDraft`.
2. There is no usable legacy answer item for the same question, or parser is the active answer source.
3. The parser answer is passed to `normalizeObjectiveAnswerToLabels`.
4. If normalization returns `ok: false`, controlled-write does not write the answer.
5. Controlled-write records warning code `parser-objective-answer-rejected` and a field decision with `field: answer`, `source: none`, and the normalization reason.

Solutions are handled independently after answer handling. A full solution set does not unlock a rejected answer.

## Required Questions

### 1. What triggers `parser-objective-answer-rejected` in controlled-write?

It is triggered when an objective draft has a parser answer item but `normalizeObjectiveAnswerToLabels` cannot safely normalize that parser answer into valid option labels.

The rejection preserves:

- `code: parser-objective-answer-rejected`
- `reason`
- `structuralCandidate`
- `structuralReason`
- `originalAnswer`

P7 reasons were:

- answer `2`: `option-value-not-matched`
- answers `8` and `9`: `multiple-option-value-rejected`

### 2. Why is answer 2 in the runner snapshot safe set but rejected by controlled-write?

The runner snapshot safe answer set is based on final draft rows with non-empty `answer` fields. Controlled-write accepted answer numbers are based on `effectiveAnswerItems` from the field-level gate.

P7 shows:

- draft snapshot safe answers include `2`
- controlled-write accepted answers do not include `2`
- controlled-write rejected answers include `2`

Therefore answer `2` came from a path visible in the final draft snapshot but not accepted by the controlled-write parser answer path. The P7 warning list includes review/repair-style answer fill warnings, so the likely source is an additional draft population or review-side path after controlled-write rejected the parser answer. This is a runner/report consistency issue: draft snapshot numbers must not be treated as baseline accepted answer numbers.

P8D should split these fields explicitly:

- parserGate safe answer numbers
- aligner safe answer numbers
- controlledWrite accepted answer numbers
- controlledWrite rejected answer numbers
- draft snapshot answer numbers
- baseline candidate answer numbers

### 3. Are answer 8/9 raw answer shapes sufficient to reproduce in a sanitized report?

They are sufficient to reproduce the rejection shape, but not yet sufficient to justify accepting the answers.

P7 preserved sanitized shapes:

- answer `8`: original answer shape `}A_\A{A}`
- answer `9`: original answer shape `}A_\A{A}`

Both were structural candidates with `structuralReason: non-label-payload`, and both were rejected as `multiple-option-value-rejected`.

Existing fixtures cover a different safe-normalization shape for `8` and `9`: `}B_\A{D}` and `}A_\A{C}` normalize to `BD` and `AC`. P7's raw shapes collapse to the same sanitized `A` payload shape, so P8B should add a fixture that reproduces the rejected P7 shape without using real OCR text.

### 4. Are rejected answers 2/8/9 the same rejection type?

No.

They share the same compatibility warning code, `parser-objective-answer-rejected`, but their reasons differ:

- `2`: non-structural option value path, `option-value-not-matched`
- `8` and `9`: structural candidate path, `non-label-payload`, then multiple-choice rejection, `multiple-option-value-rejected`

Current diagnostics make this distinction partly visible through `reason`, `structuralCandidate`, and `structuralReason`, but the taxonomy is still too coarse because the top-level warning code is shared.

### 5. Why does parserGate full not equal controlled-write complete?

Parser/aligner full means the support item sequences match the expected question-number set. It does not mean each field value is safe to write.

Controlled-write performs a later field-level policy check:

- objective answer label validation
- option-value conversion only when unambiguous
- multiple-choice value rejection unless segmented safely
- legacy answer preservation before parser answer
- independent answer and solution writes
- source-specific fused ownership filtering

Thus parserGate can be full while controlled-write remains incomplete.

### 6. What caused runner ledger alignMode `fail-closed`?

In the runner, `alignMode` is derived from final warnings, not only from parserGate align output. P7 had review warnings including `pdf-support-sequence-unreliable`, missing-field warnings, and controlled-write fused numbers. The runner therefore reported ledger alignMode `fail-closed` even though parserGate align output was `full`.

This is another summary consistency problem: parserGate mode and final runner ledger mode are measuring different layers.

### 7. Why do `fusedQuestionNumbers` include 2-15?

P7 parserGate align output had `fusedQuestionNumbers: []`, but controlled-write reported `2,3,4,5,6,7,8,9,10,13,15`.

In controlled-write, returned `fusedQuestionNumbers` are the union of `legacyFusedQuestionNumbers` and `parserFusedQuestionNumbers`. Since parserGate was full, the P7 fused set likely came from legacy/input-side fused state passed into controlled-write or from another caller-side gate, not from the parserGate full align result itself.

This should be clarified in P8D runner summary work. Until it is clarified, non-empty fused numbers must continue to block complete baseline classification.

### 8. Do P4-P6 tests already cover answer rejection reason taxonomy?

They cover important safety behavior but not the full P7 taxonomy.

Covered:

- ambiguous objective answer rejection
- unsafe math command rejection
- multiple-choice option-value rejection
- structural objective label normalization success
- solution complete does not unlock answer ownership
- known-bad remains blocked
- Attempt 12 unsafe solution ownership remains limited
- stale runner draft data does not count as current success

Not fully covered:

- the P7 answer `2` mismatch between draft snapshot and controlled-write rejection
- P7 answer `8/9` rejected shape `}A_\A{A}`
- explicit baseline-candidate answer set excluding controlled-write rejected answers
- a detailed answer rejection reason taxonomy beyond the compatibility code
- source of controlled-write fused numbers when parserGate is full

### 9. Which layer should be fixed next?

Next stage should be fixture-first, then diagnostics/taxonomy:

1. P8B: add sanitized fixture(s) for P7 answer `2/8/9` rejection and assert pass-safe-partial cannot become complete.
2. P8C: classify controlled-write answer rejection reasons while preserving the existing compatibility code.
3. P8D: repair runner summary consistency so draft snapshot answers are not treated as baseline accepted answers.

Do not change parser or aligner yet. P7 evidence shows parser/aligner sequence coverage is full; the unresolved risk is field-level answer ownership and reporting, not sequence validation.

Do not run another real recognition before P8B-P8F complete and explicitly authorize P8G.

## Safety Decision

Decision: `pass-safe-partial`

No wrong attachment was proven in P8A. The safe conclusion is that answer completion is blocked by controlled-write rejection and runner summary inconsistency. The system must remain fail-closed for baseline purposes until fixture-first tests and diagnostics distinguish accepted controlled-write answers from draft snapshot answers.

## Acceptance Checklist

- [ ] answer coverage complete: no, P7 missing `8,9`
- [x] solution coverage complete: yes, P7 solution coverage was 12/12
- [x] parserGate full: yes
- [ ] aligner full: parserGate align output full, but runner ledger alignMode was fail-closed
- [ ] runner ledger full: no
- [ ] controlled-write accepted all answers: no, accepted answers omitted `2,8,9`
- [x] controlled-write accepted all solutions: yes
- [ ] rejected answers empty: no, `2,8,9`
- [x] rejected solutions empty: yes
- [ ] fusedQuestionNumbers empty: no, `2,3,4,5,6,7,8,9,10,13,15`
- [x] known-bad passed: yes, preflight verified
- [x] DOCX stable passed: yes, batch-safety verified
- [x] runner report current run only: yes, P7 report recorded `current-run-only`
- [x] no stale artifact: no stale run was used for P7 classification
- [x] no semantic guessing: no semantic change made in P8A
- [x] no special question fallback: no special fallback added
- [x] app.js untouched: yes
- [x] fail-closed not weakened: yes
- [x] baseline generated only if complete: no baseline generated
- [x] freeze/tag not generated: none generated
