# ADR-007 — Benchmark and Release R2

## Context

Optimization and OCR claims lack repeatable evidence and release closure.

## Decision

Freeze corpus/config/scoring, compare baseline/final, require CTO verdict, ff-only main, and release tags.

## Alternatives

Subjective acceptance; only best samples; direct main work.

## Consequences

Claims become auditable and rollback points are explicit.

## Risks

Private corpus leakage or incomparable runs.

## Compatibility

Mock/synthetic results are labeled; real inputs remain local.

## Rollback

Stay on work branch and mark CTO blocked; baseline tag remains immutable.

## Tests

Scoring tests, performance fixtures, full mandatory matrix, live remote equality.

## Migration sequence

Build harness; baseline; changes; final rerun; CTO; report; ff-only merge/tag/push.
