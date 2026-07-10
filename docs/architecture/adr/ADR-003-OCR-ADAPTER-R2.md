# ADR-003 — OCR Adapter R2

## Context

Direct Qwen helpers prevent safe engine substitution.

## Decision

All engines implement one candidate-only adapter contract behind a registry; new engines begin shadow-only.

## Alternatives

Keep direct calls; engine-specific branches in app.js; auto-merge best fields.

## Consequences

Transport becomes replaceable while ownership stays downstream.

## Risks

Adapter accidentally embeds policy or exposes private raw logs.

## Compatibility

Current Qwen behavior/prompt remains unchanged during wrapping.

## Rollback

Disable registry wiring and return to existing current-engine path.

## Tests

Adapter contract, timeout, malformed response, no-write, no-real-AI tests.

## Migration sequence

Contract first; registry/mock; Qwen wrapper; local wrapper; shadow; benchmark promotion.
