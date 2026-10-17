# PDF 模型主导方案 A/B 实施报告

日期：2026-10-14。依据用户“现在根据通用修改方案进行修改”的授权和 [本轮任务](CODEX_TASK_PDF_MODEL_LED_AB_2026-10-14.md)。本轮完成离线协议、模型复核端口、调用状态与缓存修改，停在真实服务选型前。

## 修改结果

| 文件 | 实际修改 |
| --- | --- |
| qisi-pdf-external-contract.js | 单独冻结 v2.2 与 review-v1 schema，保留 v2.1；检查 ID、明确题号标记、来源页、原文引用、外部 block 引用、补页请求及 blank/正文冲突；复核核对候选哈希、页/条目覆盖，保留 fail/uncertain/遗漏；新候选不提前受控写入。 |
| qisi-pdf-external-provider.js | 明确直接视觉、带图整理、纯文本整理、独立原页复核及整条目修订端口；纯文本采用白名单请求对象；每个实际阶段在调用前登记、返回/失败后留痕。 |
| qisi-pdf-external-producer.js | 新默认 wire v2.2、连续文档范围；每次 direct/parse/query/organize/review/resource 请求分别留痕、预算和核价；未知受理阻止后续提交；恢复异步原任务；缓存完整解析包、原响应、复核及已取得的图片字节；缓存复核重新核对哈希；同一运行环境内同批次并发互斥。 |
| tests/pdf-external-model-led.test.js | 新协议、模型复核、费用、未知状态、缓存资源、异步预算、并发、全范围输入及缓存哈希反例。 |
| tests/pdf-external-producer.test.js | 原 fixture 显式选 v2.1；异步 mock 明确查询免费；明确拒绝 mock 明确提供未受理信号。原安全断言不放宽。 |
| tests/harness/browser-engine-injection.js | 历史 mock 明确选 v2.1，继续验证历史导入与审核链。 |
| tests/e2e/pdf-external-chain.test.js | 增加 v2.2 隔离正常 UI 场景，验证模型复核保存、缓存重跑、人工采用阻断、刷新保全；原三场景保留。 |

新协议不把模型的 observed_complete 显示为已验收完整。modelObservation、modelReview 与 humanReview 分开；模型 pass 不将字段改为 controlled-write。现有人工候选选择/字段编辑仍可显式采用内容并走审核流程，不新增自动入库通道。

本地没有增加分题、跨页语义拼接、答案相似度匹配、数学纠错、表格重建或全文覆盖证明。新默认向模型提供完整连续范围；受容量限制时可以显式选择 window，模型缺页请求保存为证据，本轮不自动递归补页或升级模型。

## 接口与费用约定

新配置至少须明确 model、reviewModel 和相应识别/复核 bindings。缺复核配置会在识别提交前停止。`mode: parse-organize-text` 才是纯文本整理；strict schema 只在 `strictTextSchema: true` 时请求服务支持的投影，并保留本地完整约束。视觉模式不假称 strict schema。

每个物理阶段保留 operation、requestId、requestHash、model、wire/parser 版本、输入页出现次数、注册/返回时间、原响应、usage、费用及预留。maxCalls 包括识别/解析/整理/复核/资源操作；query 另受 maxQueries 限制。maxPageAppearances 限制识别、解析和整理输入页出现，查询/资源读取为零页；金额上限包含全部阶段的已知费用和未知预留。

有有效 usage 的非法 JSON、拒绝或截断响应照样核价；缺价格或计费依据保持 unknown 与预留。查询/资源不擅自视为免费：只有适配器明确 CNY billing 回执，或可信配置 queryYuanPerCall/resourceYuanPerCall 明确价格时才结算。服务 adapter 必须声明未受理证据（submissionAccepted=false 或 definitelyNotSubmitted=true）；不能仅凭 HTTP 429/503 判断可重发。

