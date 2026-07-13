# Program C C2-12 Wave 14 ReviewDraft Command/Persistence Report

## Decision

`REVIEW_DRAFT_COMMAND_PERSISTENCE_BOUNDARY_ACCEPTED`

Wave 14 was applicable. The production inventory found reachable direct
ReviewDraft writes in `app.js`: initial batch/file creation, single-draft
updates, draft status changes, image confirmation/deletion/binding/cropping,
unassigned-image deletion, batch-stat refresh, duplicate marking, cleanup, and
ReviewDraft reads used by review/formal UI commands.

## Final production boundary

```text
normal review UI command
  -> app.js command mapping and visible error recovery
  -> DraftPersistenceService
  -> StorageRepository transaction
  -> repository/service readback
  -> Vue review projection
```

`app.js` now has zero `db.draftImportBatches`, `db.draftImportFiles`,
`db.draftQuestions`, or `db.draftImages` references and zero draft-table Dexie
transactions. It does not fall back to the old database path after a command
failure.

## Owner changes

- `DraftPersistenceService.createDraftBatch` validates batch/file association,
  delegates the two-table atomic create, and verifies repository readback.
- `DraftPersistenceService.persistReviewDraftCommand` owns optimistic draft
  versioning, submitted-draft immutability, idempotency, image-to-draft
  association, full ReviewDraft transaction delegation, and readback matching.
- `DraftPersistenceService.persistReviewImageCommand` owns image-only optimistic
  updates and prevents an image-status command from changing ownership.
- `StorageRepository.createDraftBatch` owns the batch/file transaction and
  duplicate check.
- `StorageRepository.persistReviewDraftBatch` now rechecks the expected batch
  persistence version inside the transaction. A race therefore fails closed
  before any table replacement instead of relying only on an earlier service
  read.
- The existing whole-batch persistence, reload, and delete owners remain the
  only production paths. No second ReviewDraft schema or service was added.

The shell retains only visible form-to-command mapping, editor/crop interaction,
success UI mapping, and failure recovery. On persistence failure it reloads the
stored ReviewDraft/editor state, displays the stable error code, and returns a
failed command result. An unsaved editor command that fails cannot continue
into Formal Admission.

## Failure-first and transaction evidence

`tests/review-draft-command-persistence-boundary.test.js` began at `0/6` because
the command APIs did not exist and the shell still contained direct draft-table
access. It finishes at `6/6` and covers:

- atomic create plus duplicate rejection;
- draft/image commit and readback;
- update version and idempotent replay;
- stale version, malformed association, duplicate image ID, missing repository,
  and submitted-draft rejection;
- cancellation before write;
- injected transaction interruption with full rollback;
- image-only optimistic update;
- reload and idempotent delete;
- preservation of the formal `questions` table;
- static absence of direct ReviewDraft database access in `app.js`.

`tests/e2e/review-draft-command-ui-recovery.test.js` injects a persistence
failure through the real browser AppProxy route. The database remains on the
original draft, no formal question is written, the editor is restored from
readback, and a visible `DRAFT_PERSISTENCE_WRITE_FAILED` message is rendered.
The seeded reload test now explicitly waits for the async atomic commit/readback
before initiating browser navigation; its content assertions are unchanged.

## Regression evidence

- focused persistence/storage/architecture target: `31/31`;
- Wave 14 command boundary: `6/6`;
- normal-UI production browser canary: `1/1`, all `15/15` scenarios;
- seeded edit/confirm/formal lifecycle: `1/1`;
- seeded commit/reload lifecycle: `1/1`;
- command failure UI recovery: `1/1`;
- `verify:safe`: `1585/1585`, 54 suites;
- Base Migration: `15/15`;
- Route B hold: `6/6`;
- batch mock: `20/20`;
- PDF known-bad: `65/65`;
- controlled-write answer ownership: `21/21`;
- DOCX stable: `20/20`;
- preflight and dry-run: passed with a real browser;
- `realApiCalled=false`, `underlyingApiCallCount=0`;
- failed, cancelled, skipped, todo, and timeout: `0`.

No `real-run` or real AI/OCR endpoint was used. The six frozen PDF high-risk
owners are outside the diff.

## Shell metrics and next boundary

After Wave 13, `app.js` had 16,144 lines. Wave 14 ends at 16,286 lines and 363
inventoried functions; the largest function remains
`recognizeExamPageStructuredWithQwen` at 239 lines. The 142-line increase is
the explicit replacement of terse direct Dexie calls with UI command mapping,
failure recovery, optimistic-version inputs, and readback projection. No new
business function exceeds the 250-line ceiling.

The next action is the independent conditional Wave 15 inventory for manual
field editing, provenance construction, review validation, duplicate policy,
and Formal Admission lifecycle ownership. Wave 14 does not pre-accept that
separate boundary.
