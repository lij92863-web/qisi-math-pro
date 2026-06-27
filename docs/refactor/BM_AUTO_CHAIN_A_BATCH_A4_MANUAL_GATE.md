# BM-AUTO Chain A Batch A4 MANUAL_GATE

Stage: BM-AUTO-CHAIN-A-BATCH-A4-MANUAL-GATE
Branch: main
Scope: manual gate only; no A4 migration performed.

## Audited Helpers

- cleanDisplayTextForBatchSave
- cleanDisplayOptionsForBatchSave
- addWarningOnce
- cleanDisplayFieldsOnly

## Behavior Summary

cleanDisplayTextForBatchSave normalizes recognized text and strips unsafe batch image placeholders while preserving legal media tokens through qisi-utils helpers.

cleanDisplayOptionsForBatchSave normalizes an options array to four display options, delegates to cleanDisplayTextForBatchSave, and preserves pure legal media-token options when the cleaned text would otherwise become empty.

addWarningOnce mutates a draft-like object by replacing warnings with a de-duplicated array containing the new message.

cleanDisplayFieldsOnly mutates a question-like object by cleaning stem, options, answer, and solution fields in place.

## Call-Site Classification

| Helper | DOCX path | PDF path | Batch save path | Draft write path | Option repair path | Final validation path | Unknown |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cleanDisplayTextForBatchSave | yes: DOCX parsing/visual fallback and importer adapter paths | yes: support/repair patch paths use cleaned answer/solution text | yes: save/submit cleanup uses display-cleaned fields | yes: draft editor/save/update paths | yes: forced option extraction and repairs | yes: draft review validation and final placeholder checks | no |
| cleanDisplayOptionsForBatchSave | yes: DOCX visual validation and importer adapter paths | yes: parsed support/draft option repair paths | yes: batch save/submission cleanup | yes: draft editor/update paths | yes: sanitize/merge option repair paths | yes: choice missing-option checks | no |
| addWarningOnce | yes: DOCX/image conversion warnings | possible: shared draft warning helper can be used after parser decisions | yes: warning propagation before submit | yes: mutates draft warnings | yes: warning on option repair uncertainty | yes: validation warnings | yes: exact ownership needs fixture trace |
| cleanDisplayFieldsOnly | yes: can affect DOCX-created draft fields | possible: shared draft field cleanup can affect PDF-created drafts | yes: direct batch-save cleanup helper | yes: mutates active draft object fields | possible: cleaned options affect repair result | yes: final field cleanup before validation | no |

## Risk Analysis

- cleanDisplayTextForBatchSave and cleanDisplayOptionsForBatchSave define save/display semantics, not just pure formatting.
- cleanDisplayOptionsForBatchSave has a special pure-image option preservation path that depends on A1 media-token behavior.
- addWarningOnce and cleanDisplayFieldsOnly mutate draft-like objects and require mutation fixtures before extraction.
- These helpers can affect DOCX stable behavior, PDF-created drafts, option repair, and final validation.
- Moving these helpers without fixtures risks changing whether an answer/solution/option is considered safe enough for review.

## Decision

- A4 direct migration allowed: no.
- Fixture-first required: yes.
- Wrapper-first allowed: yes, only after fixtures lock mutation and save-path behavior.
- Next recommended task: create A4 fixture tests for cleaning, option preservation, warning mutation, and field-cleaning mutation before any migration.
