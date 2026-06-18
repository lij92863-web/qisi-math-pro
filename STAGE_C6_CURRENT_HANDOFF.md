# Stage C6 Current Handoff

This document records the current stable project state, operating boundaries,
and recommended workflow for the next handoff.

## Latest Stable Points

- LaTeX display option-label normalization:
  - Commit: `470f2e4`
  - Tag: `stage-latex-display-option-label-normalize`
- C5C PDF support safe prefix:
  - Commit: `5c607a4`
  - Tag: `stage-c5c-pdf-support-safe-prefix`
- C6A mock batch smoke:
  - Commit: `5e40932`
  - Tag: `stage-c6a-batch-mock-smoke`
- C6B safe verification script:
  - Commit: `bb30cef`
  - Tag: `stage-c6b-safe-verification-script`
- C6C safe testing guide:
  - Commit: `1406e9f`
  - Tag: `stage-c6c-safe-testing-guide`

## Current Capability Boundaries

- DOCX+DOCX remains the stable main path.
- PDF+PDF support fails closed when the support sequence is unreliable.
- C5C supports `full`, `prefix`, and `fail-closed` PDF support alignment modes.
- C6A mock smoke covers dual-PDF misalignment and the DOCX main chain.
- `verify:safe` is the current low-cost aggregate acceptance command.

## Current Prohibitions

- Do not run real AI/OCR by default.
- Do not run real PDF+PDF or DOCX+DOCX upload recognition by default.
- Do not keep piling complex logic into `app.js`.
- Do not repair PDF support with semantic keyword matching.
- Do not trust the AI `question` field as the source of truth.
- Do not run tests that may produce cost without explicit user approval.

## Recommended Workflow

When taking over, start with:

```powershell
git status --short
git branch --show-current
git log --oneline --decorate -9
```

For ordinary low-cost acceptance, run:

```powershell
npm.cmd run verify:safe
```

Only run real browser, real file, or real AI tests after the user explicitly
approves them.

## Suggested Next Steps

- C7A should not continue adding legacy PDF merge rules.
- To improve dual-PDF automation, build a deterministic PDF support block
  parser.
- AI should provide raw text only; program logic should split blocks by
  question number, answer marker, and solution marker.
- Continue moving complex logic out of `app.js` into `qisi-*.js` modules.
- Future browser automation must mock and intercept `/api/ai/ocr` and
  `/api/ai/chat` before it runs.
