# Local OCR Service Boundary

This optional service provides the loopback HTTP and lifecycle boundary required
by OCR Quality R1. It starts with an `unavailable` engine and never fabricates a
recognition result. No model is bundled or downloaded by this repository.

## One-command Windows lifecycle

From PowerShell in this directory:

```powershell
.\install.ps1
.\start.ps1
.\health-check.ps1
.\diagnostics.ps1
.\stop.ps1
.\uninstall.ps1
```

The operator does not need to create or understand a Python environment. The
current boundary uses the repository's Node.js runtime. `install.ps1` only checks
syntax and creates ignored `models/`, `runtime/`, and `tmp/` directories. It makes
no network request and downloads no model.

`health-check.ps1` returns exit code 2 while the default engine is unavailable;
this is the expected fail-closed state, not a successful OCR installation.

## HTTP contract

- Bind: `127.0.0.1` only by the CLI.
- `GET /health`: service version, sanitized engine metadata, and limits.
- `POST /v1/recognize`: raw PNG/JPEG/WebP/PDF bytes only.
- Request id: optional `X-Qisi-Request-Id`; generated when absent.
- No JSON path, local path, multipart filename, URL, or base64 wrapper is accepted.
- The response is candidate-shaped evidence. It is not a review draft, accepted
  question, or formal write decision.

The service enforces MIME, byte size, request-id uniqueness, concurrency, timeout,
internal managed temp cleanup, response shape, and metadata-only logging. Internal
temporary paths are never accepted from the client or returned in responses.

## Configuration

The CLI recognizes bounded runtime settings:

- `QISI_LOCAL_OCR_PORT` (default `8765`)
- `QISI_LOCAL_OCR_MAX_BYTES` (default 20 MiB)
- `QISI_LOCAL_OCR_CONCURRENCY` (default `2`)
- `QISI_LOCAL_OCR_TIMEOUT_MS` (default 30 seconds)

These settings do not select or download a model. Model installation remains
forbidden unless `QISI_ALLOW_MODEL_DOWNLOAD=1` is explicitly present in a separate
authorized task.

## Cleanup and uninstall

`.\uninstall.ps1` stops the managed PID and removes only ignored `runtime/` and
`tmp/` beneath this directory. It preserves models by default. Use
`.\uninstall.ps1 -RemoveModels` only when intentionally deleting the ignored local
model directory. The script verifies resolved paths before recursive removal and
never removes source files.

See `server_contract.md` for the stable adapter boundary.
