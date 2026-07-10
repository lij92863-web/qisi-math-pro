# Production Test Link Audit R2

## Scope

All 68 baseline tests were scanned for locally declared helpers, parser/repair names, source-only assertions, mocked safety owners, and skip/todo markers.

## Findings

| Finding | Classification | Action |
|---|---|---|
| `tests/support-repair.test.js` contained a complete copy of the JSON/LaTeX backslash repair algorithm from app.js | confirmed duplicate production implementation | moved the owner to `qisi-support-repair.js`; tests now import it; app delegates |
| `tests/batch-smoke-mock.test.js` defines scenario merge helpers | harness orchestration, not parser/aligner/controlled-write implementation | retain temporarily; it imports and executes all three real safety owners; product E2E remains required |
| `tests/pdf-answer-only-ai-pass.test.js` contains a Route B research schema validator | research-only artifact, not production evidence | keep frozen/research-only; excluded from any production acceptance claim |
| migration tests inspect app.js/main.html source | architectural/call-site guards only | retain, but never count them as behavioral proof |
| fixture-coverage tests contain literal `.skip`/TODO strings | negative fixture data, not skipped tests | retain |
| review-state tests inject small callbacks | dependency injection into the production module | retain; callbacks do not replace controlled-write |

## Production linkage

- PDF support parser tests require `qisi-pdf-support-block-parser.js`.
- Alignment tests require `qisi-pdf-support-aligner.js`.
- Ownership tests require `qisi-pdf-support-controlled-write.js`.
- Support repair tests require `qisi-support-repair.js`.
- Batch smoke imports the real parser, aligner, and controlled-write owners.
- The new guard rejects reimplementation of named high-risk owners inside tests.

## Remaining gaps

The batch smoke harness is not browser product acceptance and does not exercise the full Vue upload/persistence/export path. WP2C must cover that path. Some legacy app helpers lack direct-name tests; they are not extraction candidates until a dedicated package adds production-linked coverage.

## Safety conclusion

Controlled-write is not mocked for safety acceptance. The repaired duplicate no longer exists in tests. Route B remains research-only.
