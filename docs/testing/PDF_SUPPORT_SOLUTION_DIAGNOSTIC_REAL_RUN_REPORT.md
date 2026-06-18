# PDF Support Solution Diagnostic Real Run Report

## Scope

- Task: `PDF-SUPPORT-SOLUTION-DIAGNOSTIC-TO-REPAIR`
- Run time: 2026-06-18T09:55:46.813Z
- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Report type: sanitized diagnostic only
- Raw OCR text committed: no
- API key printed: no
- Real PDF/DOCX committed: no

## Attempt

- Attempt number in ledger: 2
- New real API attempt in this task: 1
- Real API triggered: true
- Underlying API call count: 10
- Runner phase: `read-sanitized-result`
- Batch status: `review`
- Question count: 12
- Answer count: 12
- Solution count: 1
- Align mode: `fail-closed`
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Fail-closed: yes
- Prefix: yes
- Wrong attach risk: not detected by sanitized warnings

## Parser And Alignment Diagnostics

- `supportRawPageCount`: 4
- `supportBlockCount`: 0
- `answerBlockCount`: 0
- `solutionBlockCount`: 0
- `supportDetectedNumbers`: none
- `answerDetectedNumbers`: none
- `solutionDetectedNumbers`: none
- `rejectedSolutionNumbers`: none
- `rejectReasons`: `support-question-set-not-equal-expected`
- `unsafeSequenceReason`: `support-question-set-not-equal-expected`
- `prefixCutoffAt`: none
- `failClosedReason`: `support-question-set-not-equal-expected`
- `solutionMarkerForms`: `not-collected-without-raw-text`
- `outOfRangeNumbers`: none
- `duplicateNumbers`: none
- `jumpBackNumbers`: none
- `unknownBlockCount`: 0

## Alignment Summary

- `alignInputSummary.expectedValues`: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- `alignInputSummary.answerValues`: none
- `alignInputSummary.solutionValues`: none
- `alignOutputSummary.mode`: `fail-closed`
- `alignOutputSummary.safeQuestionNumbers`: none
- `alignOutputSummary.fusedQuestionNumbers`: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- `alignOutputSummary.safeAnswerCount`: 0
- `alignOutputSummary.safeSolutionCount`: 0

## Controlled Write Summary

- `controlledWriteSummary.answerQuestionNumbers`: 1
- `controlledWriteSummary.solutionQuestionNumbers`: 1
- `controlledWriteSummary.fusedQuestionNumbers`: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 1
- `controlledWriteSummary.warningCodes`: none
- `controlledWriteSummary.rejectedSolutionNumbers`: none
- `controlledWriteSummary.rejectedSolutionReasons`: none
- `controlledWriteSummary.fieldDecisionReasonCounts`:
  - `answer:legacy:objective-legacy-preserved`: 1
  - `solution:legacy:legacy-safe-solution-fallback`: 1
- `writableSolutionNumbers`: 1
- `blockedSolutionNumbers`: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 1
- `draftSolutionCount`: 1
- `reviewPageSolutionCount`: 1

## Missing Solution Reasons

- 2: `pdf-support-sequence-unreliable`
- 3: `pdf-support-sequence-unreliable`
- 4: `pdf-support-sequence-unreliable`
- 5: `pdf-support-sequence-unreliable`
- 6: `pdf-support-sequence-unreliable`
- 7: `pdf-support-sequence-unreliable`
- 8: `pdf-support-sequence-unreliable`
- 9: `pdf-support-sequence-unreliable`
- 10: `pdf-support-sequence-unreliable`
- 13: `pdf-support-sequence-unreliable`
- 15: `pdf-support-sequence-unreliable`

## Diagnosis

- Parser diagnosis: support raw pages were present, but no parser support blocks were emitted.
- Aligner diagnosis: with no parser answer or solution values and expected values present, the aligner correctly failed closed.
- Controlled-write diagnosis: only the safe legacy fallback for question 1 was writable.
- Runner diagnosis: the runner captured parser, aligner, controlled-write, draft, and review sanitized counts. It did not collect raw marker forms because raw OCR text must not be committed.

## Next Action

Converted this failure shape into fixture-first tests before repair. Do not treat 13 and 15 as out-of-range in this run; they are part of the recognized draft question number set.

## Post-Repair Diagnostic

After fixture-first repair and safe verification, two controlled real-run checks were executed:

- Attempt 3: still `pass-safe-partial`; question count 12, answer count 12, solution count 1, parser support block count 0.
- Attempt 4: still `pass-safe-partial`; question count 12, answer count 12, solution count 1, parser support block count 0.

Attempt 4 collected sanitized marker-form fingerprints without OCR text:

- `\A_【C】A x5`
- `\A_\A{【C】}A x2`
- `【C】C$A=A+A(A,A\A\A{A})$,_$A=A+A\A{A}(A,A\A\A{A})$,_C x1`
- `\A_【C】 x1`
- `\A_\A{【C】}_$-\A{#}{#}$ x1`
- `\A_\A{【C】}_$\A$C$A(#,#)$C$\A$C,_$\A_\A_\A_=_\A{#\A{#}}{#}$,_$\A_\A_=_\A{#\A{#}}{ x1`
- `\A_\A{【C】}C$\A_A$C,_C,_$A_=_#A\A_#^\A_=_#_\A_#_\A_\A{\A{#}}{#}_=_#\A{#}$,_C$\A_A x1`
- `\A_\A{【C】#} x1`
- `\A_\A{【C】$\A{\A{#}+#}{#}$} x1`
- `\A{#【C】A} x1`

The attempt cap for this task has been reached. Stop condition: the case02 result is still not complete, and further repair would require a new fixture-first task using these sanitized marker-form fingerprints rather than guessing attachment.
