# Production Import Bridge Cutover Contract — C2-11

## Baseline and intent

Baseline commit: `c77523c590b424a9c7f011ae2c0881ca8188f69a`.

The production Bridge is the single import coordinator after C2-11. The normal
UI controller may translate UI state, but it may not classify sources, run an
engine, validate candidates, build ReviewDraft records, or persist drafts.

## Explicit execution mode

Every Bridge command carries one of these literal modes:

- `shadow`: execute isolated producer/projection/comparison work, write no
  ReviewDraft, formal question, progress state, failure state, or user-visible
  Vue state.
- `production`: load the real batch context, execute the real source producer,
  normalize/project/validate/build, commit through the unique draft persistence
  owner, verify readback, then return the review view model.

Missing or unknown mode is `PRODUCTION_IMPORT_MODE_REQUIRED`. Mode is never
inferred from a callback, repository presence, browser detection, a catch
branch, or a test fixture.

## Production command

Required stable input:

```text
mode = production
batchId
requestId
expectedSourceVersion
producerRoute (docx-vision or pdf)
AbortSignal
```

The normal UI derives `producerRoute` from its real route selection before the
engine runs. A DOCX file cannot be relabelled as PDF, deterministic output
cannot be relabelled as vision, and a result cannot retroactively select its
own producer identity.

Required port sequence:

```text
loadBatchAndFiles
classifySourceRoles
run truthful DOCX-vision or PDF coordinator
normalizeCandidates
projectImportOutput
validateCandidates
buildReviewDrafts
persistReviewDraftBatch
reloadDraftBatch
verify transaction/readback
return WAITING_CONFIRMATION review model
```

The PDF route always calls the unique PDF candidate projection owner with the
real parser/aligner/controlled-write outputs. The DOCX vision route always
calls the unique DOCX producer identity/provenance owner with the real strict
producer decision. Missing producer-time evidence fails closed.

## Success contract

Success is returned only when all conditions hold:

1. the state machine reaches `WAITING_CONFIRMATION` through the legal ordered
   states;
2. validation accepted every returned review candidate;
3. the ReviewDraft transaction committed atomically;
4. readback contains the same batch, draft identities, source identities, and
   draft count;
5. the batch readback status is `review`;
6. cancellation is not set;
7. the controller installed the returned review model;
8. no formal-question write occurred.

The UI must not display success before readback and view-model installation.

## Failure contract

The Bridge fails with a stable sanitized code for missing source context,
producer identity, source mode/format, controlled-write evidence, validator,
persistence or readback port, transaction/readback mismatch, cancellation,
duplicate conflict, stale source version, unsupported/mixed route, malformed
producer result, or incomplete production dependency injection.

On every failure:

- no call is made to the legacy owner;
- no second source producer is attempted;
- no validator/comparator field is ignored;
- transaction rollback remains the persistence owner's responsibility;
- the controller clears busy state and maps only a stable UI-safe message;
- raw stack, source text, model JSON, base64, keys, and temporary paths are not
  returned to the UI.

## Idempotency and retry

`requestId` is stable for a batch source version. The persistence command uses
that identity. If a transaction committed but the UI response was lost, a
retry with the same request identity verifies the existing transaction by
readback and returns the same review model without running a second producer or
creating another version. A different payload under the same identity is an
idempotency conflict.

An in-memory controller lock blocks duplicate clicks during an active request;
the persistence owner remains the durable authority across reloads and tabs.

## Authority boundaries

The Bridge and normal UI controller have no authority to call Formal Admission,
write `questions`, auto-confirm a draft, infer manual provenance, repair a
controlled-write rejection, or select Route B. ReviewDraft persistence is the
terminal production action. Formal submission remains a later explicit user
operation behind the existing Formal Admission owner.

## Retirement condition

The cutover is complete only when runtime browser evidence records:

```text
ProductionImportBridge production calls > 0
legacy production calls = 0
legacy fallback calls = 0
normal UI review successes > 0
Bridge formal writes = 0
```

Static searches support, but do not replace, that runtime proof.
