# ADR-006 — app.js Slimming R2

## Context

app.js is 22,044 lines and owns business detail.

## Decision

Shrink responsibility through domain-by-domain, tests-first extraction; line count is secondary to ownership.

## Alternatives

Mechanical file splitting; framework rewrite; leave all legacy logic.

## Consequences

New business logic stops accumulating and modules become testable.

## Risks

Reactive closure coupling makes some extractions unsafe.

## Compatibility

Vue state and public behavior remain; glue is minimal.

## Rollback

Revert one domain commit; never keep duplicate owners.

## Tests

Production-linked, runtime, browser, and mandatory gates after each domain.

## Migration sequence

Storage, library, review, export, import; stop where proof is insufficient.
