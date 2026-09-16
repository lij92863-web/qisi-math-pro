# DOCX / PDF ingestion audit and execution plan

## Authority and scope

The owner's 2026-09-16 instruction authorizes continuous independent audit, implementation,
verification, optimization and local real-material acceptance on `codex/integration-main-hardening`.
It supersedes the obsolete C8A task and per-stage stopping rules. Preserve pre-existing `artifacts/`.
Never merge main, delete real data, migrate irreversibly, upload real materials, or incur unauthorized
paid API charges. Use isolated browser profiles for acceptance; never touch the teacher's live DB.

Allowed: ingestion-related `qisi-*.js`, small orchestration changes in `app.js`, module loading in
`main.html`, relevant tests/scripts, exact-content seal register, and integration reports.
Forbidden: secrets, dependency lockfile, real material edits, formal-admission bypasses, unrelated UI
or persistence changes. Local evidence belongs under untracked `artifacts/`, never staged.

## Independently established baseline

- Local and fetched integration HEAD: `4ced38ec11468e875a2fb93efe7be4eb18ffe59d`.
- Fetched main: `b15e6fbe24c525c95a573b51a0c7ab68e77f4790`.
- Only initial untracked path: `artifacts/`.
- Baseline `verify:safe`: 1349 tests pass; batch smoke 20 pass; no-real-AI check passes.
- Material inventory: 13 DOCX and 3 PDF files. All remain local.
- Confirmed: ordinary question DOCX tries conversion/vision before deterministic extraction.
- Confirmed: support DOCX also tries vision first outside cheap mode.
- Confirmed: text, skeleton, importer and image collection each independently open the DOCX ZIP.
- Confirmed: importer rendering does not use the app's MTEF extraction context.
- Confirmed: `repairDraftAnswersByOrder` writes by array position without proof of identity;
  `repairDraftAnswersWithQwen` explicitly allows index alignment.
- Confirmed: PDF page processing renders pages before inspecting text and uses page vision by default.
- Handoff hypotheses NOT accepted as facts: the earlier 240-second hang and numeric control IDs.
  Later repository records attribute the former to an unhandled confirmation dialog and the latter
  to incorrectly bounded XML text-element matching. Re-measure rather than re-fix them.

## Actual baseline call graphs

DOCX: UI -> createDraftImportBatch -> processDraftImportBatch ->
processDocxByLocalConvertAndStrictVision -> importer skeleton (ZIP) -> local health/convert ->
strict page vision. On failure -> extractTextFromDraftFile (ZIP, rels, media, OLE/MTEF) ->
skeleton again -> parseDocxFile (another ZIP, media and separate parser), or local text splitter ->
support merge -> optional order/AI repair -> review validator -> draft DB -> review.

PDF: same batch coordinator -> processPdfFilePageByPage -> renderPdfFilePages ->
page vision / support vision -> number/sequence gates -> field-controlled support write ->
shared candidate merge -> draft validation -> review. Separate text/layout extraction exists but
is not the first step in this production path. Formal admission remains the existing later gate.

## Execution plan and verification

1. Record baseline runtime, material inventory and independent source observations.
2. DOCX: share extraction context, use the existing MTEF-aware local reader first, collect timings,
   remove automatic conversion and model dependency, preserve support anchors and partial results.
3. Eliminate order-based authoritative repair and preserve unmatched support evidence.
4. PDF: inspect text and geometry before recognition; classify usable/mixed/scanned pages;
   share single/dual-file evidence flow and constrain unresolved regions, caching and timeouts.
5. Add targeted synthetic regression tests, run `verify:safe` and batch safety gates.
6. Re-run all real DOCX groups and PDFs in isolated browser sessions with paid endpoints blocked;
   render originals locally and compare actual review output question by question.
7. Report concrete coverage, withheld fields/items, costs, timing, limitations and merge readiness.
   Do not equate tests passing with real-material acceptance.

## app.js boundary

Changes are necessary at `processDraftImportBatch`, the DOCX extraction loader, and PDF orchestration
entry points: modules cannot change which branch the coordinator enters. Keep parsing/inspection/
timing algorithms in focused modules. Replace obsolete glue instead of adding another parser.
Expected net app.js line count decreases; do not raise size ceilings. Tests include actual browser
imports, MTEF/OMML fixtures, support identity conflicts, PDF known-bad cases and safe full gates.

The existing seal test compares both HEAD and working content to one hash, which cannot validate
a reviewed change before committing it. Make it validate the actual working file's Git blob and
normalized content hash against the exact reviewed register; unapproved files remain sealed.
This closes the pre-commit check gap without reducing content protection.
