# C9C DOCX Fix Report

## Scope

- Fixed only the sanitized DOCX marker issue found in C9A/C9B.
- Modified DOCX question marker detection in `qisi-batch-importer.js`.
- Modified support marker prefix handling in `qisi-support-parser.js`.
- Updated the C9B fixture test to assert the repaired support behavior.
- PDF, OCR, AI, API, package scripts, real DOCX files, and `app.js` were not changed.

## Fix

- Question import now treats leading `[[IMAGE:...]]` placeholders as layout prefixes when detecting a DOCX question marker.
- Support parsing now treats leading `[[IMAGE:...]]` placeholders as layout prefixes before a support marker and answer label.

## Residual Risk

- The real files are image-heavy and still require manual review for unsupported media display quality.
- The repair is intentionally limited to marker ownership. It does not infer missing answer or solution content.

## Read-Only Revalidation Summary

- Question count: 12 (`1` through `12`).
- Answer count: 11; question `2` still has no parsed answer content.
- Solution count: 12.
- Option abnormalities: none detected.
- Unknown support blocks: none.
- Duplicate support blocks: none.
- Mojibake: none detected.
