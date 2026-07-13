# Local OCR server contract

- Bind only `127.0.0.1`/`::1`; never upload externally.
- Accept bytes/body only, never arbitrary filesystem paths.
- Allow only PNG, JPEG, WebP, and PDF within the configured size limit.
- Verify PNG/JPEG/WebP/PDF magic bytes match the declared MIME before any engine
  call; mismatch returns `mime-spoofed`.
- Enforce timeout, cancellation, concurrency limits, and temporary-file cleanup.
- Return requestId, engine/version, text blocks, formulas, images, confidence, and warnings.
- Do not log raw user content, base64 bodies, credentials, or complete responses.

## R1 endpoints and status

- `GET /health` always reports the service boundary and sanitized engine metadata.
  `ok=false` means the engine is unavailable.
- `POST /v1/recognize` accepts the allowlisted raw body and returns a candidate only
  after the injected engine response passes the adapter response validator.
- Default engine status is `unavailable`; recognition returns HTTP 503 with
  `ocr-engine-unavailable`.
- Oversize, MIME, duplicate id, concurrency, timeout and malformed-engine failures
  remain distinct. Failure bodies contain code/requestId only, not cause messages.
- Managed temp job directories are created below the configured temp root and
  removed in `finally` after success, failure, timeout, or cancellation.
