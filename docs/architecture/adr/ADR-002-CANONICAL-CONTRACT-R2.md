# ADR-002 — Canonical Contract R2

## Context

Current objects drift between OCR, parser, review, and storage.

## Decision

Use versioned JSDoc shapes and runtime validators with one compatibility owner.

## Alternatives

TypeScript migration; informal objects; per-module adapters.

## Consequences

Explicit evidence and errors reduce guessing; legacy mapping remains temporarily.

## Risks

False confidence if validators are bypassed.

## Compatibility

Legacy content is preserved; only safe metadata defaults are added.

## Rollback

Remove the contract consumer commit and continue legacy objects; never transform stored content destructively.

## Tests

Contract and legacy compatibility tests plus controlled-write gates.

## Migration sequence

Introduce factories/validators; wrap one boundary at a time; remove duplicate conversions.
