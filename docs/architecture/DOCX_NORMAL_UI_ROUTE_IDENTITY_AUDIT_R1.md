# DOCX Normal-UI Route Identity Audit R1

## Scope and baseline

- repository: `C:\Users\Administrator\Desktop\题库系统`
- branch: `stage/app-shell-slimming-r3`
- audited commit: `82f44d5bfc12983e1467151ec600d95b2b7c61fb`
- working tree at audit start: clean
- audit mode: read-only production call-graph and schema inspection
- production code changed during fact audit: no

This audit traces one real DOCX question source from the ordinary browser UI to
review-draft persistence and compares that route with the current Bridge
scaffold. It does not resume Phase 5 and does not enter C2-11.

## Finding

Root-cause classification: **C — intentional legacy visual route**.

The normal UI correctly classifies a `.docx` file as `docx`. It is not changed
to PDF by the upload fixture, MIME value, `BatchContextService`, or
`SourceRoleClassifier`. The legacy production owner subsequently and
deliberately selects DOCX-to-PDF strict vision as the first and mandatory
question producer. A successful visual result immediately leaves the file loop;
a visual failure is rethrown. The later XML importer block is therefore not a
normal fallback for a DOCX question source.

The Bridge scaffold selects the DOCX route and invokes its deterministic
`runDocxImport` port. The two paths first diverge at field production, before
normalization, review-draft construction, or persistence.

## Normal UI production call graph

### 1. File selection and type identity

```text
batch file input / drop
→ queueBatchFiles
→ FileDispatcher.getFileType(file.name)
→ pendingPurposeFile.fileType = "docx"
→ confirmBatchFilePurpose
→ batchCreateFiles
```

- `qisi-file-dispatcher.js:9` derives the upload type from the filename
  extension. `.docx` and `.doc` map to `docx`; `.pdf` maps to `pdf`.
- `app.js:575`, `app.js:600`, and `app.js:623` store that result as the file
  record's explicit `fileType`.
- Browser `File.type` / MIME is not consulted by this route selector.
- The role modal at `app.js:667` assigns `question`, `answer`, `solution`, or
  `full`; it does not change the file type.

### 2. Batch and source classification

```text
createDraftImportBatch
→ persist draftImportBatches + draftImportFiles
→ runBatchRecognition
→ LegacyBatchRunCoordinator
→ processDraftImportBatch
→ BatchContextService.loadBatchAndFiles
→ SourceRoleClassifier.classifySourceRoles
```

- `app.js:1103` creates the batch.
- `app.js:1124` derives only the batch-level `sourceType`; the per-file
  `fileType` remains `docx`.
- `app.js:1161` schedules normal recognition.
- `app.js:179–200` selects `processDraftImportBatch` when no
  `InjectedImportTransport` exists.
- `qisi-batch-context-service.js:43–45` prefers the stored explicit
  `fileType`; extension inference is only the fallback when that value is
  absent.
- `qisi-batch-context-service.js:71–76` carries `docx` into the immutable
  source manifest.
- `qisi-source-role-classifier.js:21` classifies roles but preserves the source
  type. It does not convert DOCX into PDF.

### 3. Legacy route and engine selection

```text
processDraftImportBatch
→ file.fileType === "docx" && hasQuestionRole
→ processDocxByLocalConvertAndStrictVision
→ extract authoritative DOCX question-number skeleton
→ convertDocxRecordToPdfRecord
→ virtual fileType = "pdf"
→ processStrictVisualQuestionFile
→ PDF.js page rendering
→ strict page Qwen/vision recognition
→ reconcile visual questions with DOCX skeleton
```

- The owner starts at `app.js:15549` and classifies sources at
  `app.js:15582`.
- The unconditional DOCX question branch starts at `app.js:16229` and invokes
  the converter/vision owner at `app.js:16238`.
- `processDocxByLocalConvertAndStrictVision` is declared at `app.js:11200`.
- The virtual converted record is explicitly assigned `fileType: 'pdf'` by
  `convertDocxRecordToPdfRecord`; this is an internal recognition adapter, not
  an upload or fixture classification.
- Accepted items receive
  `sourceTrace.source = 'docx-local-convert-pdf-strict-vision'` at
  `app.js:11560`.
- Success executes `continue`; failure is rethrown at `app.js:16348`.

Consequently, the later `ProductionDocxSourcePort.parseDocxSource` call at
`app.js:17139` is unreachable for an ordinary DOCX question/full source after a
successful visual run, and it is also unreachable after a failed visual run
because that failure is rethrown. It is residual fallback-shaped code, not the
active producer for this case.

### 4. Normalization, review draft, and persistence

```text
strict visual recognition items
→ mergeDraftRecognition
→ batch dedupe / clean / normalize gates
→ sourceTrace attachment and visual warnings
→ ReviewDraftState image-token projection
→ DraftPersistenceService.persistReviewDraftBatch
→ StorageRepository.persistReviewDraftBatch
```

- At `app.js:17490–17535`, normalization preserves raw evidence and attaches
  the legacy source trace; it does not create canonical route identity.
- PDF candidates alone enter `PdfCandidateProjection` at
  `app.js:17886–17914`.
- DOCX legacy drafts bypass that projection and are persisted at
  `app.js:18001`.
- `ReviewDraftBuilder` and `DraftPersistenceService` copy or persist supplied
  fields. Neither is a legitimate producer of missing DOCX provenance.

## Bridge scaffold call graph

