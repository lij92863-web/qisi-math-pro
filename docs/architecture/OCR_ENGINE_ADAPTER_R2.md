# OCR Engine Adapter R2

## Interface

```js
healthCheck(options)
getCapabilities()
recognizePage(input, options)
recognizeDocument(input, options)
cancel(requestId)
```

All recognize methods return a `RecognitionCandidate` or a structured error. They never return review drafts or confirmed questions.

Program B R1 hardens the candidate envelope to require:

```text
engine
engineVersion
requestId
sourceId
page
rawText
blocks
formulas
images
rawEvidenceRef
warnings
durationMs
```

`rawEvidenceRef` is a stable request-scoped reference, not a log copy of source
content. The legacy in-memory `rawEvidence` field remains for compatibility and
evidence preservation, but it is never emitted by the adapter logger.

## Adapter set

- Current Qwen adapter: wraps existing request/response, requestId, timeout, error mapping, and raw result without changing prompts in the initial migration.
- Local OCR adapter: HTTP only to validated loopback service.
- Document-VL adapter: future capability; registry entry remains unavailable until benchmarked.
- Mock adapter: deterministic fixtures, no network.
- Future adapter: must pass the same contract suite.

## Input, response, and error boundary

- Byte-aware requests use the common PNG/JPEG/WebP/PDF MIME allowlist and a
  configured maximum byte size. The local adapter requires both MIME and byte
  count; the Qwen adapter preserves legacy non-byte requests but validates either
  field whenever supplied.
- Arbitrary local paths are rejected before transport.
- Each active `requestId` is unique per adapter. A duplicate fails closed rather
  than replacing the cancellation controller.
- Optional response fields are type-checked before candidate construction.
  Malformed results use `ocr-malformed-response`; they are not returned as invalid
  candidates.
- Stable operational errors include `ocr-cancelled`, `ocr-engine-unavailable`,
  `ocr-request-failed`, `mime-rejected`, `size-rejected`,
  `local-path-forbidden`, and `duplicate-request-id`.
- Transport cause messages are not copied into public errors. Optional adapter
  logs contain only event, engine/version, requestId, error code and duration.

## Registry

Registry owns registration, lookup, capability checks, health, timeout, cancellation, and default selection. It owns no alignment or write policy.

## Local service boundary

- bind `127.0.0.1`;
- MIME allowlist and size limit;
- byte/body input only, no arbitrary local paths;
- temporary directory cleanup;
- concurrency limit and timeout;
- no user text/raw response logging;
- no external upload;
- stable error codes and requestId.

## Shadow mode

New engines run benchmark-only. Shadow candidates never reach controlled-write, review, candidate field merging, or automatic supplementation. Conflicts preserve both evidence sets and require manual review.

Program B R1 measured shadow uses a fixed metric allowlist and numeric deltas.
Reports and optional logs omit raw text/evidence. An unavailable, timeout, or
measurement failure returns a stable code and falls back to the untouched
production candidate. It never changes the default UI result or synthesizes a
winner.

## Promotion gate

Promotion requires zero wrong attachments, fabrication, raw JSON, and placeholders; non-regressed structure; at least one improved weakness; reduced manual correction; deployability; safe fallback; and validator enforcement.
