# STAGE C7T Field-Level Controlled Write

## 当前封点信息

- commit: `1a57d88`
- tag: `stage-c7t-field-level-controlled-write-mock-verified`
- branch: `stage-c7t-next-safe-work`
- working tree clean
- `verify:safe` passed
- real AI/OCR not called

## 本阶段目标

PDF support 不再 parser 整体替换 legacy，改为 answer / solution 字段级 controlled write。

## 已完成内容

- 新增 `qisi-pdf-support-controlled-write.js`；
- `main.html` 加载 controlled write 模块；
- `package.json` 的 check 脚本加入 `node --check qisi-pdf-support-controlled-write.js`；
- `app.js` 只保留薄调用，净增控制在 `+80` 行；
- `tests/batch-smoke-mock.test.js` 增加相关 mock 覆盖；
- 不再 `selectedSource=parser` 后整体替换 legacy；
- 新增 `buildPdfSupportFieldLevelControlledWrite`；
- 生成 `effectiveAnswerItems` / `effectiveSolutionItems` / `fieldDecisions`。

## 安全策略

- objective 题 legacy safe answer 优先保留；
- parser answer 必须经过客观题答案安全闸；
- parser answer=选项内容值时，只能在精确匹配 options 时转换为 A/B/C/D；
- parser answer 被拒，不影响 parser solution 在安全条件下写入；
- fused / 回跳 / 非可靠序列不得写入模拟草稿；
- 不允许 parser 原始 answer 绕过 aligner 或 controlled write 直接写草稿。

## 已通过测试

- `npm.cmd run check`：通过；
- `npm.cmd test`：66/66 通过；
- `npm.cmd run smoke:batch:mock`：7/7 通过；
- `npm.cmd run verify:safe`：通过。

## 明确未做

- 未调用真实 AI/OCR；
- 未做真实 PDF+PDF 上传识别；
- 当前只是 mock-verified，不是 real-verified；
- 未提交入库测试。

## 下一步建议

- 不要马上真实 PDF 测试；
- 先设计 C7U / C8 真实 PDF 测试门槛；
- 真实测试只到审核页，不提交入库；
- 测试前必须说明是否调用 AI/OCR、调用次数、成本风险、回滚方式；
- 若真实测试发现问题，优先增加诊断和 mock fixture，不要直接补语义规则。
