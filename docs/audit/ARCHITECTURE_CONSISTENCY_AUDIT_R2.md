# Architecture Consistency Audit R2

## Decision

The R2 changed boundaries are architecture-consistent. The legacy app shell
still contains substantial OCR, parser, storage-call-site, export-effect, and
review workflow debt, but no forced extraction is authorized: the residual
owner debt is documented and frozen by tests.

## Dependency direction

Target direction:

```text
UI -> Controller/Orchestrator -> Domain/Validator -> Adapter/Repository
```

The extracted modules follow this direction:

- UI/app creates and calls library, review, import, export, and repository
  services.
- review controller is storage-free and returns immutable state/decisions.
- recognition contracts, repair, alignment, and controlled-write do not depend
  on UI, DOM, or the app shell.
- OCR adapters depend only on the canonical candidate contract and injected
  transports; they contain no persistence or ownership implementation.
- storage repository owns physical operations through an injected database and
  has no UI dependency.

`tests/architecture-consistency.test.js` rejects reverse UI/app/DOM references
from the audited lower layers.

## Single-owner audit

| Responsibility | Canonical owner | Result |
|---|---|---|
| controlled-write | `qisi-pdf-support-controlled-write.js` | one implementation owner |
| JSON/LaTeX repair | `qisi-support-repair.js` | one implementation owner; app delegates |
| storage repository | `qisi-storage-repository.js` | one repository owner; Dexie schema bootstrap remains in `qisi-db.js` |
| OCR registry | `qisi-ocr-engine-registry.js` | one owner |
| question schema | `qisi-recognition-contracts.js` | one canonical `qisi.question.v1` owner |
| answer ownership | controlled-write plus support aligner validation | no adapter/review ownership |
| runtime script dependency | `scripts/verify-qisi-runtime-dependencies.js` and `qisi-runtime.js` | static order plus visible boot failure |
| formula display normalization | `qisi-components.js` for preview; legacy print/app normalization remains | accepted residual duplication |
| export mapping | `qisi-export-service.js` | mapping owner; browser ZIP/download effect remains in UI adapter |
| review lifecycle | `qisi-review-controller.js` | domain lifecycle owner; UI maps reactive state |

Exact implementation-symbol guards verify the principal owners. Browser-global
aliases and call sites are not counted as duplicate implementations.

## app.js residual responsibility

`app.js` is 21,779 physical lines and remains above the desired shell-only end
state. It still contains:

- concrete legacy Qwen/OCR request and retry paths;
- parser and normalization details inside the legacy batch closure;
- residual direct database call sites outside the migrated library/review paths;
- browser ZIP/download and import side effects;
- large review/import orchestration state.

R2 nevertheless moved canonical schema, repository, library query, review
lifecycle, export mapping, import routing, OCR registry/adapters, shadow mode,
and performance monitoring to dedicated owners. The residual 5,134-line batch
workflow is a high-risk next-release migration, not a Phase 5 rewrite target.

## Runtime consistency

- static runtime dependency analysis passes;
- every referenced local script exists;
- required Qisi namespaces are defined before use;
- duplicate namespace owners are rejected;
- `app.js` is the final local application script;
- browser startup passes with no project page or console error;
- initialization exceptions render an escaped fatal panel rather than a white
  screen.

## Safety invariants

| Invariant | Evidence |
|---|---|
| OCR cannot write formal data | adapter/registry source guards and candidate contract tests |
| review cannot bypass controlled-write | controller has no storage calls; confirmation validation requires controlled-write plus manual evidence |
| Route B remains frozen | Route-B hold 6/6 and no app/controlled-write import |
| adapters return candidates only | Qwen/local adapter contract tests and no-persistence guard |
| validator executes before review handoff | import orchestrator contract tests and validation-failure path |
| safe partial is not weakened | known-bad, aligner, controlled-write, and browser mock acceptance gates |

## Limitations

- Formula normalization still has preview/print/legacy variants; they serve
  different rendering contexts but should receive a future semantic-equivalence
  audit.
- Physical Dexie version bootstrap remains in `qisi-db.js`; repository owns new
  data operations, not historical schema creation.
- Browser globals prevent a complete module-import DAG from ordinary CommonJS
  tooling. The audit combines source guards, runtime dependency analysis, and
  browser E2E instead of claiming a bundler graph.

No architecture-consistency release blocker was found.
