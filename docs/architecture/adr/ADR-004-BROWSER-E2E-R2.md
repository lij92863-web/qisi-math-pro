# ADR-004 — Browser E2E R2

## Context

Node tests missed script omissions and white screens.

## Decision

Reuse Playwright and existing runner to execute real main.html with mock services and isolated storage.

## Alternatives

Only Node tests; manual-only acceptance; new browser dependency.

## Consequences

Catches startup and interaction failures without real AI.

## Risks

Flaky timing and CDN availability.

## Compatibility

No production dependency changes; tests use existing devDependency.

## Rollback

Disable failing E2E commit while preserving static runtime gate; report blocker.

## Tests

Startup, product acceptance, persistence, export/delete, console error assertions.

## Migration sequence

Static dependency gate first; startup test; product flow; persistence; mandatory browser gate.
