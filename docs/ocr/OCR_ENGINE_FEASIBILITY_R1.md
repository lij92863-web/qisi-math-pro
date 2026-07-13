# OCR Engine Feasibility R1

## Decision boundary

This is a source and deployment feasibility audit, not an accuracy result. As of
2026-07-13, `QISI_ALLOW_REAL_OCR_BENCH=1` and
`QISI_ALLOW_MODEL_DOWNLOAD=1` are absent, and the eligible private corpus contains
0 documents. Every candidate below is **research-only / 未评测**. Production-promoted: 无.

Versions, pricing and deployment instructions are time-sensitive and must be
rechecked and pinned in a benchmark manifest before any authorized run.

## Candidate audit

| Candidate | 官方来源与 license | 模型体积 | CPU/GPU/显存 | Windows 部署 | API 成本 | 隐私路径 | 输出格式 | 主要失败模式 | Current status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current `qwen-vl-plus` adapter | Alibaba Cloud Model Studio [vision documentation](https://help.aliyun.com/en/model-studio/vision) and [official pricing](https://help.aliyun.com/en/model-studio/model-pricing); cloud service terms, not a repository OSS license | hosted model artifact size is not disclosed to this client | client hardware is not the inference boundary; network/API availability required | current repository adapter is JavaScript transport; service region and credentials require separate configuration | official pricing is token-based and region-sensitive; record the live price and actual tokens per authorized run | page content leaves the device for the selected Alibaba region | repository adapter normalizes service output into `RecognitionCandidate` | network/timeout, model alias drift, malformed structure, hallucinated blocks, private-data transfer | research-only / 未评测; existing adapter only |
| `PaddleOCR / PP-OCR` | [PaddleOCR official repository](https://github.com/PaddlePaddle/PaddleOCR), Apache-2.0 [license](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE) | version/language-specific weights; exact artifact must be pinned after download authorization | CPU and several acceleration paths are documented; measured RAM/VRAM is unknown here | official repository documents Windows-capable C++ deployment; Python packaging still needs an install proof on the target | local inference has no per-call API fee; hardware/maintenance cost remains | local processing is possible; weights and temp artifacts remain local | text regions, recognition text and confidence; structured pipelines add layout fields | formula/diagram limits, rotated/low-quality text, language model mismatch, install/runtime drift | research-only / 未评测; no weights downloaded |
| `PaddleOCR-VL` | [official pipeline guide](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL.html), [PaddleOCR-VL-1.6 introduction](https://www.paddleocr.ai/main/en/version3.x/algorithm/PaddleOCR-VL/PaddleOCR-VL-1.6.html), repository Apache-2.0 | official 1.6 page identifies a 0.9B model family; complete pipeline/container footprint is larger and version-dependent | official pipeline lists x64 CPU and multiple GPU device paths; target-machine latency/RAM/VRAM remain unmeasured | device support exists in official tooling, but a native Windows service install has not been proven in this repository | local inference has no per-call API fee; deployment hardware cost remains | local service is possible; model download and cache controls are mandatory | document parsing blocks including text, table, formula and chart/region outputs | incomplete pipeline causing hallucination, layout/order error, resource pressure, version incompatibility | research-only / 未评测; no model downloaded |
| `olmOCR` long-document candidate | [AllenAI official repository](https://github.com/allenai/olmocr), Apache-2.0 [license](https://github.com/allenai/olmocr/blob/main/LICENSE) | official installation notes approximately 2GB+ heavy GPU dependencies and 30GB free disk for local GPU setup; exact selected weights must be pinned | official local GPU path recommends at least 12GB VRAM and lists tested NVIDIA GPUs; remote inference is also supported | official system instructions target Ubuntu/Debian; Windows native support is unconfirmed, WSL would require a separate feasibility proof | local inference has no per-call API fee; remote service cost depends on the selected provider | local or separately controlled remote inference; source handling must be audited | linearized PDF/document text and benchmark artifacts | heavy environment, PDF rendering dependencies, reading-order/structure loss for question-bank fields | research-only / 未评测; no installation or weights |
| `mock/synthetic` baseline | repository-owned deterministic fixture path; project license applies, no external model license | none | Node.js only; no GPU/VRAM | supported wherever repository Node tests run | zero external API cost | no private source; public synthetic data only | fixed `RecognitionCandidate`/ground-truth-shaped JSON | cannot measure real recognition, layout robustness or human correction time | unit-tested research baseline; never production engine |

`Unlimited OCR` was considered as the named plan example, but an authoritative
official source and license were not established during this audit. `olmOCR` is
therefore the documented “other long-document candidate”; no inference is made
from third-party summaries.

## Feasibility gate before any evaluation

For each non-mock engine, an authorized package must pin engine/model version,
official source revision, license/terms, hashes, hardware profile, OS/runtime,
configuration, timeout, privacy route and expected cost. Installation and model
download occur only with the required flag. A download or install failure must not
change the current production chain.

No candidate can be selected on reputation or vendor benchmark claims. Only the
private, leakage-controlled Holdout protocol can support promotion, and fewer than
10 eligible documents still limits all outcomes to research/shadow.
