# Counterfactual Attack Matrix R2

## Scope and evidence policy

Phase 3 attacks production owners and production-linked gates. OCR visual
attacks use synthetic transform descriptors and an injected loopback adapter;
they do not measure real OCR accuracy and do not call AI/OCR services. Raw
evidence remains attached to candidates, while only controlled-write plus
explicit manual confirmation can create formal data.

## Matrix

| Class | Attack vectors | Owner/gate | Expected result | Evidence |
|---|---|---|---|---|
| Runtime | missing script; dependency after app; misspelled namespace; duplicate owner; module 404; init throw | runtime dependency analyzer and `Qisi.Runtime.boot` | static startup rejection or visible escaped fatal error; no silent white screen | `qisi-runtime-dependencies.test.js`, `counterfactual-attack-suite.test.js`, browser startup E2E |
| Browser error attribution | project page/console failures versus extension injection | isolated Playwright context; page and console listeners | project errors fail the gate; the clean isolated context has no installed extensions | browser E2E harness and startup test |
| JSON/LaTeX | fence; trailing comma; single backslash; `\therefore` versus `\t`; nested/raw JSON; invalid surrogate; truncation; duplicate keys; huge response; malformed wrapper | support repair plus recognition schema | only known LaTeX commands receive narrow backslash repair; all other malformed candidates fail closed; raw wrappers fail schema validation and raw evidence is preserved | support-repair tests, recognition-contract tests, counterfactual suite |
| Number/ownership | `1,2,4`; `1,2,2,3`; `5,4,3`; `1,2,10,3`; answer 1-10/solution 1-2; rewind; missing answer; duplicate page | PDF support aligner and controlled-write | never full/reliable; safe prefix or fail-closed; manual review warnings | counterfactual suite plus Route-B/ownership gates |
| OCR image | rotation; perspective; low contrast; blur; two columns; watermark; handwriting; multiline formula; image-over-text; circled number; formula options; page shuffle | local OCR adapter and recognition contract | each result remains an isolated candidate with manual-review warning; no answer/provenance/write authority | counterfactual suite; synthetic-only, zero real API |
| Storage | quota; corrupt JSON; IndexedDB unavailable; refresh during write; double confirm; two tabs; delete-refresh; schema mismatch; missing image | storage repository/facade and atomic transaction | stable error; rollback; idempotency; optimistic conflict; soft-delete persistence; missing image remains explicit | storage failure/repository tests and counterfactual suite |
| Security | script/event/HTML; JavaScript URL; traversal filename; illegal MIME; oversized input; archive-bomb indicators; arbitrary local path; formula injection | escaped runtime/component rendering, KaTeX `trust:false`, safe filenames, loopback adapter, upload/import limits | markup does not execute; unsafe transport input rejected; no local path included in errors | counterfactual suite; backup/import limits remain a limitation below |
| Performance | 1,000 questions; 5,000 metadata; 100 images; long solutions/formulas; rapid switch/search; repeated export; import cancellation | library/export/import services and performance monitor | bounded deterministic query/export behavior; cancellation is explicit | large-dataset, performance-monitor, export/import and counterfactual tests |

## Results

- Attack suites added: one cross-owner suite, backed by the specialized runtime,
  contract, storage, E2E, ownership, performance, and no-real-AI gates.
- Failures found during Phase 3: none in the exercised production boundaries;
  three initial fixture assertions were corrected before the final run.
- Production fixes: none.
- Real AI/OCR calls: none.
- Formal-data writes from OCR candidates: none.

## Explicit limitations

- Synthetic transform descriptors prove candidate isolation, not recognition
  quality under real rotated, blurred, handwritten, or multi-column pages.
- The browser harness uses a fresh Playwright context without installed browser
  extensions. It captures project `pageerror` and console errors, but does not
  claim coverage of every third-party extension message format.
- Browser-side ZIP expansion does not yet expose reliable compressed versus
  uncompressed byte metadata through every supported JSZip path. Current file
  size, required-entry, schema, MIME, and missing-image gates reduce risk but do
  not constitute a complete ZIP-bomb detector. Treat archive-bomb hardening as
  a next-release security item; private/untrusted backup archives should not be
  imported in R2.
- Duplicate JSON keys are rejected when the surviving value violates the
  canonical schema; generic duplicate-key detection before `JSON.parse` is not
  claimed. No malformed candidate can bypass the later schema and
  controlled-write gates.

These limitations prohibit claims of real OCR improvement or complete hostile
archive support. They do not relax Route B, answer ownership, schema validation,
or controlled-write requirements.
