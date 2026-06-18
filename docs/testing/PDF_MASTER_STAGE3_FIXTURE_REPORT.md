# PDF Master Stage 3 Fixture Report

## Scope

Stage 3 added sanitized double-PDF surrogate coverage only. No production code, real PDF files, OCR output, API responses, or local test materials were modified or embedded.

## Added fixture

`tests/fixtures/pdf-real-case-minimal.js` contains only placeholder question records, support raw text pages, expected question numbers, and expected safe outcomes.

The fixture covers:

- an authoritative question contract `1-4`
- support raw text where question `2` has an answer marker but no usable answer body
- later support items `3-4` that must not be attached after the unsafe gap
- a parser-vs-legacy disagreement shape where parser evidence is only a safe prefix

## Added tests

`tests/pdf-real-case.test.js` verifies:

- parser + aligner keep only question `1` as a safe prefix for the missing-answer support shape
- unsafe tail questions are surfaced as fused warning targets
- `buildPdfSupportParserGate` reports the stricter parser prefix
- field-level controlled write keeps parser fused warnings visible and does not allow parser evidence to expand unsafe ownership

## Safety notes

The fixture is intentionally synthetic and sanitized. It does not contain:

- original PDF content
- raw OCR text from real files
- image data or file bytes
- API keys or API responses
- material copied from `local-test-materials`

## Stage 4 need

Stage 4 is still needed to run the broader mock-fix gate. If these tests pass without code changes, Stage 4 should record that no mock safety repair was required before controlled real validation preparation.
