# Program C C2-12 Wave 16 OCR/Vision Transport and Producer Report

## Decision

`APP_OCR_TRANSPORT_OWNER_ZERO_ACCEPTED`

Wave 16 was applicable. The shell still contained 18 direct Qwen proxy
requests, model identities, chat/OCR payload construction, response parsing,
OCR task selection, and a reachable strict page producer. A large second set
of legacy Qwen recognition/repair functions had no production root caller and
was deleted rather than moved.

## Final production boundary

```text
app UI / import command
  -> Qwen source port or batch-engine producer
  -> Qwen task client
  -> same-origin Qwen proxy transport
  -> /api/ai/chat or /api/ai/ocr
```

- `qisi-ocr-qwen-adapter.js` uniquely owns same-origin endpoint selection,
  model identity, request-body assembly, response parsing, timeout mapping,
  external cancellation linkage, and health checks.
- `qisi-qwen-vision-source-port.js` owns the strict question prompt and
  projection, canonical DOCX vision identity delegation, document OCR task
  selection/fallback, formula OCR selection, and manual-question OCR prompt.
- `qisi-batch-engine-v2.js` owns strict file/page preparation and the
  prepared-page orchestration, including concurrency, trace, validation,
  targeted repair coordination, progress, and cancellation checks around late
  results.
- `app.js` assembles these owners. It has no proxy request, proxy URL, model
  name, OCR task name, base64 request-body assembly, response parser, retry or
  backoff algorithm, or inline strict visual producer.

The remaining semantic Qwen calls used by figure localization and support
field projection do not select endpoints, models, OCR engines, retry policy,
or parse wire responses. They remain explicit source/policy ports for the
Wave 18 B/C reachability audit; they are not a second transport owner and this
Wave does not pre-accept C2-12.

## Reachability and retirement evidence

The active PDF and DOCX-vision normal-UI paths both reach the shared strict
producer and strict page source. The old direct Qwen request helpers were
therefore moved to the adapter/source-port boundary. In contrast, the retired
legacy text/image/page recognition, PDF/DOCX wrapper, final-repair, option
rebuild, and answer-page functions had definitions but no proxy export,
controller entry, runtime dependency, or reachable production caller. They
were removed with their private helpers.

The post-wave responsibility inventory drops from 362 to 305 functions. The
display-cleaner proof inventory consequently drops from 26 to 12 live
callsites; its tests now audit the live residual set while preserving synthetic
controlled-write and answer/solution risk checks. No removed producer was
restored to satisfy the historical count.

## Indirect transport and fixture audit

The audit covered dynamic fetch, helper indirection, injected callbacks,
constants, fallback adapters, test transports, and hidden flags:

- direct AI/OCR proxy calls: `0`;
- direct `/api/ai/*` fetches: `0`;
- Qwen model identities in `app.js`: `0`;
- OCR engine/task selection in `app.js`: `0`;
- inline strict producer definitions: `0`;
- production mock identity or `InjectedImportTransport`: `0`;
- hidden transport feature-flag fallback: `0`.

Browser fixtures are resolved only through the explicit
`ImportAdapterRegistry` fixture slot. The concrete
`qisi.mock-import-transport.v1` identity exists only in browser-test code;
production has no permissive test-adapter fallback. Missing production ports,
unknown proxy route kinds, malformed JSON, HTTP failures, and rejected strict
protocols fail closed.

## Cancellation, timeout, and privacy evidence

The proxy transport links the caller signal to its timeout controller and
distinguishes `OCR_REQUEST_CANCELLED` from timeout. The strict file producer
checks cancellation before and after rendering, forwards the signal to page
recognition, and never enters recognition after an aborted render. The page
owner checks around every awaited producer boundary and rejects a late result
before merge or validation. Document OCR does not try another engine after
cancellation.

Adapter and source-port errors expose stable codes without prompts, image
payloads, local paths, API keys, or model response text. Production logging
continues through the secure logger. The source-port tests cover missing ports,
malformed payloads, timeout/HTTP mapping, cancellation, task selection, and
manual OCR prompt ownership without a real endpoint.

## Browser and regression evidence

- focused Wave 16/source/engine/browser target: `59/59`;
- normal-UI production browser canary: `1/1`, all `15/15` scenarios;
- true-import browser suite: `4/4`;
- `verify:safe`: `1607/1607`, 54 suites;
- Base Migration: `15/15`;
- Route B hold: `6/6`;
- batch mock: `20/20`;
- PDF known-bad: `65/65`;
- controlled-write answer ownership: `21/21`;
- DOCX stable: `20/20`;
- preflight and dry-run: passed with a real browser;
- `realApiCalled=false`, `underlyingApiCallCount=0`;
- failed, cancelled, skipped, todo, and timeout: `0`.

No real AI/OCR endpoint, `real-run`, force/reset/pull/rebase command, or
production-data mutation was used. The six frozen PDF high-risk files remain
byte-unchanged from their package baseline.

## Shell metrics and next boundary

Wave 15 ended at 16,301 `app.js` lines, 362 inventoried functions, and a
239-line largest function. Wave 16 ends at 13,226 lines and 305 functions. The
largest function is the unrelated 164-line `startExamPointerDrag`; the largest
remaining Program C domain function is the 146-line
`extractTextFromDraftFile`. No function exceeds the 250-line ceiling.

Wave 17 is the next independent conditional audit of storage, Formal
Repository, and remaining D responsibility. This decision does not pre-accept
Wave 17, Wave 18, or C2-12.
