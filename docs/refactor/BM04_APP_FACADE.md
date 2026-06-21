# BM04 Application Facade Layer

## Stage

BM04 — thin facade wrapper for dependency management.

## Module

`qisi-app-facade.js` — UMD, 1 export:

- `createAppFacade(dependencies)` — returns facade with get/has/assert methods

## Purpose

Provides stable entry point for future module wiring without changing app.js behavior yet.

## Tests

5 tests. No browser required.
