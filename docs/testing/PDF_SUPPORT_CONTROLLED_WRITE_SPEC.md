# PDF Support Controlled Write Spec

## Purpose

Controlled write is the final safety gate before PDF support fields enter draft questions.

It may write only field-level answer or solution data that a prior gate has already proven safe. Missing fields are acceptable; wrong fields are not.

## Field Ownership

- Answer safety does not imply solution safety.
- Solution safety does not imply answer safety.
- Parser-owned fields must not be written for `parserFusedQuestionNumbers`.
- Legacy-owned fields must not be written for `legacyFusedQuestionNumbers`.
- Objective answer normalization may change only the answer value for that question. It must not make a solution safe.
- Multiple-choice option-value conversion is allowed only when the structural or option match is unambiguous.

## Evidence Preservation

Effective answer and solution items keep their original item fields, including:

- `sourceTrace`
- `warnings`
- parser evidence such as `rawBlockExcerpt`
- source file/page metadata

The returned `controlledWriteSummary` records written answer numbers, written solution numbers, fused question numbers, warning count, and field-decision count for runner/report diagnostics.

## Fail-Closed Rules

Controlled write does not recover fields from unsafe parser output, semantic similarity, or special question-number fallbacks. If a question number is fused for a source, that source cannot write answer or solution for that number.

Attempt 12 remains safe-partial: answer coverage can remain complete while solution write is limited to safe solution `1,2`.
