# Program C C2-12 Wave 15 Manual Review Provenance/Formal Lifecycle Report

## Decision

`MANUAL_REVIEW_PROVENANCE_FORMAL_LIFECYCLE_ACCEPTED`

Wave 15 was applicable. The production shell directly replaced
`fieldProvenance`, `BatchFormalSubmit` exposed a manual-provenance constructor,
and `ReviewController.confirm()` marked an untouched draft globally edited.
Image crop/bind/delete commands also changed formal `stem`/`images` values
without a review command owning the corresponding manual evidence.

## Final production boundary

```text
explicit review edit command
  -> ReviewController changes only named fields
  -> ReviewController replaces provenance only for changed formal fields
  -> DraftPersistenceService / StorageRepository persist the ReviewDraft

explicit confirmation
  -> production review validation
  -> review status/manualConfirmed only

formal submit command
  -> Formal Admission policy decision
  -> accepted decision only
  -> formal repository transaction
```

Review edit is not Formal Admission, Formal Admission is not repository
commit, and the repository command is reached only after an accepted decision.
`ProductionImportBridge` remains ReviewDraft-only and performs zero formal
writes.

## Owner closure

- `ReviewController.editField`, `editFields`, and `markFieldsManual` are the
  unique manual field-provenance commands. They preserve every untouched field
  entry exactly, retain the original `sourceId`, and increment only the named
  field revision.
- `ReviewController.confirm` now changes review status, confirmation evidence,
  and timestamps only. It does not invent `userEdited`, `manualEdited`, or
  per-field manual evidence.
- Provenance display derives manual state from field evidence rather than
  global draft flags.
- The shell delegates answer/solution/type input, editor stem/options changes,
  question-number-capable generic edits, and image crop/bind/delete changes to
  explicit review commands. It has no `fieldProvenance =` assignment or manual
  provenance constructor.
- `BatchFormalSubmit` now exposes only `submit`. Manual provenance construction
  and draft-version helpers were removed from the Formal Admission owner.
- An external cancellation observed before the repository transition moves the
  lifecycle from `FORMAL_ADMISSION` to `CANCELLED`, raises the stable
  `FORMAL_SUBMIT_CANCELLED` error, and performs zero formal writes. Once the
  repository transaction starts, the command does not falsely report a
  cancellation after commit.

## Failure-first and lifecycle evidence

`tests/manual-review-provenance-formal-lifecycle.test.js` began with all five
original boundary cases failing. It finishes at `6/6` and covers:

- a single answer edit changing only answer provenance;
- untouched controlled-write evidence remaining byte-for-byte equivalent;
- multi-field editor commands and v-model-originated explicit edits;
- question-number and image edit provenance;
- click-only confirmation preserving global flags and all field evidence;
- cancellation after policy evaluation with repository writes equal to zero;
- static absence of shell provenance construction and direct formal DB writes.

Existing Formal Submit state-machine tests retain accepted, admission-rejected,
repository-failed, and retry-safe separation. Existing repository concurrency
tests retain idempotent duplicate confirmation and two-tab conflict behavior.
The import state-machine contract now explicitly includes the cancellable
`FORMAL_ADMISSION -> CANCELLED` edge.

The real-browser true-import suite adds an untouched PDF confirmation case. It
starts at the normal UI import entry, confirms without editing, proves the
stored ReviewDraft retained all controlled-write evidence and no global manual
flags, then completes Formal Admission and repository insertion. The existing
teacher rewrite case proves only the edited rejected answer becomes manual
while the untouched stem remains controlled-write.

## Regression evidence

- focused Wave 15/state/browser target: `35/35`;
- Wave 15 boundary file: `6/6`;
- true-import browser suite: `4/4`;
- normal-UI production browser canary: `1/1`, all `15/15` scenarios;
- `verify:safe`: `1592/1592`, 54 suites;
- Base Migration: `15/15`;
- Route B hold: `6/6`;
- batch mock: `20/20`;
- PDF known-bad: `65/65`;
- controlled-write answer ownership: `21/21`;
- DOCX stable: `20/20`;
- preflight and dry-run: passed with a real browser;
- `realApiCalled=false`, `underlyingApiCallCount=0`;
- failed, cancelled, skipped, todo, and timeout: `0`.

No real AI/OCR endpoint, `real-run`, force/reset/pull/rebase command, or
production-data mutation was used. The six frozen PDF high-risk files remain
outside the diff and pass their byte-identity gate.

## Shell metrics and next boundary

Wave 14 ended at 16,286 `app.js` lines and 363 inventoried functions. Wave 15
ends at 16,301 lines and 362 functions; the removed app-local provenance helper
reduces the owner count by one. The largest function remains
`recognizeExamPageStructuredWithQwen` at 239 lines. The small line increase is
explicit image/editor command mapping and does not add a new domain owner or a
function above the 250-line ceiling.

Wave 16 remains an independent conditional audit of reachable OCR/Vision
transport and producer ownership. This decision does not pre-accept it.
