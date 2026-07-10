# Repository Reality Baseline R2

## Baseline identity

- OS: Microsoft Windows NT 10.0.19045.0
- Node: v24.16.0
- npm: 11.13.0
- Git: 2.54.0.windows.1
- Start HEAD: `da699b53abbe8a6715bb8a8ffae5a954f6b514af`
- Start branch: `main`
- Work branch: `stage/post-rc-engineering-closure-r2`
- Remote: `https://github.com/lij92863-web/qisi-math-pro.git`
- Baseline tag: `pre-engineering-closure-r2-da699b5`
- Start local/origin/live equality: yes
- Start working tree: clean

## Runtime and recovery reality

All required paths exist: `app.js`, `main.html`, the three mandatory safety tests, and `scripts/pdf-master-browser-runner.js`. The browser runner passes `node --check`.

Tracked inventory at baseline:

- Total tracked files: 454
- Root production JS: 27
- qisi modules: 26
- Tests: 68
- Scripts: 30
- Skills: 9
- Tools: 3
- docs/refactor: 214
- docs/testing: 66
- docs/architecture: 0 before R2
- docs/release: 1
- tracked local-test-materials: 0

The recovered `tests/`, `scripts/`, `skills/`, and `tools/` contain 110 tracked files and are part of the protected engineering surface.

## Browser runner

- Playwright is already a devDependency; no dependency addition is needed for E2E planning.
- Syntax check: passed.
- Real-run remains forbidden.
- Preflight/dry-run are reserved for mandatory gates.

## Rollback

Return to the immutable baseline by creating a new worktree or branch from `pre-engineering-closure-r2-da699b5`. Do not use reset-hard, force push, or delete the current index. All R2 changes must remain atomic and independently revertible.
