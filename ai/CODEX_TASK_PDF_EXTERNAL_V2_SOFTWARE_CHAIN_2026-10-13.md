# PDF V2 软件闭环实施任务 — 2026-10-13

用户最新指令：“你现在先别管 API 这些东西，你先把整体的链路搭完再说，做完之后我再给你。”本任务替代原“模型胜出后才能实施软件”的阶段顺序。连续完成软件链与隔离 mock 验收；停止所有真实 API/认证/网络诊断，不再消耗实测预算。原首次接受未知的请求、账本预留和授权记录保持，不将未知记成0费用。

## 目标

完整接通 V2 输入任务、固定页组/上下文、通用外部能力端口、原响应、结构/来源/整体序列/图片门禁、有效缓存与未知请求保护、完整草稿、来源问题展示、编辑/选候选/裁图/确认失效、现有事务与读回。默认外部配置禁用，服务待提供；隔离 mock 显式配置启用。软件验收与真实识别准确率验收分开，不声称模型已合格。

## 精确允许范围

- 新 `qisi-pdf-external-contract.js`、`qisi-pdf-external-producer.js`、`qisi-pdf-external-provider.js`，Node/browser 公共模块；纯机械字段/序列/资源检查，不本地识别、语义重建或解题。
- `qisi-qwen-vision-source-port.js` 仅单窗口传输函数补充可选 system/response_format 参数，供现有传输端口接入；终态拒绝/错误保留原响应供证据持久化，避免已收到拒绝误记提交未知；不改 DOCX 视觉工厂和任务客户端。
- `qisi-browser-pdf-renderer.js` 仅在原渲染数组附加非枚举的真实 totalPages 元数据，修复 V2 选页请求将“选中页数”误作“原卷页数”的问题；原像素、重试、DOCX 转换/渲染算法保持。
- `qisi-config.js` 仅新增默认 disabled 的 pdfExternal 配置；不改旧模板/题型。
- `qisi-production-import-bridge.js`、`qisi-production-import-output-port.js`、`qisi-docx-producer-identity-contract.js`、`qisi-formal-admission-policy.js`、`qisi-review-controller.js`、`qisi-review-draft-normalization-policy.js`：V2 显式身份、直通、审核失效与支持来源检查，不放松 DOCX/准入。
- `qisi-import-diagnostics.js` 及相关现有诊断测试：实际 UI 回放证明新阶段被旧白名单降为 unknown-stage；仅登记 V2 阶段/整数计数和已选厂商安全名称前缀，不放宽敏感字段日志规则。
- `app.js` 仅 producer 装配、PDF review dispatch、来源证据持久化、诊断/确认来源问题小量 glue；不改九个冻结 handler AST，不加识别/配对算法。`main.html` 仅 V2 模块加载及现有 PDF 来源/候选/问题卡复用，保留日常角色式操作。
- `architecture/{owners,layers,runtime-modules}.json`、`docs/architecture/{owners,layers}.json` 注册实际新模块/旧producer状态；`docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json` 只准确登记范围/AST计数，九个handler hash保持。
- `architecture/pdf-freeze-approved-repairs.json` 仅本任务明确变动的冻结文件逐项记录真实前后 hash，不在测试自动刷新。
- 新模块对应测试及 `tests/e2e/pdf-external-chain.test.js`；`tests/harness/browser-engine-injection.js`、`tests/e2e/browser-harness.js` 仅显式mock配置/新协议转换及故障注入。
- 现有 `tests/pdf-projection-single-owner.test.js`、`tests/e2e/pdf-projection-browser-shadow.test.js`、`tests/e2e/true-import-pdf-safe-partial.test.js`、`tests/e2e/production-normal-ui-import-cutover.test.js`、`tests/e2e/runtime-startup.test.js` 和实际断言V1正常入口的对应架构测试，只因用户有意切换新软件主链更新协议/加载断言；不得削弱安全失败期望。必要增加相关现有bridge/output/identity/admission/controller/normalization测试。
- `scripts/pdf-external-evaluation.js` 改为复用新契约中相同纯验证，避免两份业务验证；保留实验工具API兼容。
- 本任务、执行报告及 ignored `local-run-artifacts/pdf-api-first-v2-software-chain-2026-10-13/**` 快照/日志/隔离回放。

其他既有文件、依赖、package-lock、原PDF、gold、旧证据、凭据、生产DB、用户保护smoke只读；不commit/push，不部署或操作用户3000实例。保留历史 V1 contract/standalone验证，但新任务不装配 V1 producer，不隐式fallback。

## 验证与停止

先新纯函数失败例，再模块实现，再隔离正常UI验证：主卷/完整卷/配对卷、跨页、单侧缺口、倒序、图片选项、无号尾段、未读页、截断/无终态、缓存及提交未知、取消晚返回、编辑/选候选/裁图确认失效、人工确认/事务写入/读回/刷新、旧V1草稿兼容、DOCX+DOCX保持。所有传输mock，真实AI/网络拒绝。

最终 verify:safe、app-shell/runtime、精确增量/冻结内容/全部原证据hash；修复本范围失败，不修改安全坏例去适应错误。模型/真实价格/速度只留待后续给API后实测。数据库schema变更、保护smoke迁移、真实API和全量旧共享代码物理清空不在本任务。
