# True Deterministic Import E2E Design R1

## Test classes

Existing tests are retained and renamed/described honestly as:

```text
seeded-review-ui-lifecycle
seeded-persistence
seeded-export-delete
```

They continue proving review/persistence behavior. They cannot satisfy the true
import gate because they seed IndexedDB drafts.

New tests must start at the real browser UI and never call `seedReviewBatch`:

```text
tests/e2e/true-import-docx.test.js
tests/e2e/true-import-pdf-safe-partial.test.js
tests/e2e/true-import-admission.test.js
```

## Test-only injection boundary

The app accepts a deterministic injected recognition/document transport through
the runtime dependency registry. The injection replaces only external I/O. It
must return a real `RecognitionCandidate` and may not seed drafts, bypass
validators, or write IndexedDB directly.

Allowed network destinations are `localhost` and `127.0.0.1`. The harness blocks
AI/OCR and every unapproved external request; any attempted request fails the
test. No real AI/OCR or private document is used.

## Required chain

```text
UI file selection
-> task/file creation
-> injected deterministic transport
-> RecognitionCandidate contract
-> parser/sequence/ownership validators
-> controlled-write or deterministic DOCX decision
-> validated review draft builder
-> repository draft persistence
-> browser review/edit/confirm
-> Formal Admission Policy
-> repository confirmDraftToQuestion transaction
-> reload/export/delete assertions
```

The harness captures stage events and asserts that each named production owner
was called for the current run. Source evidence uses references/hashes; exported
formal records must not contain raw model/private evidence.

## Scenarios

1. DOCX deterministic candidate reaches review and formal v2 admission after
   explicit confirmation.
2. PDF gap/partial result reaches review with missing fields and cannot formally
   submit until valid manual field revisions exist.
3. Raw JSON stem candidate fails schema validation before draft/formal write.
4. Question-number gap yields prefix/fail-closed; no later attachment appears.
5. Answer/solution rewind fails ownership and remains review-only.
6. Wrong ownership never appears in the formal question.
7. Rejected AI field plus click-only confirmation remains rejected.
8. Actual teacher rewrite creates a field revision and manual provenance, then
   admission succeeds if all required fields are valid.
9. Reload preserves schema v2 admission and field provenance.
10. Export omits raw evidence while preserving allowed source/admission audit
    metadata.

## Anti-false-positive rules

- No test helper may write draft/formal tables before the application path.
- No policy/controller validator may be mocked to `valid:true`.
- Tests assert database emptiness before starting and current-run IDs afterward.
- A browser page error, project console error, timeout, skipped assertion, or
  outside-network request fails the suite.
- Seeded and true-import test names/reports remain distinct.

## Acceptance evidence

The true E2E report must include run IDs, production stage trace, final formal
record/admission shape, zero direct-seed operations, zero real API calls, and
zero wrong attachment/fabricated question.
