# OCR Measured Shadow Mode R1

## Isolation contract

```text
Current engine candidate -> unchanged production candidate
Candidate engine -> shadow candidate -> benchmark-only comparison
```

`runMeasuredShadow` passes `shadowMode=true` and `benchmarkOnly=true` to the
candidate engine. It returns the original production candidate object and a
separate shadow candidate/evidence object. The report fixes all of these to false:

- `defaultUiResult`
- `eligibleForReview`
- `eligibleForControlledWrite`
- `eligibleForFormalAdmission`
- `autoSelectWinner`
- `fieldMergeAllowed`
- `answerSupplementAllowed`

The report cannot write a question, update a draft, choose a winner, merge fields,
or supplement an answer. Conflict always requires a later manual/research review.

## Measurement and privacy

The metric allowlist contains only booleans/numbers for schema validity, counts,
duration, CER, formula F1, question recall, ownership accuracy, fatal safety count,
and manual correction cost. Unknown fields—including raw text and evidence—are
dropped. Delta values are calculated only when both sides contain finite numbers.

Candidate raw evidence remains in the separate in-memory candidate objects for
authorized analysis. It is never copied into the report or optional logger. Logs
allow only engine ids, requestId, status/code, and duration.

## Failure and fallback

An unavailable engine, timeout, malformed candidate, or measurement exception
sets `shadowStatus=failed`, retains a sanitized `failureCode`, sets
`fallbackToProduction=true`, and returns `shadowCandidate=null`. Cause messages and
private content are not propagated. The production candidate remains unchanged.

## Evidence status

- Implemented and unit-tested: yes.
- Browser-loaded scaffold: yes (existing R2 load order).
- Real shadow execution: no.
- Benchmark-measured on private corpus: no.
- Default UI or production engine change: no.
- Production-promoted: no.
