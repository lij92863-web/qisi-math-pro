# Program C C2-12 Wave 12 — DOCX Support Source Producer Report

Date: 2026-07-14 Asia/Shanghai

Decision: `C2_12_WAVE12_DOCX_SUPPORT_SOURCE_PRODUCER_ACCEPTED`

## Scope

Wave 12 moves the active DOCX answer/solution source lifecycle from `app.js`
into the existing production DOCX vision source-port owner. The shell now only
constructs `createSupportSourceProducer` and maps the production-runner input.
No PDF safety owner, prompt/model policy, validator, controlled-write rule,
ReviewDraft persistence rule, or Formal Admission rule changed.

The module owner now performs, in order:

1. DOCX input validation;
2. DOCX-to-virtual-PDF conversion;
3. sequential page rendering with the injected render policy;
4. strict prepared-page support recognition;
5. malformed, empty, conflict, and coverage fail-closed checks;
6. original DOCX identity/source-trace projection;
7. cancellation checks before and after every awaited producer boundary.

Late support output after cancellation is discarded before support-field
projection. Question/support ownership remains in the existing production
runner and still requires exactly one matching question number.

## Characterization and safety evidence

- Focused source-port, architecture, and shell tests: `24/24`.
- Normal-UI production browser canary: `1/1`, covering `15/15` scenarios.
- Full `verify:safe`: `1569/1569` tests across 54 suites.
- Mandatory gates: `11/11`.
- DOCX stable: `20/20`.
- PDF known-bad: `65/65`.
- PDF controlled-write ownership: `21/21`.
- Route B hold: `6/6`.
- Preflight and dry-run: passed; `realApiCalled=false`, underlying calls `0`.
- No `real-run` command was executed.

Focused fixtures cover answer-only, solution-only, answer+solution, missing
support, malformed support, recognizer conflict, original source identity,
declared support-source order, cancellation, missing producer ports, and
question/support mismatch. All mismatch and conflict cases fail closed before
attachment; wrong attachment remains `0`.

## Quantitative result

- `app.js`: 17,273 -> 16,981 inventory lines (`-292`).
- detected functions: 375 -> 375.
- largest detected function: `parseDocxOptionsFromText`, 242 lines.
- removed app-local owner:
  `processStandaloneDocxSupportByVision`.
- app-local DOCX support producer algorithm copies: `0`.
- six frozen PDF high-risk files changed: `0`.

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
| real API calls | 0 |

## Remaining scope

Wave 12 does not claim full C2-12 acceptance. Lower-level DOCX conversion and
reconciliation helpers and other still-active B responsibilities remain subject
to the Wave 13 inventory and unique-owner audit. Wave 13 may start only after
this Wave 12 package is committed, pushed, and local/tracking/live heads agree.
