# 录题故障排查与修复记录 — 2026-09-15

## 状态

已复验并单独提交（不包含 H10 启动器改动）。不能宣称双 DOCX / 双 PDF 已全部修好：
本机 MathType 原生运行时的 AccessViolation 仍未解决，公式保真导入在该文件上仍受
完整性门禁限制。

接手时的 8 项未提交修改全部保留，未删除、未回退；本次未编辑 app.js。
上一次记录中「未提交」与「verify:safe 失败」的结论已被后续复验取代：
当时的两处门禁失败（handout H3、portable-launcher）各自定位为真实缺陷，已分别修复并
在 H10 / 讲义自动保存两个独立提交中处理，不混入本提交。

## 已确认的问题及改动

1. MathType 请求失败时，原实现直接抛异常，绕过 MTEF 本地兜底。
   现在将失败转换为逐公式失败记录，交给现有确定性恢复流程；成功批次保留。
2. MathType 响应没有在浏览器边界验证重复、外来或遗漏 ID。
   现在按请求 ID 返回；重复/外来 ID 的批次拒绝采信，遗漏项进入恢复。
3. MathType 请求无前端超时。新增 120 秒中断，允许进入本地恢复。
4. 原生崩溃二分隔离最多可启动 1023 次（512 项全部失败）。
   现在单批最多 15 次；这仍不是原生崩溃本身的修复。
5. 原生串行队列仅覆盖单个 Node 进程。PowerShell helper 增加同会话跨进程互斥，
   10 秒未取得锁时明确失败；不操作用户已打开的 MathType 进程。
6. MTEF 截断尺寸记录存在无限循环路径；其他截断记录及不支持的附加符号可能
   被静默忽略。现添加边界检查、完整性检查，未知附加符号拒绝输出错误公式。
7. PDF 代理只重试网络异常，不重试 HTTP 502/503/504。现共享原有最多三次
   尝试的上限；429 等拒绝继续原样返回，不增加模型升级或付费测试。
8. 连接超时曾被归为普通 502；错误说明字段也未匹配前端读取字段。
   现在按网络原因区分超时/DNS/断开，并返回前端可显示的 message。

## 实际证据与未解决问题

- 本机 64 位 MathType helper 实际出现 AccessViolationException，位置为
  MTXFormSetTranslator，即设置转换器阶段，而不是题目答案对齐阶段。
- 32 位运行时对照也失败，退出状态 3221225477，位置为 MTXFormEqn。
  没有将默认运行时改成 32 位，因为该方案没有通过验证。
- 真实 case01 两份 DOCX 共提取 195 个公式；纯本地 reader 可恢复 193 个。
  题目文件 rId76 / rId72 尚未恢复。因此原生转换不可用时，仍不能完成该文件
  的全部公式保真导入；不能删除完整性门禁来制造成功。
- 截图中的 AI_PROXY_FETCH_FAILED 确认来自代理网络异常路径；没有截图发生时
  的底层网络 cause，无法断言当时是 DNS、连接重置还是其他网络原因。
- 未调用真实 AI/OCR（0 次）；未做真实双 PDF 端到端准确率验收。
- 未修改正式题库、用户 IndexedDB 或原始 DOCX/PDF 文件。

## 验证

复验命令与结果（提交前，工作区包含本次改动）：

```text
npm run verify:docx-stable     20/20 通过
npm run verify:pdf-known-bad   65/65 通过
npm run verify:batch-safety    通过（DOCX stable、PDF known-bad、mock、no-real-ai）
npm run verify:no-real-ai      通过
npm run verify:safe            1375 总计，1367 通过，0 失败，8 跳过
```

- 新增 tests/import-failure-recovery.test.js：11 项契约测试全部通过。
- 原记录所列两处门禁失败已定位根因并修复，不再以「单独通过」掩饰：
  讲义插入失败来自 flushSave 在保存进行中直接返回（真实竞态，已修复）；
  启动器失败来自候选端口失败即整体中止（真实缺陷，已修复）。
- git diff --check：通过。

## 改动范围

生产文件仅五个，合计 +107/-45：

- qisi-docx-rich-content.js
- qisi-docx-mtef-reader.js
- qisi-mathtype-native-guard.js
- qisi-local-server.js
- tools/translate-mathtype-mtef.ps1

支持文件：tests/import-failure-recovery.test.js、ai/CODEX_TASK.local.md、本报告。
本地取证输出在 artifacts/import-reliability；包含真实材料的公式数据，**故意不提交**，
只作为本机取证保留。

H10 启动器改动、主界面启动视图修复、讲义保存竞态修复均已先行单独提交，未与本提交混合。
qisi-local-server.js 中只有 MathType 熔断、代理重试与错误说明属于本提交；服务 buildId
属于 H10 提交。

## 停止依据与下一步

当初停止的依据是 verify:safe 失败且原因看似超出范围；后续复验证明两处失败都是真实缺陷，
只是分属另外两个工作流，已分别修复并提交。本批次自身不再有未处理的门禁失败。

下一步需要解决本机 MathType 原生崩溃或补齐经过真值验证的本地公式转换；
随后完成真实双格式导入验收。
单靠增加重试不能解决原生组件崩溃，也不能证明 OCR 内容正确。

## 提交状态

本批次作为独立提交提交，消息为
`harden MathType/MTEF recovery and AI proxy failure reporting`。
