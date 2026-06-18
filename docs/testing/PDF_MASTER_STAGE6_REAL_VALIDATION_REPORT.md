# PDF Master Stage 6 Real Validation Report

## Stage 6A Implementation

Stage 6A implemented the controlled `real-run` browser workflow in:

```text
scripts/pdf-master-browser-runner.js
```

The runner can now:

- open the local app in Chromium through Playwright
- upload only the authorized case02 question PDF and support PDF
- assign the question PDF role as `question`
- assign the support PDF roles as `answer` and `solution`
- trigger batch recognition
- wait for review or failure status
- collect only sanitized draft counts, missing-field lists, warning codes, and result classification
- write attempt ledger under ignored `local-run-artifacts/`
- update this report without raw OCR text or API key material

## Stage 6A Non-Real Validation

Commands:

```bat
node scripts/pdf-master-browser-runner.js --mode=preflight
node scripts/pdf-master-browser-runner.js --mode=dry-run
```

Result:

```text
preflight: pass
dry-run: pass
```

Real API called:

```text
false
```

Underlying API call count:

```text
0
```

## Latest Attempt

No real attempt has been executed yet in this report revision.

## Safety

- API key value printed: no
- Full OCR raw text saved: no
- Real PDF/DOCX committed: no
- Formal question bank submitted: no
- local-run-artifacts committed: no
