# 21 页中文数学卷「≤30 秒」技术选型调研（带证据）

调研日期：2026-10-18。场景：高中数学老师自用录题，输入 21 页 A4 中文数学试卷（19 道大题，公式、几何图、频率分布直方图、杨辉三角、跨页表格、跨页长解析），输出题目原文（LaTeX）、选项、答案、解析、图形位置、题号。

**读法约定**

- 「实测」= 本项目真实调用留下的回执（有文件路径）。
- 「官方标称」= 厂商文档/定价页写的数字。
- 「第三方实测」= 第三方网关或评测博客，注明来源与测量条件。
- 「估算」= 由上面两类数字推算，必须给出算式。
- 汇率假设 **1 USD = 7.1 CNY**（全表统一，未查实时汇率）。

---

## 0. 先给结论（一句话版）

**「21 页 → Markdown + 公式 + bbox」有产品能在 30 秒内做完；「21 页 → 题目/选项/答案/解析结构化」没有任何产品有 ≤30 秒的公开证据。** 卡点不在网络、不在上传，在**自回归输出 token 数 ÷ 输出速度**。我们自己的实测已经把这条线画死了：qwen3.7-flash 单流 **243 token/s**，整卷 16,245 token 输出耗时 **66.7 秒**。

---

## 1. 对比表

吞吐口径说明：解析器的 pages/s 全部是 **A100 80G + vLLM 批处理**下的整卷吞吐，不是单页交互延迟；单页交互延迟通常 1.5–5 秒/页。VLM 的 tok/s 是**单请求单流**。

