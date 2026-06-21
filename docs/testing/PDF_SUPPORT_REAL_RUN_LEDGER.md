# PDF Support Real-Run Ledger

## Attempt 1

| Field | Value |
| --- | --- |
| attemptNo | 1 |
| commit | `bae3d45 stage P8F record pre real run gate` |
| runId | `pdf-master-real-run-20260621175706` |
| real AI/OCR call count | 9 |
| answer coverage | 10/12 (draft snapshot) |
| solution coverage | 12/12 |
| missing answers | 8, 9 |
| missing solutions | none |
| accepted answers (controlled-write) | 1, 7, 10, 13, 15 |
| accepted solutions (controlled-write) | 1-10, 13, 15 |
| rejected answers | 2, 3, 4, 5, 6, 8, 9 |
| rejected solutions | none |
| warning codes | parser-objective-answer-rejected, pdf-support-sequence-unreliable, missing_answer, missing_solution |
| parserGate mode | full |
| aligner mode | full |
| runner ledger alignMode | fail-closed |
| fusedQuestionNumbers | 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15 |
| baselineCandidateAnswerNumbers | 1, 7, 10, 13, 15 |
| known-bad result | not yet re-verified post-run |
| DOCX stable result | not yet re-verified post-run |
| decision | pass-safe-partial |
| next action | Record diagnostic. Answer rejection from controlled-write is structurally correct (P8E0 confirmed). Stop real-run loop. |
