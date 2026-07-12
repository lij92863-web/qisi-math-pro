# Code Quality Audit R2

## Decision

Phase 4 is accepted with explicit legacy debt. No architecture rewrite or
behavior-changing cleanup was performed. Four source-boundary guards were added
to prevent new debt in the app shell, OCR adapters, UI storage boundary, and
tests.

## Static inventory

The inventory was measured from tracked root production JavaScript on
2026-07-12. Generated dependencies and tests are excluded; the tracked
`.bm_a4_app_before.js` snapshot is evidence, not active production.

| Measure | Result | Assessment |
|---|---:|---|
| Largest active production file | `app.js`, 21,779 physical lines (21,780 split count) | accepted legacy debt; below the 22,043-line R2 baseline |
| Next largest production files | support parser 1,652; batch engine 1,427; support block parser 1,091; utils 1,005 | specialized but still reviewable owners |
| Largest detected app function | `processDraftImportBatch`, 5,134 lines | high-risk legacy orchestration; frozen, not forcibly split |
| Other large app functions | 242, 239, 202, 182, 172 and 168 lines | candidates for ordered future extraction |
| Detected app functions | 318 | heuristic inventory from `base-migration-inventory.js` |
| Console calls in active root production | 352 static matches; 305 in `app.js` | diagnostic debt; removal without classification is unsafe |
| TODO/FIXME in active root production | 0 static matches | no marker debt found |
| Empty catch blocks | one active app catch around optional clipboard cleanup; one embedded PowerShell COM-release catch | localized best-effort cleanup, not a swallowed domain failure |

Function parameter count and nesting depth were reviewed on the largest
functions rather than claimed from a full JavaScript AST. The dominant risk is
not positional parameter count but deep closure state and nested orchestration
inside `processDraftImportBatch`. Mutation is concentrated in Vue state and the
legacy batch workflow; newly extracted services use immutable copies or explicit
repository transactions.

## Error handling

Broad try/catch remains common in the legacy import/OCR workflow. The sampled
paths either rethrow fatal service errors, attach a stable code, or surface a UI
message. The audit found no safe, isolated swallowed domain error suitable for
removal in Phase 4.

The target error record is:

```text
code, stage, recoverable, userMessage, technicalDetail, requestId, cause
```

Current extracted owners are not fully uniform:

- storage supplies `code`, `stage`, `recoverable`, message, and details;
- import/export supply `code`, `stage`, `recoverable`, message, and cause;
- Qwen OCR supplies `code`, `requestId`, message, and cause context;
- legacy app paths often use plain `Error` plus ad-hoc properties.

Introducing a shared error hierarchy and migrating all legacy throws would be a
new architecture rewrite, so it is a next-release item. No gate treats a plain
error as successful, and browser/runtime failures remain visible.

## Duplication, dead code, and ownership

- Runtime dependency analysis reports no duplicate namespace owner or missing
  module and requires `app.js` to load last.
- High-risk JSON repair, support alignment, controlled-write, schema, storage,
  export, import, review, and OCR registry owners are imported by tests rather
  than reimplemented.
- Repeated normalization and serialization remain in the legacy app batch and
  backup paths. Extracted contracts and repositories are the designated owners;
  removing every historical helper in this phase would exceed the allowed risk.
- No unused export or dead branch was proven strongly enough for deletion.
  Text-only non-use is not proof in a browser-global application.
- The tracked pre-migration snapshot is documentation/audit evidence and is not
  loaded by `main.html`.

## Test quality audit

- Production-linked: specialized tests require production modules; browser E2E
  drives startup, upload, review, confirmation, persistence, export, and delete.
- Counterfactual: Phase 3 attacks malformed runtime, JSON/LaTeX, ownership,
  storage, security, performance, and synthetic OCR isolation paths.
- Mock safety: mocks replace external transport and fixtures, not the
  controlled-write owner. Real AI/OCR routes are blocked and separately gated.
- Tautology/implementation copying: high-risk owner-name guards reject local
  test reimplementations; migration execution gates call production owners.
- Timeout/skipped: browser tests use explicit timeouts and final reports must
  show zero skipped. The mandatory matrix is not reduced to a happy path.

## New guards

`tests/code-quality-boundaries.test.js` enforces:

1. `app.js` cannot grow past the audited line/function ceiling and cannot add a
   second function larger than 250 lines.
2. OCR adapters cannot contain answer alignment, controlled-write, manual
   confirmation, or repository transaction ownership.
3. UI modules cannot implement IndexedDB, Dexie, localStorage, or bulk
   transaction storage.
4. Tests cannot locally define selected high-risk production owners.

## Remaining debt classification

| Debt | Classification |
|---|---|
| 5,134-line legacy batch workflow and deep closure state | next release, high risk |
| incomplete common error record | next release |
| 352 console call sites requiring diagnostic classification | next release |
| repeated normalization/serialization in legacy app paths | next release |
| full unused-export/dead-branch proof | tooling follow-up |

No release-blocking quality regression was found in the changed R2 boundaries.