异步查询返回的 billing 是原解析任务的费用，更新原 parse 账目；queryBilling 才是本次查询的费用。保留初始受理回执与最终 billing/usage，不把解析费重复计入 query，也不因解析内容不合格而推迟已知费用结算。

异步任务预算不足时保持 parse_pending 和原 jobId，不能退回重新上传。缓存恢复与首次执行采用相同协议检查；复核结果还需与当前候选哈希一致。原图资源在成功取得后缓存字节，多处放置可复用一次资源获取；失败和未知请求也留在同一账目中。

并发门禁是当前 JavaScript 运行环境内的批次互斥，不声称已经实现多桌面窗口/多进程的持久租约。实际生产接入阶段还须绑定持久互斥/预算端口并做跨窗口验证，才能承诺跨进程原子性。本轮不新建数据库 schema 或改生产存储来隐藏这个差别。

## 验证

证据目录：`local-run-artifacts/pdf-v2-model-led-ab-2026-10-14/`。

- stage-a-red.log：新协议/复核/人工采用反例在旧实现上失败。
- stage-a-focused.log：54/54。
- stage-a-verify-safe.log：exit 0，主测试 1711/1711，DOCX 8/8，PDF known-bad 62/62，batch mock 8/8。
- stage-b-red.log：新账目、独立复核、并发门禁在旧 producer 上失败。
- stage-b-focused-final.log：87/87。
- stage-b-browser.log：4/4，隔离端口 32171—32174，真实 AI 请求被阻断，未使用用户生产库。

最终 `stage-b-verify-safe-closed.log`：exit 0，主测试 1726/1726、DOCX 稳定链 8/8、PDF known-bad 62/62、batch mock 8/8，均无失败，禁止真实 AI 检查通过。此前阶段日志全部保留；最后一次覆盖缓存复核哈希与异步费用分离的最终代码。主测试绿色仅证明协议、软件状态及 mock 链路，不证明任何外部模型已经通过真实识别验收。

精确范围：基线 1211 个非忽略文件中仅六个允许文件发生修改，新增三个非忽略文件（本任务、报告、新测试）；原有 1658 个证据文件哈希全部不变。无范围外修改，原退役删除保留。`app.js`、DOCX、架构登记、生产配置、用户材料及前轮审计/方案哈希均不变。详情见 `scope-and-preservation.json`。

分支仍为 stage/program-c-corrective-r1，HEAD 仍为 71dfe18770e5161a19d38c07842d0ab865f20c92。Git status/diff 仍包含之前的大量 dirty 内容，不能将其计作本轮变化。业务模块相对本轮快照增量为：contract +120/−12 行、provider +39/−9 行、producer +114/−28 行；精确增量快照与逐文件差异保存在证据目录。

## 边界与下一步

生产配置仍默认关闭。A/B 报告交付后，用户再次明确模型为千问 3.7 Flash；当前已固定 `qwen3.7-flash-2026-07-15`，不能再称模型未选定。后续配置与端口修订见 [模型选择落实记录](PDF_QWEN37_SELECTED_2026-10-14.md)。A/B 本轮没有真实 AI/OCR、付费调用、用户生产数据修改、依赖安装、服务重启、commit 或 push。app.js、UI 模板/样式、DOCX 与退役旧 PDF 文件均不在本轮修改范围。

提供的是 A/B 软件能力；后续已落实千问 3.7 Flash 配置及现有视觉传输的独立复核复用。剩余是固定模型的真实困难页验证（C）、生产持久互斥及传输验收（D）、模型复核并排审核 UI（E）、独立整卷质量与成本验收（F），不再包含重新选择大模型。whole-document 默认不保证任意大文件能一次容纳；超容量、缺页或不合格结果必须保留为失败/待审核，不能自动降级到旧本地语义算法。

下一任务应先冻结具体服务、模型、页清单、价格和有界预算，再做困难页实验；不能把 mock 通过或本次用户的业务修改要求当作付费授权。
