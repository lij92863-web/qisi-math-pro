# ADR-001 — Layered Architecture R2

## Context

app.js and domain modules mix orchestration, policy, and adapters.

## Decision

Adopt UI -> controller -> domain -> validator -> adapter/repository, with explicit contracts.

## Alternatives

Continue legacy coupling; framework rewrite; immediate TypeScript migration.

## Consequences

Incremental extractions gain testable owners without a framework replacement.

## Risks

Temporary adapters and call-site complexity during migration.

## Compatibility

Existing public exports remain until consumers migrate.

## Rollback

Revert each atomic extraction commit; old behavior is removed in the same commit only after tests.

## Tests

Production-linked module, runtime, browser, DOCX, and PDF safety gates.

## Migration sequence

Tests first; add target module; switch call sites; delete old owner; run gates.
