# PDF 外部识别 V2 连续执行任务 — 2026-10-13

## 人类指令与执行边界

用户已明确要求开始执行完整方案，并补充“中间不能停，直到做完为止”。允许连续完成已授权的内部步骤，不再在每个阶段结束索要“继续”；质量与数据安全门槛仍需实际通过。保留现场全部 dirty 和证据，不 reset/stash/commit/push。

依据：`PDF_API_FIRST_V2_AUDIT_AND_EXECUTION_PLAN_2026-10-13.md`。当前先完成 S0 可执行实验包、固定请求、离线验证及真实测试准备；合格候选产生后继续 S4–S7。不能跳过选型实测直接切生产。通用结构验证可先开发为离线评估工具，不冒称模型已验收。

## 当前允许文件

- 本任务及 `ai/PDF_EXTERNAL_V2_EXECUTION_2026-10-13.md`。
- `scripts/pdf-external-evaluation.js`：纯离线请求组装、结果结构/来源/原序/图片检查与费用评估，不含真实传输、凭据、生产入口。
- `tests/pdf-external-evaluation.test.js`、`tests/fixtures/pdf-external-v2-evaluation.json`：合成与已记录反例，不调用网络、不含 gold 泄漏。
- `scripts/verify-personal-stable.js`、`tests/personal-stable-suite.test.js`、`tests/verify-personal-stable-runner.test.js`：按已审计事实修复失效验收入口；用当前 PDF 原序/图片检查和隔离正常 UI 回读替代已删除测试及不适配当前路线的旧 runner 步骤。已有 runner 测试仅更新本次有意迁移的固定套件顺序与命令断言，保留并加强真实调用禁令，不改业务坏例期望。历史 runner 原样保留，DOCX/事务/准入套件不删除。此项独立于模型胜出，可以在等待实测授权时完成。
- ignored `local-run-artifacts/pdf-api-first-v2-execution-2026-10-13/**`：冻结 manifest/request、独立真实测试工具、账本、原响应和结果评审。

先不修改已冻结的提示/schema、app.js、main.html、DOCX、生产路由、数据、依赖、密钥或历史文件。计划出现真正缺陷时先说明再做局部修订，保留原版及 hash。

## 输入与候选真实调用的确认范围

用户在获知弹窗中两卷、阿里/智谱候选、先3页后达标扩页、总20元/80次/600页次范围后，于本轮回复“确认”。该答复授权以下阿里/智谱具体范围；不重复询问。GLM缺可用凭据时先执行已配置的阿里。MinerU仍按原单独范围，不由此次弹窗扩大。

1. 深圳 PDF：`C:/Users/Administrator/Desktop/题目与答案/广东深圳高级中学（集团）2026届高三适应性考试数学试卷 (1).pdf`，SHA256 `874e3615f89d0abaf4a2f1beb0aa7f5034bbb55bd9299a0bd6392646f5a55e21`。
2. 河北 PDF：`C:/Users/Administrator/Desktop/题目与答案/河北昌黎第一中学2025-2026学年高三考前自测考试数学试卷.pdf`，SHA256 `011f12024f5c8bdd013e6524ba63b1ed762b34db501295d2edd9b6505d06c4a9`。
3. 首轮只发送深圳原 13 页和河北原 6/7 页，复用已冻结原图/两份子 PDF。后续只有通过已知反例才扩大到原规划 13 页及两卷完整 40 页。原整卷未经阶段晋级不得作为小样本上传。gold、纠正内容、DOCX、题库记录、源目录其他文件绝不外发。
4. 阿里：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，固定候选 `qwen3.7-flash-2026-07-15`；只有公式/上下文能力核验且精确配置冻结后调用。密钥仅在本机内存作 Bearer，不记录。
5. 智谱（需可用凭据）：`https://open.bigmodel.cn/api/paas/v4/chat/completions`，候选 `glm-4.6v-flash`，服务限制时一次替代 `glm-4.6v-flashx`；`https://open.bigmodel.cn/api/paas/v4/layout_parsing`、`glm-ocr`；文本整理降费对照 `glm-4.7-flash`。各模型先核官方具体能力，不轮番猜端点。
6. MinerU 原认证/3 页免费上传权限仍按 `CODEX_TASK_MINERU_REAL_SAMPLE_2026-10-04.md` 有效；不得无授权重复消耗原认证流程或扩大上传。其他 MinerU 页数/费用另需当前新范围确认，OpenXLab AK/SK 不作为已可用 MinerU Token。

建议总上限：新独立账本最多 80 次模型/解析提交（含失败重试和免费提交）、600 页次、20 元人民币 API 费用，先达到者止损。轮询每任务最多 60 次/10 分钟。首轮最多 4 次阿里提交、6 个页次，32,768 最大输出；不自动重试网络接受未知请求。审批后在 ignored authorization.json 记录人类原话与对应范围，独立工具先核验记录再发请求；未答复时仍可继续离线工作。

## 实测验收与继续条件

S1：原文忠实、指数/数字/符号不新增错误，河北尾段保留且不挂下一题，窗外续文不能伪完整，无号尾段保留，source_pages 与原页相符。合法 JSON 不代表通过。两轮固定配置，第一轮关键失败可直接淘汰。

S2/S3：按完整方案逐题全文、图片、归属、用量、时延、人工量核验；没有完整机器质量证据不得切换生产。失败结果保存，不能修改测试使候选通过。

离线门禁：narrow 新测试、npm.cmd run verify:safe、1189+既有新增规划文件/全部旧证据 hash、精确增量范围。新阶段 baseline 为 1194 既有非忽略文件和 1435 既有证据文件。

## 实施阶段连续执行规则

合格候选产生后，按完整方案第 11 节生成精确 implementation task/allowed files，再连续实施纯契约、执行器、身份、审核/图片、事务与回读，最后退役仅旧 PDF 新任务装配。阶段内部无需再次询问继续；外发扩大、DB schema 变更、保护 smoke 迁移和 commit/push 不由本任务推定授权。

停止收费条件：预算/调用/页次上限、未经允许输入/域名/模型、认证失败、未知接受状态、全部有限候选未达标。停止生产切换条件：质量门槛失败或 DOCX/准入/读回回归；仍可完成已授权离线诊断及报告。
