# Verification Command Matrix

This matrix documents the safe verification commands used by staged Codex work. It does not add a new aggregate script and does not change `package.json`.

## Default Safe Gates

| Command | Purpose | Use when | Boundary |
| --- | --- | --- | --- |
| `npm.cmd run verify:safe` | Runs syntax checks, the Node test suite, batch mock smoke, and no-real-AI guard. | Default final gate for ordinary code or documentation changes. | Must remain mock-first and must not call real AI/OCR endpoints. |
| `npm.cmd run verify:docx-stable` | Checks the stable DOCX+DOCX batch-import mock path. | Required when DOCX import, support import, review draft behavior, or shared batch code may be affected. | A passing result is required before claiming DOCX stable-chain safety. |
| `npm.cmd run verify:pdf-known-bad` | Runs known-bad PDF support and fail-closed regression coverage. | Required for PDF parser, aligner, controlled-write, or related fixture work. | Known-bad cases must stay `prefix` or `fail-closed`; unsafe writes are a stop condition. |
| `npm.cmd run verify:batch-safety` | Runs DOCX stable, PDF known-bad, no-real-AI, and batch mock smoke checks. | Required for batch-import safety and this PDF governance batch. | This is intentionally separate from `verify:safe` to avoid duplicating heavier checks on every small run. |
| `npm.cmd run verify:no-real-ai` | Scans ordinary development paths for forbidden real AI/OCR call markers. | Included in `verify:safe`; run directly when checking AI/OCR boundaries. | Does not authorize real endpoints; it only guards against accidental calls. |
| `npm.cmd run verify:diff-scope` | Checks the current Git diff against `QISI_ALLOWED_DIFF`. | Required when the task defines an allowed file set. | Set `QISI_ALLOWED_DIFF` before running. A mismatch is a stop condition. |

## Runner Commands

| Command | Purpose | Use when | Boundary |
| --- | --- | --- | --- |
| `node scripts/pdf-master-browser-runner.js preflight` | Read-only runner readiness check, if supported by the runner. | Before any controlled PDF runner work. | Must not call real AI/OCR. Must not write draft data. |
| `node scripts/pdf-master-browser-runner.js dry-run` | Exercises runner wiring without real recognition, if supported by the runner. | Before a real run is considered. | Must not call real AI/OCR and must not be treated as a complete baseline. |
| `node scripts/pdf-master-browser-runner.js real-run` | Performs the actual real-file PDF runner path. | Only when the task file explicitly allows `REAL_RUN_ALLOWED=1`. | Forbidden in default work. One failed real run is not permission to retry or patch blindly. |

## PowerShell Diff-Scope Examples

```powershell
$env:QISI_ALLOWED_DIFF=".gitignore"
npm.cmd run verify:diff-scope

$env:QISI_ALLOWED_DIFF="docs/testing/**,docs/audits/**"
npm.cmd run verify:diff-scope

$env:QISI_ALLOWED_DIFF="tests/**,docs/testing/**"
npm.cmd run verify:diff-scope
```

## Stop Conditions

Stop immediately when a verification command fails and the cause is not clearly in the current task scope, when `verify:diff-scope` reports an out-of-scope path, or when a command would require real AI/OCR without explicit authorization.
