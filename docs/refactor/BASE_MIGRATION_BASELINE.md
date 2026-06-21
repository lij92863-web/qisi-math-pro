# Base Migration Baseline

## Frozen at

| Field | Value |
| --- | --- |
| Commit | `2dc6102` |
| Branch | `main` |
| Date | 2026-06-22 |
| Working tree | clean |

## Core Decisions

| Decision | Status |
| --- | --- |
| Route B answer-only AI pass | Research-only, NOT integrated |
| Production strategy | safe partial + manual review |
| Complete baseline target | Superseded |
| Q8/Q9 handling | Missing/rejected → teacher fills |
| controlled-write | Only truth gate |
| DOCX+DOCX | Stable primary chain |

## File Sizes

| File | Lines | Risk |
| --- | --- | --- |
| `app.js` | 23,215 | **HIGH** — legacy coordinator |
| `main.html` | 1,530 | Medium — script loading |
| `scripts/pdf-master-browser-runner.js` | 2,538 | Medium — runner |
| `qisi-pdf-support-controlled-write.js` | 958 | Low — stable |
| `qisi-pdf-support-block-parser.js` | 1,091 | Low — stable |
| `qisi-pdf-support-aligner.js` | 548 | Low — stable |
| `qisi-support-parser.js` | 1,652 | Medium |
| `qisi-batch-engine-v2.js` | 1,430 | Medium |
| `qisi-batch-importer.js` | 992 | Medium |
| Other qisi-*.js | < 700 each | Low |

**Total qisi-*.js: 10,547 lines. app.js: 23,215 lines. app.js is 2.2x all qisi modules combined.**

## Qisi Modules (16)

`qisi-backup.js`, `qisi-batch-engine-v2.js`, `qisi-batch-importer.js`, `qisi-components.js`, `qisi-config.js`, `qisi-db.js`, `qisi-local-server.js`, `qisi-pdf-answer-extraction-quality.js`, `qisi-pdf-answer-only-extraction.js`, `qisi-pdf-support-aligner.js`, `qisi-pdf-support-block-parser.js`, `qisi-pdf-support-controlled-write.js`, `qisi-runtime.js`, `qisi-support-parser.js`, `qisi-support-repair.js`, `qisi-utils.js`

## Test Files (14)

Routing, PDF, DOCX, batch, migration boundary coverage.

## Docs (35+ in docs/testing/)

Full audit trail from P1 through P10K-B.

## Test Results (baseline)

| Command | Result |
| --- | --- |
| `npm run verify:safe` | All pass |
| `npm run verify:pdf-known-bad` | 65/65 |
| `npm run verify:batch-safety` | All pass |
| `npm run smoke:batch:mock` | 20/20 |
| preflight / dry-run | Pass |
