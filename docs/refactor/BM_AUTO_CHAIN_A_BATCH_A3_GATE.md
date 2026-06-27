# BM-AUTO Chain A Batch A3 GATE

Stage: BM-AUTO-CHAIN-A-BATCH-A3-GATE
Branch: main
Start commit: 454b9a6
Scope: gate only; no A3 migration performed.

## Audit Summary

Batch A3 was audited after A2 migration. No standalone safe micro-batch was accepted because the candidate helpers are coupled to A4 display-cleaning helpers, duplicated local helper names, or broader choice-option repair logic.

## Function Table

| Function | Lines | Call sites | Direct deps | Deps migrated? | Pure | Mutation | Risk | Decision |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| optionTextHasContent | 14 | 1 direct plus countValidOptions path | cleanDisplayTextForBatchSave, window.Qisi.Utils.hasBatchMediaToken | no; cleanDisplayTextForBatchSave is A4 | yes | no | A4 dependency controls display cleaning and media-token preservation | ACCEPT_AFTER_A4 |
| countValidOptions | 4 | 4 | cleanDisplayOptionsForBatchSave, optionTextHasContent | no; cleanDisplayOptionsForBatchSave is A4 | yes | no | Depends on A4 option cleaning and A3 optionTextHasContent | ACCEPT_AFTER_A4 |
| optionCountOf | 7 global plus 2 local helper forms | multiple local uses; two distinct definitions at app.js 2394 and 3106 | cleanDisplayOptionsForBatchSave in local form; window.Qisi.Utils.cleanRecognizedText in global form | no; local forms conflict and one depends on A4 | yes | no | duplicate helper name and context-specific semantics | DEFER |
| choiceQuestionMissingOptions | 4 | 7 | isChoiceDraft, countValidOptions | no; countValidOptions not migrated | yes | no | depends on countValidOptions and choice-type policy | ACCEPT_AFTER_A4 |
| choiceOptionIssue | 9 | 4 | sanitizeChoiceOptions, window.Qisi.Utils.cleanRecognizedText | no; sanitizeChoiceOptions remains in app.js | yes | no | option repair/validation coupling; not standalone | NEEDS_FIXTURE |
| cleanDisplayTextForBatchSave dependency | 5 | many | window.Qisi.Utils.cleanRecognizedText, window.Qisi.Utils.stripBatchImagePlaceholders | partially; strip helper migrated, function itself A4 | yes | no | A4 display-cleaning policy affects save path | DEFER |
| cleanDisplayOptionsForBatchSave dependency | 20 | many | cleanDisplayTextForBatchSave, window.Qisi.Utils.hasBatchMediaToken, window.Qisi.Utils.BATCH_MEDIA_TOKEN_RE | partially; A1 deps migrated, function itself A4 | yes | no | A4 option-cleaning policy affects pure-image option preservation | DEFER |

## Details

- optionTextHasContent cannot be migrated alone because it must call cleanDisplayTextForBatchSave, which is explicitly part of A4.
- countValidOptions cannot be migrated alone because its result is defined by cleanDisplayOptionsForBatchSave and optionTextHasContent.
- optionCountOf is not a single stable helper in app.js. There is a global helper near app.js 3106 and a local helper near app.js 2394, with different surrounding semantics.
- choiceQuestionMissingOptions depends on countValidOptions and isChoiceDraft; moving it before countValidOptions would not reduce risk.
- choiceOptionIssue depends on sanitizeChoiceOptions and answer-letter policy. It needs fixture coverage before extraction.
- cleanDisplayTextForBatchSave and cleanDisplayOptionsForBatchSave are A4 dependencies and must not be migrated during A3 gate.

## Decision

- ACCEPT_STANDALONE functions: none.
- A3 migration allowed now: no.
- A3 should be reconsidered after A4 fixture-first work: yes.
- Continue to A4 manual gate: yes.
