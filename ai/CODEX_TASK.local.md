# CODEX_TASK.local.md

## Current stage

H2 — Secure loopback service and make the primary UI boot without CDN access.

## Objective

Reject cross-site access to privileged localhost endpoints, bind the service to a
loopback host by default, expose a testable server factory without changing normal
`npm start`, and replace production CDN dependencies with pinned local assets.

## Boundaries

- No AI/OCR request may reach a real upstream during tests.
- Local same-origin requests and requests without `Origin` (desktop/tools) remain valid.
- Only explicit localhost/127.0.0.1/[::1] origins on the configured port are allowed.
- Static UI remains reachable at the same URL and existing API response schemas stay.
- Offline work is dependency packaging only; do not rewrite application business logic.

## Allowed files

- `ai/CODEX_TASK.local.md`
- `qisi-local-server.js`
- one small server security policy/factory module if useful
- `main.html`
- `qisi-a4-exam-template.js` only for a local KaTeX CSS URL
- `package.json`, `package-lock.json`
- `scripts/production-entry-manifest.js`
- `scripts/check-production-syntax.js`
- local `vendor/` browser assets copied from exact pinned packages
- `tests/local-server-origin-security.test.js`
- `tests/offline-ui-browser.test.js`
- `tests/production-entry-manifest.test.js` and script-order test only for manifest/resource contracts

## Forbidden files

- DOCX/PDF parsers, review schema, DB/user data
- real DashScope/AI/OCR calls, broad style changes, unrelated dependency upgrades
- accepting wildcard/private-network browser origins

## Required gates

```powershell
node --test tests/local-server-origin-security.test.js tests/offline-ui-browser.test.js tests/production-entry-manifest.test.js tests/app-ui-navigation-browser.test.js
npm.cmd run check
npm.cmd run verify:batch-safety
npm.cmd run verify:safe
```

## Acceptance criteria

- Malicious Origin receives an explicit denial before handlers and causes zero upstream calls.
- Local origins/no-Origin work; server listens on loopback by default and remains startable.
- Main UI boots with all external requests blocked, visits primary views, renders math, and
  records zero page/console errors and zero AI/OCR calls.
- Browser dependency versions are pinned locally; production HTML has no runtime CDN request.
- `app.js` changes are limited to the three PDF worker URLs and the absolute print KaTeX asset URL.
- Full gates pass.

Continue directly to R8.0 after a green commit.
