# CODEX_TASK.local.md

## Current stage

H1 — Production-entry governance and removal of confirmed migration debris.

## Objective

Create one machine-readable inventory for every root `qisi-*.js` module, make
production syntax checking consume that inventory, remove only the five confirmed
unreachable migration scaffolds and their dedicated tests, and remove all implicit
tool dependence on `.bm_a4_app_before.js` before deleting the ignored local copy.

## Boundaries

- Historical Markdown may continue to describe old commits; production code and
  current tests/tools must not require deleted scaffolds.
- Do not delete Node production/safety modules or frozen PDF research modules.
- Do not change DOCX/PDF/AI/OCR behavior, app state, schemas, UI, or persistence.
- The manifest is the single ordered truth for local browser scripts and production
  syntax checks; duplicate hand-maintained script arrays must be removed.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `scripts/production-entry-manifest.js`
- `scripts/check-production-syntax.js`
- `scripts/base-migration-inventory.js`
- the four `scripts/bm-a4-*` tools that formerly defaulted to the snapshot
- `package.json`
- `tests/production-entry-manifest.test.js`
- `tests/main-html-script-order.test.js`
- `tests/bm-a4-explicit-baseline.test.js`
- `tests/app-facade-wiring.test.js` (replace its dead-scaffold assertions with live wiring)
- `tests/base-migration-execution-gate.test.js` (replace a deleted scaffold sample name only)
- the five confirmed scaffold modules and five dedicated tests, deletion only
- ignored root `.bm_a4_app_before.js`, deletion only after tool tests pass

## Forbidden files

- `app.js`, `main.html`, all live domain modules, DB/data/user materials
- DOCX/PDF parser or alignment policy, AI/OCR/network behavior
- broad test cleanup unrelated to the removed scaffolds

## Required gates

```powershell
node --test tests/production-entry-manifest.test.js tests/main-html-script-order.test.js tests/bm-a4-explicit-baseline.test.js tests/app-facade-wiring.test.js
npm.cmd run check
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

## Acceptance criteria

- Every root qisi module is classified exactly once and production order matches main.
- Five dead scaffolds are absent and no current production/test/tool requires them.
- Candidate ranker/planner use direct source analysis; staged/long-run tools require an
  explicit `--before` path and work with temporary fixtures.
- The ignored 22,813-line snapshot is absent after verification and remains recoverable
  from Git history.
- Full gates pass with zero real AI/OCR calls.

Continue directly to H2 after a green commit.
