---
name: local-ai-ocr-boundary
description: Use when touching qisi-local-server.js, AI proxy routes, OCR calls, vision model calls, or real-recognition testing.
---

# Local AI/OCR Boundary Skill

## Purpose

Prevent accidental paid calls, unstable external dependency use, and hidden OCR behavior in default tests.

## Relevant files

- `qisi-local-server.js`
- scripts using AI/OCR smoke tests
- any helper that calls `/api/ai/chat`
- any helper that calls `/api/ai/ocr`
- PDF/image recognition paths

## Default rule

No real AI/OCR calls in ordinary development.

Default safe tests must use mocks and fixtures.

## Explicit real-test requirement

A real AI/OCR task must specify:

```text
Purpose:
Model:
Input file:
Endpoint:
Expected max calls:
Expected cost/risk:
Success criteria:
Abort conditions:
Whether business code can be modified:
```

If these are missing, do not run the real test.

## Allowed commands only in explicit real-test task

```bash
npm run test:ai-proxy
npm run test:ai-vision-proxy
```

## Server boundary

When modifying local server:

- preserve request validation
- preserve model-name validation
- preserve timeout handling
- preserve body-size limits
- preserve no-secret logging
- do not print API keys
- do not weaken CORS/security casually

## DOCX conversion boundary

DOCX-to-PDF conversion can use Word COM or LibreOffice.

Do not make DOCX conversion mandatory for normal DOCX parsing unless task explicitly says so.

## Final report

State:

```text
Real AI/OCR called: yes/no
Endpoint:
Model:
Number of calls:
Cost risk:
Tests:
```