| 方案 | 类型 | 中文数学 LaTeX | 结构输出 | 图 bbox | 21 页估计耗时 | 每千页成本（¥） | 证据 |
|---|---|---|---|---|---|---|---|
| **qwen3.7-flash**（现用） | 云 VLM | 中（本项目实测能出公式，但图框/表格/异常字形不合格） | 需提示词约束，json_object 不保证字段 | 有，但实测 13 处框全部裁错/截断 | **串行 44 次 ≈ 500 s**；单次整卷 **66.7 s**（实测） | **1.08**（逐页并发）／3.06（整卷一次，跨 32K 档） | 本项目实测 §2 |
| qwen3-vl-plus | 云 VLM | 较好（未在本卷实测） | 同上 | 有 | 整卷一次约 190 s（估算，25k tok ÷ 84 tok/s） | 10.1 | [价格](https://help.aliyun.com/zh/model-studio/qwen3-vl-plus)／[第三方速度](https://hidden.aimlapi.com/models/qwen3-vl-plus) |
| qwen-vl-ocr | 云 OCR | 中（专文字提取，非结构化） | 无（纯 OCR） | 部分 | 未知 | 约 0.13（仅 OCR 输出） | [价目](https://docs.bailian.console.aliyun.com/zh/model-studio/billing) |
| 阿里 Document Mind 文档解析（LLM 版） | 云解析 | 未验证 | Markdown/版面块 | 有 | 约 10–20 s（估算，开发者文章 12 页 <10 s） | **20**（基础 0.02 元/页）／250（智能解析 0.25 元/页） | [按量价](https://help.aliyun.com/en/document-mind/product-overview/pay-as-you-go) |
| 腾讯云 试卷切题 / 试题识别 | 云 | 未验证 | 题干+坐标 | 有 | 未知（异步批处理） | 200（0.2 元/页） | [定价](https://buy.cloud.tencent.com/pricing/ocr) |
| 腾讯云 试题批改 Agent | 云 | — | 按题结构化 | 有 | 未知 | 按题 0.13 元/题 → 19 题 ≈ 2.47 元/卷 ≈ 117/千页 | [说明](https://cloud.tencent.com.cn/developer/article/2743052) |
| 百度 PaddleOCR-VL（云 API） | 云解析 | 中（中文公式 CDM 0.90 级） | Markdown | 有 | 约 13 s（估算，1.62 页/s） | 50（0.05 元/页） | 本项目 10-04 调研 §2 |
| **MinerU 2.5** | 开源自托管 | 中（OmniDocBench 90.67） | Markdown/JSON | 有 | **9.9 s**（2.12 页/s，A100）／20 s（1.06 页/s，第三方复测） | **≈4**（A100 ¥15/h 估算）／0.5–1.5（4090 自建） | [论文](https://wangbindl.github.io/images/MinerU2_5.pdf) |
| **PaddleOCR-VL-L** | 开源自托管 | 中上（中文公式 CDM 0.9035） | Markdown | 有 | **13 s**（1.62 页/s） | ≈4（同上口径） | [论文](https://arxiv.org/abs/2603.24326) |
| dots.ocr | 开源自托管 | 中（OmniDocBench 88.41） | Markdown | 有 | 60–75 s（0.28–0.35 页/s） | 不划算 | 同上 |
| MonkeyOCR-pro-1.2B | 开源自托管 | 中 | Markdown | 有 | 31–45 s（0.47–0.67 页/s） | — | 同上 |
| olmOCR-2 7B | 开源自托管 | 英文强、中文弱 | Markdown | 有 | 约 12 s（1.78 页/s，单篇博客） | — | 同上（第三方，条件不明） |
| GOT-OCR2.0 | 开源自托管 | 弱（无结构，表格退化） | 纯文本 | 无 | 36 s（35 页/分，3090）／不可用（48 s/页未优化） | — | [速度](https://gigagpu.com/best-ocr-models-2026/) |
| Nougat | 开源自托管 | **不适用**（英文学术训练） | Markdown | 无 | 84–160 s（8–15 页/分，A100） | — | [说明](http://theneuralbase.com/ai-for-research/learn/advanced/nougat-document-ocr) |
| **TextIn xParse** | 云解析 | 好（公式直出 LaTeX） | Markdown/JSON+版面块 | 有 | 官方称 100 页 1.5 s（宣传，条件不明） | **71**（$0.01/页） | [定价](https://www.textin.ai/xparse/pricing)／[产品页](https://www.textin.com/market/detail/pdf_to_markdown) |
| **Doc2X** | 云解析 | 好（理工科专精） | Markdown/JSON/版面块 v3 | 有 | 官方称 500 页 1 分钟（宣传） | **20**（0.02 元/页）／10（资源包） | [API 能力](https://open.noedgeai.com/products.html) |
| Mathpix | 云 OCR | **最好**（数学专项） | line-level JSON | 有 | 未知（同步单文件） | 35.5（$0.005/页）／10.7（Files API $0.0015） | [定价](https://website.mathpix.com/pricing/api) |
| Unstructured | 云/自托管 | 弱于专业解析 | element JSON + bbox | 有 | 未知 | 107（$15/千页） | [汇总](https://anyformat.ai/blog/best-document-parsing-apis)（未打开官网） |
| LlamaParse | 云 | 中（Agentic 档较好） | Markdown/JSON | 部分档位 | 未知 | 8.9（Fast）／89（Agentic）／399（Agentic Plus） | [定价](https://docs.cloud.llamaindex.ai/pricing) |
| Mistral OCR 4.1 | 云/自托管 | 中（中文 97.11%，厂商自测） | Markdown + 段落 bbox + 块置信度 | 有 | 官方称 2000 页/分（单节点，批处理） | 28.4（$4/千页）／14.2（batch） | [报道](https://witho2.com/?p=6517)（官方页未直连） |
| Azure Document Intelligence | 云 | 弱（数学非强项） | Layout 有结构 | 有 | 未知 | 10.7（Read $1.5）／71（Layout $10） | [汇总](https://docuocr.com/ocr-pricing-per-1000-pages)（未打开官网） |
| Google Document AI | 云 | 弱 | Layout Parser | 有 | 未知 | 10.7（OCR $1.5）／71（Layout $10） | 同上 |
| AWS Textract | 云 | 弱 | Tables/Forms 另收费 | 有 | 未知 | 10.7（纯文本）→ **462**（Forms+Tables $65） | 同上 |

---

## 2. 本项目已有实测（本次调研最硬的证据）

来源：`local-run-artifacts/pdf-qwen37-shenzhen-full-2026-10-14/approved-resume/qwen37-shenzhen-full-parse-2.receipt.json`、`ai/PDF_QWEN37_SHENZHEN_FULL_RESULT_2026-10-14.md`、`local-run-artifacts/pdf-qwen37-shenzhen-simple-full-2026-10-14/qwen37-shenzhen-simple-transcribe-01.receipt.json`。

| 实验 | 输入 | 输出 | 耗时 | 折算输出速度 | 费用 |
|---|---|---|---|---|---|
| 单页（原页 1） | 2,266（图 1,963） | 782 | **11.527 s** | 67.8 tok/s（含首 token） | ¥0.0010788 |
| 整卷 21 页一次调用 | 42,086（图 41,223） | 16,245 | **66.737 s** | **243.4 tok/s** | ¥0.0642396 |
| 旧简化流程（R21+L21+O+V） | — | — | **≈500 s 串行**（21×11.5 + 21×~7 + O + V） | — | ≈¥0.08/卷 ≈ ¥3.9/千页 |

由此得到两个可直接用的常数：

- **首 token 延迟 ≈ 8 s**（1963 图像 token 的单页请求，11.5 − 782/243 ≈ 8.3 s）。
- **图像计量 1,963 token/页**，21 页 = 41,223 token，单独就跨过 32K 档，使整卷单次调用落到 0.6/2.4 元每百万档，**成本是逐页并发的 2.8 倍**。

价格核对：`price-capability-freeze.json` 记录的 qwen3.7-flash 北京档为 ≤32K：输入 0.2、输出 0.8；32K–256K：0.6/2.4；256K–1M：1.2/4.8（元/百万 token）。回执 `cost.yuan` 与按此复算完全一致。

---

## 3. 四个必答问题

### A. 有没有产品能做到 21 页端到端 ≤30 秒？

**分两种目标，答案相反。**

**（1）「解析成 Markdown + LaTeX + bbox」：有，而且不止一家。**

- MinerU 2.5：A100 80G 实测 **2.12 页/s**，21 页 ≈ **9.9 s**（[论文表 3](https://wangbindl.github.io/images/MinerU2_5.pdf)）。
- PaddleOCR-VL-L：A100 80G + vLLM 批 512，**1.62 页/s**，21 页 ≈ **13 s**（[论文表 7](https://arxiv.org/abs/2603.24326)）。
- 云服务：TextIn 称「100 页最快 1.5 s」、Doc2X 称「500 页 1 分钟」——**这是厂商宣传，未给分辨率/并发/是否只走文本层，不能当实测**；按 MinerU/Paddle 的独立数据，21 页落在 **10–20 s** 是合理的。
- Mistral OCR 4.1 称单节点 2000 页/分（≈33 页/s），是本表最高的厂商标称值，同样无独立复现。

**（2）「结构化出题 + 选项 + 答案 + 解析 + 题号归属」：没有任何产品给出 ≤30 秒的公开证据。**

原因见 B。唯一接近的是「解析 13 s + 按题并行结构化 6–10 s」的理论拼装（≈20–25 s），但**没有厂商这么做，也没有实测**，属于需要我们自己工程实现并验证的路径。

### B. 物理瓶颈在哪？

**不在上传，不在带宽，在「输出 token 总数 ÷ 单流输出速度」。**

- 21 页整卷输出的下限（纯转写，不含答案归属推理）实测就是 **16,245 token**；加上答案/解析字段归属、JSON 结构，合理区间 **20k–25k token**。
- qwen3.7-flash 单流实测 **243 tok/s**：
  - 16,245 tok → **67 s**（已实测）
  - 25,000 tok → **103 s**（估算：25000 ÷ 243）
- 即使换成第三方观测到的 **584 tok/s**（OrcaRouter 自家基础设施 7 日窗口），25k token 仍需 **43 s**（估算），再加 4 s 首 token。
- 官方定位也印证：Qwen3.7-Flash 被描述为「毫秒级首字、短上下文、基础视觉识别」，不是长文档结构化模型（[开发者文章](https://developer.aliyun.com/article/1760205)）。
- **串行调用是第二个放大器**：现流程 2P+2 = 44 次请求，按每次 11.5 s 计 = **506 s ≈ 8.4 分钟**。这正是用户说的「十几分钟」的来源，不是模型慢，是 44 次排队。
- 上传不是瓶颈：21 张 JPEG 约 2–4 MB，10 Mbps 上行 2–3 s（估算）。
- **Batch/异步接口完全不可用于此目标**：百炼 Batch 明确「24 小时内异步返回」，半价（[文档](https://help.aliyun.com/zh/model-studio/batch-interfaces-compatible-with-openai)）。

### C. 必须自己组织结构化内容时，30–60 秒的唯一可行路径

换更快的模型**单独不成立**（584 tok/s 也只到 43 s，且质量未见证据）。唯一可行是四件事同时做：

1. **页面级并行，别整卷单流。** 21 路并发，按 `ceil(21/c)` 波计算：c=8 → 3 波 ≈ 35 s；c=11 → 2 波 ≈ 23 s；c=21 → 1 波 ≈ 12–18 s（含排队，估算）。百炼北京 qwen3-vl-plus 限额 3000 RPM / 5M TPM，21 个并发远低于上限（[限流](https://help.aliyun.com/zh/model-studio/rate-limit)）。**qwen3.7-flash 的官方 RPM/TPM 未查到，需实测。**
2. **把「整卷一次整理（O）」拆掉。** 整卷 O 要一次吞 16k 输入、吐 6k 输出，单流就是 25 s 起。改成「每页/每题分片结构化 + 软件确定性合并」，输出被切成 19 份并行，总时长由最长分片决定，不由总和决定。
3. **输出协议从「重写全文」改成「引用块 ID」。** 让模型只写 `{question_no, stem_block_ids, options_block_ids, answer_block_ids, solution_block_ids, figure_ids}`，正文不再重新生成。输出量可从 16k 降到 **3–6k token**，单流从 67 s 降到 12–25 s（估算：4000–6000 ÷ 243）。
4. **公式与版面交给专用解析器，不要交给通用 VLM 自回归。** PaddleOCR-VL / MinerU 把 LaTeX + bbox 在 10–20 s 内产出，通用模型只负责「归属与理解」。这是唯一能让「公式质量」和「30 秒」同时成立的组合。

一句话：**并行分片 + 结构引用化 + 解析与理解分离**。三者缺一，30 秒都不成立。

### D. 推荐组合与预期收益

**主链路（推荐）**

```
PDF → 本地并行渲染 21 页
    → [阶段1] MinerU 2.5 / PaddleOCR-VL 单卡批量解析（10–20 s，出 Markdown + LaTeX + bbox + 块 ID）
    → [阶段2] qwen3.7-flash ×19 题并行：只输出「块 ID → 字段」映射 + 跨页合并判断（3–6k token，8–15 s）
    → [软件] 确定性合并 + 图裁切 + 序列/覆盖率门禁
```

**兜底链路**

- 低置信块 / 公式 CDM 低 / 图框越界 → 只把这些块送回 **qwen3-vl-plus 单页重读**（不进主链路，不阻塞 30 s）。
- 整卷最终复核（V）**降级为抽检**：只复核跨页题、答案归属、异常字形页。**这是质量与 30 秒的直接冲突，必须让用户知情**：全卷 V 一次要吞 21 张图 + 候选，实测约 60–70 s，30 秒内做不完。

**相对现状的收益**

| 指标 | 现状（qwen3.7-flash 逐页转写 + 单次整理，串行） | 推荐组合 | 倍数 |
|---|---|---|---|
| 端到端耗时 | ≈500 s（实测推算）／整卷单次 67 s 起 | **25–45 s**（估算：13 s 解析 + 10–15 s 并行结构化 + 5 s 合并） | **11–20×** |
| 每千页成本 | ≈3.9 元 | 自建：**3–5 元**（GPU 摊销 4 + 结构化 1.1）；云解析：**52–72 元** | 自建持平，云解析贵 13–18× |
| 公式保真 | 中（异常字形被"规范化"，实测已发生） | 中上（专用解析器 CDM 0.90+，仍非 100%） | — |
| 图 bbox | 差（13 处框全错） | 好（解析器输出块级 bbox） | 质变 |

**注意**：推荐组合把「图框」从「模型猜」变成「解析器给」，这一项是质量提升而非下降——现流程实测 13 处坐标全部裁错/截断，是这个方案最硬的收益点。

---

## 4. 三档推荐

### 最省时间（目标 15–25 s）
**qwen3.7-flash 21 路并发逐页出结构化 JSON，软件按页拼接 + 确定性合并，取消整卷 O，V 只抽检。**
- 结论：唯一能在 30 s 内**同时**出题目+答案+解析的路子，成本 ≈¥1.4/千页。
- 关键风险：跨页题（本卷第 10 题、3/6/8/11/14/15/17/18/19 题）失去整卷视野，答案归属错误率上升；无整卷复核，错误会静默通过；21 并发下首 token 延迟可能劣化（未实测）。

### 最省钱（目标 20–40 s）
**自托管 PaddleOCR-VL 或 MinerU 2.5（单张 4090/A100）+ 规则合并 + qwen3.7-flash 只处理异常题（约 5 题）。**
- 结论：千页 **1–5 元**，比现状还便宜，质量（公式/bbox）反而更好。
- 关键风险：要一台 GPU 机器和运维；MinerU 为 Apache2+商业阈值附加条款、模型许可需单独核（本项目 10-04 调研已记录）；中文数学整卷无公开实测，必须自己跑一遍验收。

### 最稳（目标 40–60 s）
**TextIn xParse 或 Doc2X 出 Markdown + 版面块 JSON → qwen3-vl-plus 分片做归属与复核。**
- 结论：质量兜底最强（数学专项 + 跨页表格合并 + 图 bbox），千页 **52–92 元**。
- 关键风险：贵 13–20 倍；仍不解决「答案/解析归属」这一步（那是模型任务，不是解析器任务）；数据需上传第三方；Doc2X 不提供私有化部署。

---

## 5. 明确「查不到证据」的项（不编数字）

1. **qwen3.7-flash 官方输出速度（tokens/s）**：官方模型页只有价格与上下文，没有吞吐数字。第三方三个来源互相矛盾：OrcaRouter 584 tok/s、独立榜 ~240 tok/s、Metatext 80 tok/s（[OrcaRouter](https://www.orcarouter.ai/zh-CN/blog/claude-haiku-5-5-vs-qwen-3-7-flash)、[Metatext](https://www.metatext.io/llm/alibaba-qwen3.7-flash)）。**只有本项目实测 243 tok/s 是同一口径下的可信值。**
2. **qwen3.7-flash 的官方 RPM / TPM 限额**：限流页检索结果中未出现该模型条目，只有 qwen3-vl-plus 的 3000 RPM / 5M TPM。**21 并发是否会被限流，未知。**
3. **qwen3.7-flash 的中文数学/OCR 基准**：厂商 benchmark 标注「待定」，Artificial Analysis 无收录（据 OrcaRouter 文章）。
4. **qwen3-vl-plus 官方 tok/s**：无。只有第三方网关 84.3 tok/s P50、TTFT 12.3 s（[aimlapi](https://hidden.aimlapi.com/models/qwen3-vl-plus)），且是网关聚合口径。
5. **阿里 Document Mind 单文档时延**：官方无 SLA 时延数字，只有开发者文章「12 页 <10 秒」（[链接](https://developer.aliyun.com/topic/solution-document-mind-rag-for-llm)）。异步任务建议轮询 10 s、超时 120 min，说明常态不是秒级。
6. **TextIn「100 页 1.5 s」、Doc2X「500 页 1 分钟」**：均为产品页宣传，未说明分辨率、并发、是否仅文本层。**按 MinerU/Paddle 的独立页吞吐反推，21 页 10–20 s 更可信。**
7. **GOT-OCR2.0 速度**：两份来源差 30 倍（1–2 s/页 vs 48 s/页），条件不明，**不可采信**。
8. **所有「结构化出题+答案+解析」的端到端时延**：无任何厂商公布，只能自测。
9. **21 页中文数学整卷在 MinerU/PaddleOCR-VL 上的公开实测**：没有。OmniDocBench 是混合文档集，不等于中文数学卷。
10. **Azure / Google / AWS 官方定价页**：本轮未直接打开官网，采用的是 2026-07 第三方汇总（[docuocr](https://docuocr.com/ocr-pricing-per-1000-pages)），数值与官方历来一致但**未逐一核实**。

---

## 6. 给决策者的三个提醒

1. **30 秒与「整卷独立复核」不可兼得。** 全卷 V 一次要看 21 张原图 + 候选，仅输入 41k 图像 token，实测同类请求 66.7 s。要 30 秒就必须放弃全卷复核，改成低置信抽检。这个取舍必须让老师明确同意。
2. **「整卷一次调用」看起来省事，实际更贵更慢。** 21 页图像 = 41,223 token，直接把请求推进 32K 以上档（0.6/2.4），成本是逐页并发的 2.8 倍（¥3.06 vs ¥1.08 每千页），速度还只有单流。
3. **公式质量和图框质量应该向解析器要，不要向通用 VLM 要。** 本项目两次真实整卷已证明：通用 VLM「能认字」不等于「能给对框」——13 处模型坐标全部裁错或夹带正文。这是选型里最该换掉的一环。
