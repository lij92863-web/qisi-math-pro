# PDF 模型主导方案 A/B 离线实施任务

用户于 2026-10-14 明确要求根据通用修改方案进行修改。本任务落实其建议的 A/B 离线实施范围，保留已授权的 dirty 工作树与所有既有证据。原审计任务的“仅文档”限制已被本次业务修改请求解除；不沿用历史付费授权。

目标：v2.2 与独立模型复核协议、有限格式/引用一致性检查、新候选不提前受控写入；纯文本/视觉任务显式分离；逐物理请求状态与费用、接受未知保护、异步查询及完整缓存包恢复。复杂数学阅读和归属由模型负责，不新增本地语义算法。

允许文件：

- qisi-pdf-external-contract.js
- qisi-pdf-external-provider.js
- qisi-pdf-external-producer.js
- tests/pdf-external-contract.test.js
- tests/pdf-external-producer.test.js
- tests/pdf-external-model-led.test.js
- tests/harness/browser-engine-injection.js（仅为原 v2.1 fixture 显式指定历史版本，不改变断言或生产装配）
- tests/e2e/pdf-external-chain.test.js（只新增新协议在现有隔离 UI 中的 mock 验证，保留原场景）
- tests/fixtures/pdf-external-model-led.json
- 本任务文件、ai/PDF_MODEL_LED_AB_IMPLEMENTATION_2026-10-14.md
- local-run-artifacts/pdf-v2-model-led-ab-2026-10-14/ 内的新基线、差异和离线日志

允许既有 v2.1 fixture 显式选择旧 wire 版本；不得放宽坏例断言。新默认要求 v2.2；未指定版本的历史证据继续按 v2.1 校验，不追写模型复核。

禁止修改 app.js、main.html、样式、DOCX、冻结旧 PDF 模块、数据库、生产数据、依赖、凭据和原资料；禁止真实 AI/OCR、付费试验、服务重启、commit/push。若出现必要的额外文件，先依据当前用户授权更新本任务的具体范围，不扩大到 C—F。

基线：HEAD 71dfe18770e5161a19d38c07842d0ab865f20c92；1211 个既有非忽略文件、1658 个既有证据文件；详见本轮 baseline.json。增量以哈希核验，不以累计 Git diff 代替。

验证：新通用反例先红后绿；相关 V2 离线测试；npm.cmd run verify:safe（含 DOCX 稳定链、PDF known-bad、禁止真实 AI 与 batch mock）；最终既有文件/证据保全及精确允许范围报告。

停止：A/B 交付后停止；不进入服务选型、真实试验、UI 改造或默认启用。测试失败若超出范围则停止并报告。
