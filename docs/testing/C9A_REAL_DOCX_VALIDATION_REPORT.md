# C9A Real DOCX Validation Report

## Scope

- Case: `case01-docx-docx-stable`
- Question file: `local-test-materials/case01-docx-docx-stable/01-question.docx`
- Support file: `local-test-materials/case01-docx-docx-stable/02-support-answer-solution.docx`
- PDF, OCR, AI, API, and case02 were not used.

## Result

1. Two DOCX file existence: both files exist.
2. Local DOCX parse chain readability: both DOCX files can be opened and their `word/document.xml` can be read.
3. Question count: 10 question blocks detected by the current DOCX question marker rule.
4. Answer count: 11 support answer blocks detected.
5. Solution count: 11 support solution blocks detected.
6. Option abnormalities: none detected among parsed question blocks; parsed option counts were `4,4,4,4,4,4,4,4,0,0`.
7. Image abnormalities: image-heavy DOCX; unsupported media entries were present and represented as image placeholders during structural validation.
8. Wrong answer attach: risk detected because parsed question numbers and support answer numbers do not match.
9. Wrong solution attach: risk detected because parsed question numbers and support solution numbers do not match.
10. Mojibake: none detected in extracted text.
11. `missing_answer`: question `2`.
12. `missing_solution`: question `2`.
13. Abnormal warnings: current marker scan misses image-prefixed markers. Question file misses question `8` and `11`; support file misses support block `2`. Support blocks `8` and `11` are unknown relative to the current question set.
14. Conclusion: partial.
15. Need fixture? yes.
16. Need fix? yes.

## Sanitized Structural Evidence

- Question paragraph with question `8` has an image placeholder before the marker.
- Question paragraph with question `11` has image placeholders before a spaced two-digit marker.
- Support paragraph with support block `2` has an image placeholder before the marker and answer label.

No exam body content was copied into this report.
