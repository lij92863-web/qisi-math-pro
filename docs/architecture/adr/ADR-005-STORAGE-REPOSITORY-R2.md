# ADR-005 — Storage Repository R2

## Context

Storage details and migrations leak into app/UI.

## Decision

One repository owns persistence, transactions, migrations, failures, drafts, recents, and image references.

## Alternatives

Keep qisi-db direct calls; expand thin facade; replace storage technology.

## Consequences

Failure handling becomes testable and domain services stop serializing.

## Risks

Migration/data loss risk and two-tab conflicts.

## Compatibility

Legacy reads remain supported; content fields are not rewritten.

## Rollback

Retain legacy adapter behind repository and revert caller migrations.

## Tests

Repository, migration, quota, corruption, interruption, duplicate, two-tab tests.

## Migration sequence

Characterize existing behavior; implement repository; migrate one call group; browser persistence; remove old calls.
