# STAGE H10 — Fast startup recovery and UI action acceptance

## Objective

Make the Windows one-click entry start or reuse the local service quickly, never
kill an unknown port owner, and prove that main-page click actions produce a real
state change instead of accepting a Vue binding as evidence.

## Completed

### Launcher recovery

- `open-app.cmd` calls `scripts/start-qisi.ps1` directly and passes
  `-OpenBrowser`; `qisi-server.cmd` is the stable alias other local automation
  can discover.
- The launcher computes the SHA-256 build id of `qisi-local-server.js` and only
  reuses a service whose `/api/health` reports `qisi-local-server` with the same
  `buildId`. A foreign or stale service is skipped, never terminated.
- Ports `Port`..`Port+10` are tried in order; a port that is already in use, or a
  candidate whose process exits during startup, is recorded and the next port is
  tried. Earlier behaviour aborted the whole startup on the first candidate
  failure, which is what a transient port race produced.
- Only the first healthy candidate is reported; the child process id is printed
  as `QISI_PID` and is empty when an existing service was reused.

### UI action acceptance

`tests/app-ui-navigation-browser.test.js` runs an isolated browser profile with
disposable IndexedDB data, blocks AI/OCR endpoints locally, and exercises the
navigation entries, entry controls, batch import task creation, library filters
and reset, exam template/edition controls, knowledge cascaders, draft editing and
the duplicate-import confirmation prompt.

### Product defects found and fixed by this acceptance work

1. **Startup view restore overwrote a navigation click.**
   `app.js` restored the remembered view (`qisi_last_view`) after
   `await loadData()`. On a slow startup the restore landed after the teacher had
   already clicked another entry and silently switched the page back. The restore
   now happens synchronously at mount, before the first `await`, so any later
   click wins. Regression test: `tests/startup-view-restore.test.js`, which also
   proves the remembered view is still restored when nothing is clicked.

2. **A handout autosave in flight could reject a question insertion.**
   `qisi-handout-app.js` returned immediately from `flushSave()` when a save was
   already running, so the insertion read a stale `updatedAt` and the repository
   rejected it with a false `HANDOUT_CONFLICT` — or the pending edit lost the
   race instead. This is the defect behind the intermittent
   `handout-h3-browser` timeout. `flushSave()` now waits for the running save
   cycle before returning. Regression test:
   `tests/handout-insert-autosave-race.test.js`, which fails on the previous
   behaviour and passes on the new one.

3. **Stored reactive review records.** The main entry now stores
   `pendingImportPreview` as a shallow ref and persists review records through
   `reviewRecordForStorage`, so IndexedDB receives plain data.

## Files changed

- `open-app.cmd`, `qisi-server.cmd`, `scripts/start-qisi.ps1`, `README.md`
- `qisi-local-server.js` (service build id only)
- `app.js`, `qisi-handout-app.js`
- `tests/portable-launcher.test.js`, `tests/app-ui-navigation-browser.test.js`,
  `tests/local-server-origin-security.test.js`,
  `tests/startup-view-restore.test.js`,
  `tests/handout-insert-autosave-race.test.js`
- `ai/CODEX_TASK.local.md`, this document

## Tests

```text
npm run verify:docx-stable     20/20 passed
npm run verify:pdf-known-bad   65/65 passed
npm run verify:batch-safety    passed
npm run verify:no-real-ai      passed
npm run verify:safe            1375 total, 1367 passed, 0 failed, 8 skipped
```

Repeated focused runs: launcher 2/2 five times, launcher + app navigation +
startup restore + handout insert race 9/9 twice, H3 handout browser 3/3.
No real AI/OCR call was made at any point.

## Risks

- The launcher still cannot repair a broken MathType native runtime; that is
  tracked by the import-reliability work, not here.
- Port fallback is bounded to eleven candidates. If all are occupied by foreign
  services the launcher fails with an explicit message.

## Not done

- The inventory of click expressions is proven by the browser test, not by a
  hand-driven pass; system print-popup automation remains blocked by the in-app
  browser security boundary and is covered by the isolated print tests.

## Next step

Import reliability for dual DOCX/dual PDF recognition, committed separately.

## Commit

`stage H10 fast startup recovery and UI action acceptance`
