# Formal Question Transaction R1

## Owner and API

`qisi-storage-repository.js` owns:

```text
confirmDraftToQuestion(draftId, admissionDecision, options)
```

The repository receives injected `validateAdmissionDecision`,
`evaluateDraftAdmission`, and `buildQuestionV2` dependencies when created. It
must not reimplement policy rules.

## Required options

```text
expectedDraftVersion
idempotencyKey
actorId
requestId
imageRecords[]
```

Missing idempotency, actor, or expected version fails before mutation.

## Atomic sequence

The transaction covers `draftQuestions`, `questions`, `images`, and
`draftImportBatches`:

1. Read the draft inside the transaction.
2. Fail if missing, already submitted by another key, or stale by version.
3. Rerun Formal Admission against the fresh draft.
4. Validate caller decision against the rerun decision and current draft.
5. Build and validate a new immutable question v2 record.
6. Reject duplicate formal ID or conflicting idempotency ownership.
7. Write referenced image payloads.
8. Write the formal question.
9. Mark the draft `submitted`, record `submittedQuestionId`, admission decision
   ID, idempotency key, actor, request ID, and timestamp.
10. Update batch submitted counts/audit metadata.
11. Return a stable result only after transaction commit.

Any exception rolls back every write. No caller may pre-write images or mark the
draft before this transaction.

## Concurrency and idempotency

- Draft version is an optimistic concurrency token updated on every review edit.
- Repeating the same idempotency key returns the original committed question
  with `idempotent: true`.
- A different key against a submitted draft returns
  `draft-already-confirmed` and never creates another question.
- Two tabs race inside the same transaction boundary; exactly one commit wins.
- Duplicate formal IDs return `duplicate-id` without partial images/draft state.

## Stable result

```text
question
draftId
admissionDecisionId
idempotent
committedAt
requestId
```

## Stable errors

```text
draft-missing
draft-already-confirmed
draft-version-conflict
idempotency-required
idempotency-conflict
admission-invalid
admission-decision-stale
question-schema-invalid
duplicate-id
quota-exceeded
interrupted-write
write-conflict
```

All errors use the repository error envelope and include stage/operation details
without private content.

## Production migration

`app.js:submitDraftQuestion` may retain UI preparation, duplicate warning, and
error display, but must stop constructing/writing the formal transaction. Its
glue responsibility is:

```text
load current draft/version
request Formal Admission decision
call repository.confirmDraftToQuestion
refresh UI from committed result
```

Direct batch `db.questions.put` is forbidden after production wiring. Other
question write call sites are separately classified and are not mechanically
rewritten in this package.
