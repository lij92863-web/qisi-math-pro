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

## Adapter set

- Current Qwen adapter: wraps existing request/response, requestId, timeout, error mapping, and raw result without changing prompts in the initial migration.
- Local OCR adapter: HTTP only to validated loopback service.
- Document-VL adapter: future capability; registry entry remains unavailable until benchmarked.
- Mock adapter: deterministic fixtures, no network.
- Future adapter: must pass the same contract suite.

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

## Promotion gate

Promotion requires zero wrong attachments, fabrication, raw JSON, and placeholders; non-regressed structure; at least one improved weakness; reduced manual correction; deployability; safe fallback; and validator enforcement.
