# Program C C2-12 Wave 17 Storage and Formal Repository Report

## Decision

`APP_STORAGE_FORMAL_REPOSITORY_BOUNDARY_ACCEPTED`

Wave 17 was applicable. The shell still called the formal question repository
for create, edit, delete, and migration operations; external-library merge and
undo also owned a `questions` transaction, snapshots, and rollback loops. The
manual-entry path wrote image blobs before the question, so a later failure
could leave partial data.

## Final boundary

```text
app UI command
  -> LibraryService
  -> StorageRepository transaction/readback
  -> Dexie tables

ReviewDraft formal-submit command
  -> Formal Admission
  -> StorageRepository.confirmDraftToQuestion
```

`qisi-library-service.js` now owns bounded question save, replace, soft-delete,
safe LaTeX migration, external merge, latest reversible merge lookup, and
external merge undo commands. `app.js` only constructs UI command payloads,
refreshes committed readback, and displays errors.

- manual question and image records commit in one repository transaction;
- edited question and new image records commit atomically with an expected
  `updatedAt` version;
- migration uses version-aware repository updates and preserves soft-delete
  state;
- external add/fill/skip operations, source statuses, and the merge audit
  record commit in one transaction;
- undo deletes additions, restores filled snapshots and source statuses, marks
  the merge reverted, and verifies readback in one transaction;
- duplicate command IDs, duplicate question IDs, stale targets, malformed
  commands, missing sources, and interrupted writes fail without residue.

## Static and reachability audit

Final `app.js` results:

- direct `db.questions` mutation: `0`;
- direct formal repository mutation call: `0`;
- transaction containing `db.questions`: `0`;
- direct draft-table transaction business logic: `0`;
- external-merge rollback fields or loops: `0`;
- direct question migration mutation: `0`;
- hidden compatibility formal write: `0`;
- Bridge formal writes: `0`.

Two direct `db.questions.toArray()` reads remain in unrelated read-only LaTeX
audit and metadata-backup tools. One dynamic `db.table(name).count()` remains
in the read-only Stage-0 diagnostic. Three Dexie transactions remain in the
unrelated G-class external-package staging/delete/recalculate feature and touch
only `importBatches`, `externalQuestions`, and `images`; they do not touch
formal or draft tables. Wave 18 must keep these classified as G and must not
delete the feature merely to reduce a lexical count.

The production ReviewDraft-to-formal path remains Admission then Repository.
The Bridge still stops at review persistence and cannot write a formal record.
Manual entry and external library management remain separately classified G
features; this Wave changes their persistence ownership, not their product
semantics or the import admission policy.

## Verification evidence

- focused storage/Formal Admission/repository set: `58/58`;
- storage boundary target including legacy boundary update: `9/9`;
- normal-UI production browser canary: `1/1`, all `15/15` scenarios;
- true-import browser set: `6/6`;
- `verify:safe`: `1614/1614`, 54 suites;
- Base Migration: `15/15`;
- Route B hold: `6/6`;
- batch mock: `20/20`;
- PDF known-bad: `65/65`;
- controlled-write answer ownership: `21/21`;
- DOCX stable: `20/20`;
- preflight and dry-run: passed with a real browser;
- `realApiCalled=false`, `underlyingApiCallCount=0`;
- failed, cancelled, skipped, todo, and timeout: `0`.

The tests cover admission accept/reject, malformed decisions, duplicate IDs,
readback, stale writes, transaction interruption, rollback, Blob preservation,
soft-delete preservation during migration, and Bridge/formal-write isolation.
No real AI/OCR endpoint, `real-run`, production-data mutation, force, reset,
pull, or rebase was used. All six frozen PDF high-risk files remain outside the
diff from the Wave 16 commit.

## Shell metrics and next boundary

Wave 16 ended at 13,226 `app.js` inventory lines and 305 functions. Wave 17
ends at 13,167 lines and 305 functions. The largest function remains the
unrelated 164-line `startExamPointerDrag`; the largest remaining Program C
function remains the 146-line `extractTextFromDraftFile`. No function exceeds
the 250-line ceiling.

Wave 18 is the next independent C2-12 final reachability, responsibility,
browser, and metric audit. This decision does not pre-accept Wave 18 or C2-12.