```text
ProductionImportBridge
→ BatchContextService.loadBatchAndFiles
→ SourceRoleClassifier.classifySourceRoles
→ sourceRoute = "docx"
→ deterministic-source-loaded
→ runDocxImport
→ DocxImportCoordinator
→ ProductionDocxSourcePort.parseDocxSource
→ QisiBatchImporter.parseDocxFile (Word XML)
→ candidate normalization
→ validation
→ ReviewDraftBuilder
→ DraftPersistenceService
```

- `qisi-production-import-bridge.js:80–129` chooses exactly one homogeneous
  `docx` or `pdf` route from classified sources.
- The DOCX transition is `deterministic-source-loaded` at
  `qisi-production-import-bridge.js:315–316`.
- `qisi-production-docx-source-port.js:15` invokes the provided DOCX importer
  and filters its produced drafts.
- `qisi-batch-importer.js:856` reads `word/document.xml`; it does not convert
  the DOCX source to PDF.
- The current application does not instantiate `ProductionImportBridge`; it is
  still a scaffold. `processDraftImportBatchV2` is a non-default precursor, not
  the normal UI owner.

## First legacy/Bridge divergence

The first semantic divergence is the producer selection after both paths have
already agreed that the source is a DOCX question source:

| Stage | Legacy normal UI | Bridge scaffold |
| --- | --- | --- |
| Source identity | `docx` | `docx` |
| Role identity | question/full | question/full |
| First field producer | converted-PDF strict vision | Word XML importer |
| Producer evidence | visual page/model trace | XML block/media trace |
| Active fallback | none; visual failure rethrows | none in Bridge owner |

This rules out upload, MIME, extension, and role-classification errors.

## MIME and fixture audit

- Correct DOCX MIME plus `.docx`: classified as DOCX because `.docx` controls
  the UI selector.
- Missing MIME plus `.docx`: still classified as DOCX.
- Incorrect MIME plus `.docx`: still classified as DOCX and cannot enter the
  PDF upload route.
- The real Phase 5 fixture retained `fileType='docx'` through the source
  manifest and reached the authoritative DOCX skeleton gate.
- `tests/e2e/browser-harness.js` did not create the PDF identity. The conversion
  happens later inside `processDocxByLocalConvertAndStrictVision`.

Conclusion: there is no fixture/harness misclassification.

## Hidden PDF/vision adapter

An internal adapter exists and is production-active:

```text
DOCX record
→ convertDocxRecordToPdfRecord
→ convertedFromDocx=true
→ fileType="pdf"
→ strict PDF-page vision engine
```

It is explicit in code and diagnostics, but its route identity is not represented
by the canonical admission schema. The final DOCX review draft retains only
legacy `sourceTrace` evidence.

## Actual `source.mode` production points

- `PdfCandidateProjection` constructs canonical PDF source mode for PDF
  candidates.
- `BatchFormalSubmit` reads an existing `draft.source.mode`; it does not create
  a route mode.
- `FormalAdmissionPolicy` validates a supplied mode; it does not infer one.
- Neither `QisiBatchImporter.parseDocxFile` nor
  `normalizeDocxImporterDraftForV2` creates the canonical DOCX `source` object.
- Bridge tests hand-author `source.mode='docx-deterministic'` in fixtures; that
  is not a production producer.
- The legacy DOCX vision path creates no canonical `source.mode`.

## Actual `fieldProvenance` production points

- `PdfCandidateProjection` owns PDF field provenance construction from real
  controlled-write and evidence results.
- `BatchFormalSubmit.buildManualFieldProvenance` may mark a specific field
  manual only after an actual user edit.
- Formal Admission validates supplied provenance and fails closed when it is
  missing.
- The XML DOCX importer produces field values and block/media trace, but no
  canonical per-field provenance.
- The legacy DOCX vision producer also creates no canonical per-field
  provenance.
- Review and persistence layers do not construct provenance, which is correct;
  post-hoc construction there would be forbidden.

## Fallback audit

### Legacy normal UI

The visual path is primary, not a fallback:

- deterministic import is not tried first;
- visual success exits the file loop;
- visual failure rethrows;
- no explicit deterministic-to-vision route transition exists.

### Non-default V2 precursor

The non-default V2 code begins with the XML importer and may attempt visual
enhancement when formula/image placeholders are detected. That path is not the
normal UI route and does not solve this package:

- it is not called by `runBatchRecognition`;
- its visual enhancement has no canonical DOCX-AI source mode;
- its merge does not establish per-field producer provenance;
- promoting it would change the normal UI production owner, which is prohibited
  in this package.

## Schema capability and stop condition

`FormalAdmissionPolicy.ADMISSION_MODES` contains only:

- `manual`
- `docx-deterministic`
- `pdf-ai`
- `imported-package`

There is no legal mode for a DOCX source whose fields are produced by converted
PDF vision. `docx-deterministic` would be false. `pdf-ai` would also be false as
a source identity and additionally requires real controlled-write evidence that
the legacy DOCX visual path does not produce.

Therefore the package has reached its explicit C-case stop condition: the
current schema cannot truthfully represent the active route. Adding a broad
default, inferring provenance from the final draft, weakening validation, or
switching the production owner is forbidden.

## Root-cause decision

- A — route bug: **no**. The active legacy code intentionally says
  `docx-local-convert-first` and exits after visual success.
- B — fixture/MIME bug: **no**. The file remains DOCX through upload,
  persistence, batch context, and role classification.
- C — intentional legacy visual route: **yes**.
- D — deterministic then implicit visual fallback: **no** for the normal UI.
  The deterministic producer is not tried first.

Final audit classification:

`C_INTENTIONAL_LEGACY_DOCX_VISION_ROUTE_WITH_NO_LEGAL_CANONICAL_MODE`

Corrective implementation decision:

`BLOCKED_BEFORE_CODE_CHANGE`
