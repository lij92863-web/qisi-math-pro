# CODEX_TASK.local.md

## Current stage

R8 — Split the remaining view-local state/actions into five explicit composables,
with a complete UI action ownership contract. Execute R8.0 through R8.6 continuously.

## Objective

Create `useSettings`, `useEntry`, `useLibrary`, `useExam`, and `useReview` UMD
factories. Each factory must own real view-local refs/computeds/actions, use explicit
dependencies, and shrink `app.js`; it must not merely wrap a dependency bag.

## Shared coordinator state that stays in app.js

- `view`, `questions`, `cart`, `knowledgeTree`, `selectedExamTemplate`,
  `hoverPersonalL1`, `isCartOpen`
- object URL/DOCX/XML/recognition caches
- all watches, lifecycle hooks, timers, DB/network/AI/OCR registration
- DOCX/PDF recognition, controlled write, crop Canvas, print-window/Blob and
  persistence transaction coordinators

## Composable contract

- API form: `Qisi.XComposable.useX(context, dependencies)`.
- Inject Vue primitives and every effect (`persist*`, prompt/confirm/notify,
  clock/id, clipboard, DOM callbacks) by name.
- No hidden `window.Qisi`, `db`, `fetch`, DOM, clock, random, storage, AI/OCR.
- Missing exercised dependencies fail loudly; construction triggers zero effects.
- Preserve ref/reactive identity, initial values, handler names, template bindings,
  warning text, and existing behavior exactly.
- Existing setup return remains flat and explicit; no opaque spread-only exposure.

## Allowed files

- `ai/CODEX_TASK.local.md`, `app.js`, `main.html`, `package.json`
- `scripts/production-entry-manifest.js`
- `qisi-settings-composable.js`, `qisi-entry-composable.js`,
  `qisi-library-composable.js`, `qisi-exam-composable.js`, `qisi-review-composable.js`
- matching `tests/*-composable.test.js`
- UI action acceptance manifest/tests and existing handler/navigation tests when
  updating their intentional hashes/counts/ownership expectations

## Forbidden files

- DOCX/PDF/AI/OCR modules, DB schema/data, review draft schema, A4 renderer/template
- recognition or persistence semantics, user materials, unrelated cleanup
- moving the 15k-line recognition coordinator merely to reduce line count

## Per-stage gates

```powershell
node --check <new-module> app.js
node --test <module-test> tests/app-ui-handler-contract.test.js tests/app-ui-navigation-browser.test.js
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

## Final R8 acceptance

- Every one of the 117 distinct click expressions has an explicit owner/risk/evidence entry.
- Five composables have real behavior tests, no construction effects, and production wiring.
- Browser navigation/action smoke has zero page/console errors and zero AI/OCR calls.
- `app.js` is smaller after every stage and retains only declared cross-view/high-risk work.
- Full gates pass before moving to final real-material verification.
