# PDF Support Solution Real Run Report

## Scope

- Stage: `PDF-SUPPORT-PARSER-MARKER-COVERAGE-FIX` / P6
- Runner: `node scripts/pdf-master-browser-runner.js --mode=real-run`
- Attempt number: 5
- New real API attempts used this task: 1
- Raw OCR text committed: no
- API key printed: no
- Real PDF/DOCX committed: no

## Result

- Status: `pass-safe-partial`
- Quality level: not-complete
- Question count: 12
- Answer count: 12
- Solution count: 1
- Missing answers: none
- Missing solutions: 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15
- Align mode: `fail-closed`
- Fail-closed: yes
- Prefix: yes
- Wrong attach risk: not detected by sanitized warnings

## Parser Coverage

- `supportRawPageCount`: 4
- `supportBlockCount`: 1
- `answerBlockCount`: 1
- `solutionBlockCount`: 1
- `answerItems count`: 1
- `solutionItems count`: 1
- `supportDetectedNumbers`: 7
- `answerDetectedNumbers`: 7
- `solutionDetectedNumbers`: 7
- `outOfRangeNumbers`: none
- `duplicateNumbers`: none
- `jumpBackNumbers`: none
- `unknownBlockCount`: 0

## Layer Diagnosis

- `parserLayerDiagnosis`: improved from zero blocks to one block, but still not enough coverage for complete import.
- `supportParserLayerDiagnosis`: remaining marker coverage or block construction is still incomplete; only question 7 was detected from support raw pages.
- `alignerLayerDiagnosis`: correctly failed closed because detected support set `{7}` does not equal expected set `{1,2,3,4,5,6,7,8,9,10,13,15}`.
- `controlledWriteLayerDiagnosis`: followed the fail-closed parser gate and only preserved legacy-safe solution 1.
- `runnerCollectionDiagnosis`: captured parser, aligner, controlled-write, draft, review, and sanitized marker-form fingerprints.

## Stop Decision

P6 rule applies: support block count is now greater than zero, but `solutionItems count` is still 1 and draft solution count is still 1. Do not continue real-run attempts. The next repair must return to fixture-first parser coverage, using the sanitized marker-form fingerprints that still did not become blocks.
