# Program C C2-12 Wave 13 — DOCX Converter/Reconciler Owner Closure

Date: 2026-07-14 Asia/Shanghai

Decision: `DOCX_CONVERTER_RECONCILER_OWNER_CLOSURE_ACCEPTED`

## Classification and reachability

| Responsibility | Pre-wave class | Production reachability | Disposition |
| --- | --- | --- | --- |
| local conversion health and DOCX-to-PDF request | A active production algorithm | question and support producers | moved to `qisi-docx-converter.js` |
| virtual-PDF identity, roles, page range, and DOCX source trace | A active production algorithm | question and support producers | moved with the converter result owner |
| authoritative skeleton filtering, ordering, missing/outside diagnostics | A active production algorithm | question producer | moved to `qisi-docx-vision-reconciler.js` |
| `getLocalConvertBaseUrl` and explicit self-test command | E UI/environment mapping | visible local self-test and converter assembly | retained as thin app mapping |
| old DOCX text-option parser/fill/repair closure | C/D duplicate and unreachable | no caller, export, proxy, controller, or runtime entry | deleted completely |

The deleted 586-line option closure contained
`normalizeDocxOptionEvidenceText`, `parseDocxOptionsFromText`,
`fillOptionsFromDocxVisualOnly`, `fillDocxOptionsOnly`,
`attachDocxTextEvidenceToItem`, and
`repairDocxOptionsFromTextEvidence`. Static identifier inventory found no caller
or export for any root. Production DOCX option/formula evidence continues
through the strict visual engine and the existing DOCX pipeline; no text-layer
fallback was introduced.

## New owner boundaries

`qisi-docx-converter.js` owns health verification, multipart conversion request,
response validation, cancellation, and virtual-PDF/source identity projection.
Its transport, form, blob, base URL, role, clock, and logger dependencies are
explicit ports. It has no UI, database, controlled-write, persistence, or
Formal Admission authority.

`qisi-docx-vision-reconciler.js` owns authoritative skeleton application,
declared question order, outside/missing evidence diagnostics, explicit-number
trace projection, malformed merge rejection, and option/skeleton conflict
fail-closed rules. It receives the existing question merger, number normalizer,
and text cleaner as ports; it does not recognize content or attach support.

Both owners are registered in `architecture/owners.json` and
`architecture/layers.json`, loaded before the production DOCX source ports, and
constructed by the shell. Cancellation now flows from the normal UI runner
through the question producer into conversion, strict processing, and
reconciliation. Support conversion receives the same signal.

## Verification

- focused converter/reconciler/source-port/architecture suite: `38/38`;
- residual static ownership proof suites: `74/74` across 7 suites;
- architecture/runtime graph: `10/10`;
- normal-UI 15-scenario browser canary: `1/1`, all 15 cases;
- true DOCX producer-identity browser chain: `1/1`;
- final `verify:safe`: `1578/1578` across 54 suites;
- mandatory gates: `11/11`;
- DOCX stable: `20/20`;
- PDF known-bad: `65/65`;
- controlled-write ownership: `21/21`;
- Route B hold: `6/6`;
- preflight/dry-run: passed, `realApiCalled=false`, underlying calls `0`;
- no `real-run` command was executed.

The first full run exposed one expected audit drift: deleting the unreachable
option closure reduced the live display-cleaner residual inventory from 27 to
26. The seven proof tests were updated to assert the new measured surface only
after the reachability/deletion test passed. No callsite was rewritten or
reclassified as safe; all 26 residual callsites remain audited with zero
replacement permission. The final full run is green.

## Quantitative result

- `app.js`: 16,981 -> 16,144 inventory lines (`-837`);
- detected functions: 375 -> 363;
- largest detected function: `recognizeExamPageStructuredWithQwen`, 239 lines;
- app-local DOCX conversion implementations: `0`;
- app-local DOCX skeleton reconciler implementations: `0`;
- audited unreachable DOCX option-repair roots: `0`;
- frozen PDF high-risk files changed: `0`.

## Safety counters

| Counter | Result |
| --- | ---: |
| wrong attachment | 0 |
| fabricated content | 0 |
| raw JSON leakage | 0 |
| placeholder leakage | 0 |
| controlled-write bypass | 0 |
| Formal Admission bypass | 0 |
| Bridge formal writes | 0 |
| legacy fallback | 0 |
| duplicate converter/reconciler owner | 0 |
| real API calls | 0 |

## Next stage

Wave 13 is complete but does not accept C2-12. Wave 14 is conditional and must
begin with a fresh ReviewDraft command/persistence inventory. It may be marked
not applicable only with production reachability, transaction, cancellation,
readback, and no-formal-write evidence.
