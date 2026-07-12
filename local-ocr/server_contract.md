# Local OCR server contract

- Bind only `127.0.0.1`/`::1`; never upload externally.
- Accept bytes/body only, never arbitrary filesystem paths.
- Allow only PNG, JPEG, WebP, and PDF within the configured size limit.
- Enforce timeout, cancellation, concurrency limits, and temporary-file cleanup.
- Return requestId, engine/version, text blocks, formulas, images, confidence, and warnings.
- Do not log raw user content, base64 bodies, credentials, or complete responses.
