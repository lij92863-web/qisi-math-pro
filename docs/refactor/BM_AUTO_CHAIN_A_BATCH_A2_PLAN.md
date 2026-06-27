# BM-AUTO Chain A Batch A2 PLAN

Stage: BM-AUTO-CHAIN-A-BATCH-A2-MIGRATION
Branch: main
Start commit: f1cf1a7a79f58479fad98c170b578cff77616d0e
A1 precondition: Batch A1 code migration accepted and A1 documentation audit committed.

## Selected Functions

- hasUnconvertedImagePlaceholder
- hasUnconvertedOptionPlaceholder
- itemHasUnconvertedImagePlaceholder

## Target Module

- qisi-utils.js

## Why Grouped

- hasUnconvertedOptionPlaceholder depends on hasUnconvertedImagePlaceholder.
- itemHasUnconvertedImagePlaceholder depends on hasUnconvertedImagePlaceholder.
- hasUnconvertedImagePlaceholder depends on Batch A1 token protection behavior.
- The group is pure text/object inspection logic and can be migrated without moving A3 or A4 helpers.

## Old Behavior Summary

- hasUnconvertedImagePlaceholder converts nullish input to an empty string, protects legal media tokens, then detects unconverted image or object/null/undefined placeholders.
- hasUnconvertedOptionPlaceholder joins stem and options, detects option-image placeholder variants, then delegates to hasUnconvertedImagePlaceholder.
- itemHasUnconvertedImagePlaceholder checks stem, options, answer, and solution with hasUnconvertedImagePlaceholder.

## Risk Audit

- DOM: no.
- DB/storage: no.
- async/network: no.
- AI/OCR: no.
- PDF safety: no.
- controlled-write: no.
- Route B: no.
- mutation: no.
- dependencies: internal dependency on Batch A1 protectBatchMediaTokens only.

## Allowed Files

- app.js
- qisi-utils.js
- tests/qisi-utils-unconverted-image-placeholders.test.js
- docs/refactor/BM_AUTO_CHAIN_A_BATCH_A2_PLAN.md
- docs/refactor/BM_AUTO_CHAIN_A_BATCH_A2_REAL_MIGRATION.md

## Forbidden Files

- scripts/*
- qisi-pdf-*.js
- main.html
- app.css
- package.json
- package-lock.json
- AGENTS.md
- ai/
- skills/

## Stop Conditions

- qisi-utils already contains conflicting A2 definitions.
- old behavior unclear.
- migration verifier is not REAL_MIGRATION.
- app.js delta is greater than -10.
- any test fails, skips, or times out.
- forbidden file touched.
- A3 or A4 migration becomes necessary.
