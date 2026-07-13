# OCR Quality R1 Counterfactual Attack Matrix

All rows are synthetic/security evidence. They do not measure real recognition
accuracy. Each test imports the actual R1 owner and preserves downstream
controlled-write/FormalAdmission gates.

| Attack | Owner under test | Counterfactual evidence | Required invariant | Result |
| --- | --- | --- | --- | --- |
| rotated | local adapter + RecognitionCandidate | synthetic transform warning | isolated candidate; no answer/write authority | PASS |
| perspective | local adapter + RecognitionCandidate | synthetic transform warning | isolated candidate; no answer/write authority | PASS |
| blur | local adapter + RecognitionCandidate | synthetic transform warning | isolated candidate; no answer/write authority | PASS |
| low contrast | local adapter + RecognitionCandidate | synthetic transform warning | isolated candidate; no answer/write authority | PASS |
| double column | reading-order owner | right block has smaller y than left block | column region wins; no y-only ordering | PASS |
| watermark | local adapter + RecognitionCandidate | synthetic transform warning | isolated candidate; no answer/write authority | PASS |
| handwritten note | local adapter + RecognitionCandidate | synthetic transform warning | isolated candidate; no answer/write authority | PASS |
| formula split | reading order + structure extractor | two formula lines with conflicting source order | formula adjacency retained; ownership unvalidated | PASS |
| circled number | structure extractor | `①` anchor | not normalized into strict question number | PASS |
| A/B/C/D in formula | structure extractor | formula block contains option-like letters | remains formula; creates no options | PASS |
| page duplication | structure extractor | repeated question number on two pages | both remain unvalidated; no formal question | PASS |
| page reorder | reading-order owner | page 2 supplied before page 1 | explicit page order restored deterministically | PASS |
| malicious JSON | structure extractor | option-shaped JSON wrapper | rejected evidence; never option/formal data | PASS |
| huge response | Qwen adapter boundary | response exceeds configured character limit | explicit `ocr-response-too-large` before candidate | PASS |
| timeout | engine registry | never-resolving engine | explicit `ocr-timeout` and cancel requestId | PASS |
| local service unavailable | measured Shadow Mode | shadow throws unavailable | untouched production fallback; sanitized code | PASS |
| model version mismatch | candidate selection policy | promotion is for another version | no production candidate selection | PASS |
| engine conflict | candidate selection policy | completeness/confidence tradeoff | manual review; no merge/synthesis | PASS |
| wrong confidence | adapter response validator | confidence above 1 | malformed response rejected | PASS |
| fabricated block | structure extractor | numeric anchor and invented stem block | candidate evidence only; no controlled/formal authority | PASS |
| path traversal | local adapter boundary | client supplies relative local path | rejected before transport without path disclosure | PASS |
| MIME spoofing | loopback service | HTML bytes labelled PNG | magic-byte mismatch rejected before engine | PASS |

## Aggregate invariants

- Wrong answer attachment introduced: 0.
- Wrong solution attachment introduced: 0.
- Fabricated formal question introduced: 0.
- controlled-write or FormalAdmission bypass: 0.
- Shadow failure fallback: verified.
- Timeout swallowing: 0; timeout remains explicit.
- Canary enabled: no; `CANARY_DISABLED_PROMOTION_GATE_NOT_MET` remains active.
- Real OCR/API calls: 0.
