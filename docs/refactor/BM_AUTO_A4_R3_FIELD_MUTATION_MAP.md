# BM-AUTO A4 R3 Field Mutation Map

Stage: BM-AUTO-A4-R3-FIELD-MUTATION-MAP
Branch: main

## Summary

Total mapped: 40.

## Decisions

| Decision | Count |
| --- | ---: |
| MUTATION_UNKNOWN | 29 |
| SAFE_WARNING_MUTATION | 1 |
| UNSAFE_ANSWER_SOLUTION_MUTATION | 7 |
| UNSAFE_SUPPORT_MUTATION | 3 |

## Results

| ID | Helper | Line | Decision | Mutated | Nearby |
| --- | --- | ---: | --- | --- | --- |
| R3-02402 | cleanDisplayTextForBatchSave | 2402 | MUTATION_UNKNOWN | none | options, answer, solution, images |
| R3-02403 | cleanDisplayTextForBatchSave | 2403 | MUTATION_UNKNOWN | none | options, answer, solution, images |
| R3-03338 | cleanDisplayOptionsForBatchSave | 3338 | MUTATION_UNKNOWN | none | options, source, draft |
| R3-03732 | cleanDisplayTextForBatchSave | 3732 | MUTATION_UNKNOWN | stem, options, warnings | stem, options, answer, warnings |
| R3-06869 | cleanDisplayOptionsForBatchSave | 6869 | MUTATION_UNKNOWN | none | stem, options, answer, solution |
| R3-06989 | cleanDisplayTextForBatchSave | 6989 | UNSAFE_ANSWER_SOLUTION_MUTATION | options, solution, warnings | stem, options, solution, analysis, warnings |
| R3-06995 | cleanDisplayTextForBatchSave | 6995 | UNSAFE_ANSWER_SOLUTION_MUTATION | solution, warnings | stem, solution, analysis, warnings |
| R3-07215 | cleanDisplayTextForBatchSave | 7215 | MUTATION_UNKNOWN | none | answer, solution, analysis, images |
| R3-07342 | addWarningOnce | 7342 | MUTATION_UNKNOWN | warnings | warnings, images, source, draft |
| R3-07444 | addWarningOnce | 7444 | MUTATION_UNKNOWN | warnings | warnings, images, source, draft, pdf |
| R3-09936 | cleanDisplayOptionsForBatchSave | 9936 | MUTATION_UNKNOWN | none | stem, options, answer, solution |
| R3-13153 | cleanDisplayTextForBatchSave | 13153 | UNSAFE_ANSWER_SOLUTION_MUTATION | answer, solution, warnings | stem, options, answer, solution, warnings, answerItems, solutionItems, draft |
| R3-13156 | cleanDisplayTextForBatchSave | 13156 | UNSAFE_ANSWER_SOLUTION_MUTATION | answer, solution, warnings | stem, options, answer, solution, warnings, answerItems, solutionItems, draft |
| R3-13271 | cleanDisplayOptionsForBatchSave | 13271 | MUTATION_UNKNOWN | none | stem, options, answer, solution, warnings, images, source, draft |
| R3-13564 | addWarningOnce | 13564 | MUTATION_UNKNOWN | stem, warnings | stem, answer, warnings, draft |
| R3-13568 | cleanDisplayTextForBatchSave | 13568 | MUTATION_UNKNOWN | stem, warnings | stem, answer, warnings, draft |
| R3-13570 | cleanDisplayTextForBatchSave | 13570 | UNSAFE_ANSWER_SOLUTION_MUTATION | stem, answer, warnings | stem, answer, warnings, draft |
| R3-13582 | addWarningOnce | 13582 | UNSAFE_ANSWER_SOLUTION_MUTATION | answer, warnings | stem, answer, solution, analysis, warnings, draft |
| R3-13587 | cleanDisplayTextForBatchSave | 13587 | UNSAFE_ANSWER_SOLUTION_MUTATION | answer, solution, warnings | stem, answer, solution, analysis, warnings, draft |
| R3-13594 | cleanDisplayTextForBatchSave | 13594 | UNSAFE_SUPPORT_MUTATION | solution, warnings, source | stem, answer, solution, analysis, warnings, source, draft |
| R3-13596 | addWarningOnce | 13596 | UNSAFE_SUPPORT_MUTATION | solution, warnings, source | stem, solution, analysis, warnings, source, draft |
| R3-13714 | cleanDisplayOptionsForBatchSave | 13714 | MUTATION_UNKNOWN | draft | options, answer, images, source, draft |
| R3-13758 | cleanDisplayOptionsForBatchSave | 13758 | MUTATION_UNKNOWN | none | stem, options, answer, solution, images, source, draft |
| R3-13830 | cleanDisplayOptionsForBatchSave | 13830 | MUTATION_UNKNOWN | draft | options, answer, solution, draft |
| R3-13859 | cleanDisplayOptionsForBatchSave | 13859 | MUTATION_UNKNOWN | draft | stem, options, answer, solution, images, source, draft |
| R3-14545 | cleanDisplayTextForBatchSave | 14545 | MUTATION_UNKNOWN | none | stem, options, answer, solution, warnings |
| R3-15396 | cleanDisplayOptionsForBatchSave | 15396 | MUTATION_UNKNOWN | none | stem, options, answer, solution |
| R3-18247 | addWarningOnce | 18247 | MUTATION_UNKNOWN | warnings | answer, warnings, support, pdf |
| R3-18900 | addWarningOnce | 18900 | MUTATION_UNKNOWN | warnings | answer, solution, warnings, support, draft, pdf |
| R3-18906 | addWarningOnce | 18906 | MUTATION_UNKNOWN | warnings | answer, solution, warnings, support, draft, pdf |
| R3-18913 | addWarningOnce | 18913 | MUTATION_UNKNOWN | warnings | answer, solution, warnings, support, draft, pdf |
| R3-18952 | addWarningOnce | 18952 | SAFE_WARNING_MUTATION | warnings | warnings, draft |
| R3-18971 | addWarningOnce | 18971 | MUTATION_UNKNOWN | warnings | answer, warnings, answerItems, solutionItems, draft |
| R3-19010 | addWarningOnce | 19010 | MUTATION_UNKNOWN | warnings | warnings, source, draft |
| R3-19013 | cleanDisplayFieldsOnly | 19013 | MUTATION_UNKNOWN | warnings | warnings, source, draft |
| R3-19212 | addWarningOnce | 19212 | UNSAFE_SUPPORT_MUTATION | warnings, images, source | warnings, images, source, draft, pdf |
| R3-19257 | cleanDisplayOptionsForBatchSave | 19257 | MUTATION_UNKNOWN | none | stem, options, answer, solution, images, source |
| R3-19335 | cleanDisplayOptionsForBatchSave | 19335 | MUTATION_UNKNOWN | none | stem, options, answer, solution, warnings, images, source, pdf |
| R3-19361 | addWarningOnce | 19361 | MUTATION_UNKNOWN | warnings | stem, options, solution, warnings, draft, save |
| R3-20032 | addWarningOnce | 20032 | MUTATION_UNKNOWN | warnings | stem, options, solution, warnings, images, source, save |

## Decision

Field mutation map generated. Unsafe and unknown entries must remain frozen unless later proof supplies narrower evidence.
