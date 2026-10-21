# Sol 接管实施任务 — 2026-10-19

用户本轮明确要求阅读并执行 SOL_COMPLETE_HANDOFF_ROOT_CAUSE_AND_REPAIR_2026-10-19.md。本任务按该交接第13节和 S0–S7 实施，覆盖旧的“仅交接”停止点。已有 dirty 改动全部保留，不 reset/stash/commit/push。

## 目标与步骤

1. S0 冻结交接基线，修 R15 定位器，运行安全门禁。
2. S1 固化 R03/R04/R05 和默认入口反例，阻断所有真实 AI/MinerU I/O，保留安全错误原因。
3. S2 修 DOCX 结构边界及字段身份，诊断本地公式失败；单独完成稳定链验收。
4. S3–S5 验证 canonical 来源/历史记录契约，补 MinerU 任务与资产生命周期，完成唯一 PDF 生产接线和旧执行链退役；每步先证明再修改。
5. S6 使用源 SHA 匹配的离线原始材料、隔离 UI/数据库与视觉检查验收；S7 复审及最终报告。

## 允许范围

范围限交接第3、5、6、7节列出的实际缺陷所有者及其直接契约消费者：DOCX importer/numbering/formula/source port/support parser/evidence；生产 bridge/output/status/route/controller；MinerU client/evidence/segmenter/pairing/ownership/production adapter 与本地 server 的对应路由；canonical/identity/formal admission/review 持久化及历史记录适配。旧 PDF 执行代码/专属配置/脚本仅在替代链验证后退役。必要新模块使用 qisi-*.js。对应 tests/fixtures、architecture 与 docs/architecture 登记、验证脚本及本任务/结果报告可随实际变更更新；修改前逐项记录依据，不做无关清理。

app.js 仅允许现有 PDF 工厂/传参、审核投影和证据映射委托；main.html 仅必要模块加载与错误展示。编辑前列明实际区域、行级范围和回归，不在协调层添加解析业务。

## 禁止

不调用真实 AI/OCR，不上传材料，不沿用历史付费预算；不改生产 IndexedDB/localStorage、用户库/素材/原始证据、.env/密钥、依赖/lockfile、代理；不提交推送；不猜归属、不弱化已知错误断言、不用旧链隐式回退。真实外发需在准备准确源清单/目的地/预算后另行取得授权，当前执行全部离线工作。

## 基线与验证

分支 stage/program-c-corrective-r1，HEAD 3099a47。基线副本/哈希/diff 位于 ignored local-run-artifacts/sol-repair-2026-10-19/，先核对交接 manifest。

每步：红绿反例、直接消费者回归、范围检查。最终：npm.cmd run verify:safe、verify:batch-safety、runtime-modules、app-shell、git diff --check。失败在范围内则修根因；范围外失败明确停止。报告区分离线结构验证、真实文件视觉验证和未获授权的在线验证。
