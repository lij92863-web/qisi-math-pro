# STAGE R9A1 — Real Dual-PDF Test Budget

## Authorization

The user authorized up to five complete real tests of the dual-PDF workflow.

## Inputs

- `完整版题目.pdf`
- `完整版答案.pdf`

No DOCX, standalone image, or other PDF is included in this paid-call authorization.

## Boundary

- Local proxy endpoints only: `/api/ai/chat` and `/api/ai/ocr`.
- Standard recognition mode only.
- Allowed production models: `qwen-vl-plus`, `qwen-plus`, and
  `qwen-vl-ocr-latest` only when required by structured OCR fallback.
- At most five complete workflow runs and 60 upstream calls in total.
- Record text and vision call counts after each run.
- Do not log credentials or request image payloads.

## Success criteria

- Reliable continuous question sequence.
- No shifted answer or solution ownership.
- No unsafe attachment after missing, duplicate, unknown, or jump-back markers.
- Rendered formula, image, and layout integrity in review and print.
- All PDF known-bad and batch safety gates remain green.

## Abort conditions

- Authentication, balance, quota, rate-limit, or invalid-model response.
- Unexpected model fallback or accurate-mode escalation.
- Cumulative call cap would be exceeded.
- Any unsafe support sequence or answer/solution mismatch.

