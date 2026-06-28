# BM-AUTO A4 R3 Ownership Trace

Stage: BM-AUTO-A4-R3-OWNERSHIP-TRACE
Branch: main

## Summary

Total traced: 40.

## Decisions

| Decision | Count |
| --- | ---: |
| ANSWER_SOLUTION_RISK_TRUE | 18 |
| SUPPORT_ATTACHMENT_RISK_TRUE | 22 |

## Results

| ID | Helper | Line | Parent | Decision | Mutated | Read |
| --- | --- | ---: | --- | --- | --- | --- |
| R3-02402 | cleanDisplayTextForBatchSave | 2402 | betterText | ANSWER_SOLUTION_RISK_TRUE | none | options, answer, solution, images |
| R3-02403 | cleanDisplayTextForBatchSave | 2403 | betterText | ANSWER_SOLUTION_RISK_TRUE | none | options, answer, solution, images |
| R3-03338 | cleanDisplayOptionsForBatchSave | 3338 | repairDocxOptionsFromTextEvidence | SUPPORT_ATTACHMENT_RISK_TRUE | none | sourceTrace, options |
| R3-03732 | cleanDisplayTextForBatchSave | 3732 | if | ANSWER_SOLUTION_RISK_TRUE | options, stem | options, stem, answer |
| R3-06869 | cleanDisplayOptionsForBatchSave | 6869 | repairPageChoiceAndSolutionDetailsWithVision | ANSWER_SOLUTION_RISK_TRUE | none | options, answer, solution, stem |
| R3-06989 | cleanDisplayTextForBatchSave | 6989 | repairPageChoiceAndSolutionDetailsWithVision | ANSWER_SOLUTION_RISK_TRUE | options, warnings, solution | options, warnings, solution, stem |
| R3-06995 | cleanDisplayTextForBatchSave | 6995 | if | ANSWER_SOLUTION_RISK_TRUE | warnings, solution | warnings, solution, stem |
| R3-07215 | cleanDisplayTextForBatchSave | 7215 | for | SUPPORT_ATTACHMENT_RISK_TRUE | none | answer, solution |
| R3-07342 | addWarningOnce | 7342 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | sourceTrace |
| R3-07444 | addWarningOnce | 7444 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | none |
| R3-09936 | cleanDisplayOptionsForBatchSave | 9936 | validateDocxVisualItems | ANSWER_SOLUTION_RISK_TRUE | none | options, stem, answer, solution |
| R3-13153 | cleanDisplayTextForBatchSave | 13153 | repairDraftAnswersByOrder | ANSWER_SOLUTION_RISK_TRUE | answer, warnings, draft.warnings.push(, solution | answer, warnings, solution, stem, options |
| R3-13156 | cleanDisplayTextForBatchSave | 13156 | repairDraftAnswersByOrder | ANSWER_SOLUTION_RISK_TRUE | answer, warnings, draft.warnings.push(, solution | answer, warnings, solution, stem, options |
| R3-13271 | cleanDisplayOptionsForBatchSave | 13271 | finalDraftNeedsOptionVisionRepair | SUPPORT_ATTACHMENT_RISK_TRUE | none | options, sourceTrace |
| R3-13564 | addWarningOnce | 13564 | if | ANSWER_SOLUTION_RISK_TRUE | warnings, stem | answer, warnings, stem |
| R3-13568 | cleanDisplayTextForBatchSave | 13568 | if | ANSWER_SOLUTION_RISK_TRUE | warnings, stem | warnings, stem, answer |
| R3-13570 | cleanDisplayTextForBatchSave | 13570 | if | ANSWER_SOLUTION_RISK_TRUE | stem, answer | stem, answer |
| R3-13582 | addWarningOnce | 13582 | if | ANSWER_SOLUTION_RISK_TRUE | answer | answer, solution, stem |
| R3-13587 | cleanDisplayTextForBatchSave | 13587 | if | ANSWER_SOLUTION_RISK_TRUE | answer, solution | answer, solution, stem |
| R3-13594 | cleanDisplayTextForBatchSave | 13594 | if | SUPPORT_ATTACHMENT_RISK_TRUE | solution, sourceTrace | solution, stem, sourceTrace |
| R3-13596 | addWarningOnce | 13596 | if | SUPPORT_ATTACHMENT_RISK_TRUE | solution, sourceTrace | solution, stem, sourceTrace |
| R3-13714 | cleanDisplayOptionsForBatchSave | 13714 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | answer, options, sourceTrace |
| R3-13758 | cleanDisplayOptionsForBatchSave | 13758 | pushTarget | SUPPORT_ATTACHMENT_RISK_TRUE | none | sourceTrace, options, answer, solution, stem |
| R3-13830 | cleanDisplayOptionsForBatchSave | 13830 | runMap | ANSWER_SOLUTION_RISK_TRUE | none | options, answer, solution |
| R3-13859 | cleanDisplayOptionsForBatchSave | 13859 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | answer, options, stem, solution, sourceTrace |
| R3-14545 | cleanDisplayTextForBatchSave | 14545 | if | ANSWER_SOLUTION_RISK_TRUE | none | stem, options |
| R3-15396 | cleanDisplayOptionsForBatchSave | 15396 | runBatchDocxGoldenCheck | ANSWER_SOLUTION_RISK_TRUE | none | options, stem, answer, solution |
| R3-18247 | addWarningOnce | 18247 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | none |
| R3-18900 | addWarningOnce | 18900 | for | SUPPORT_ATTACHMENT_RISK_TRUE | none | answer, solution |
| R3-18906 | addWarningOnce | 18906 | for | SUPPORT_ATTACHMENT_RISK_TRUE | none | answer, solution |
| R3-18913 | addWarningOnce | 18913 | for | SUPPORT_ATTACHMENT_RISK_TRUE | none | answer, solution |
| R3-18952 | addWarningOnce | 18952 | for | SUPPORT_ATTACHMENT_RISK_TRUE | none | none |
| R3-18971 | addWarningOnce | 18971 | for | SUPPORT_ATTACHMENT_RISK_TRUE | none | none |
| R3-19010 | addWarningOnce | 19010 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | sourceTrace |
| R3-19013 | cleanDisplayFieldsOnly | 19013 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | sourceTrace |
| R3-19212 | addWarningOnce | 19212 | if | SUPPORT_ATTACHMENT_RISK_TRUE | sourceTrace | sourceTrace |
| R3-19257 | cleanDisplayOptionsForBatchSave | 19257 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | options, answer, solution, stem, sourceTrace |
| R3-19335 | cleanDisplayOptionsForBatchSave | 19335 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | options, answer, solution, stem, sourceTrace |
| R3-19361 | addWarningOnce | 19361 | if | ANSWER_SOLUTION_RISK_TRUE | warnings | options, stem, solution, warnings |
| R3-20032 | addWarningOnce | 20032 | if | SUPPORT_ATTACHMENT_RISK_TRUE | none | options, stem, solution, sourceTrace, images |

## Decision

Ownership trace generated. Use with field mutation map and residual proof before replacing any residual callsite.
