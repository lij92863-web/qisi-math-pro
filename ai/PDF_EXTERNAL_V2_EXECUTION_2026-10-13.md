# PDF V2 连续执行记录 — 2026-10-13

状态：进行中。已开始执行，并非完整方案验收完成。

执行任务：`CODEX_TASK_PDF_EXTERNAL_V2_EXECUTION_2026-10-13.md`。用户要求连续推进，不在内部阶段索要“继续”。真实新候选外发问题已通过异步问题提出，离线工作同时执行；没有答复前不伪造新模型/目的地授权。

## 已完成

1. Git 预检，冻结 1194 既有非忽略文件和 1435 既有证据文件 hash；HEAD/分支与原设计基线一致。
2. 核验两卷原 PDF、两份既有子 PDF、三张原页图与原 manifest 的 hash，复用样本，不修改源材料或 gold。
3. 固定 `qwen3.7-flash-2026-07-15` 的首轮两份请求包，角色根据可见原页设为 support，元数据只含来源/原页，没有正确答案或纠正公式。深圳原 13 页包 238067 字节，河北原 6/7 页包 452057 字节；各 hash 见 request-packet.json。
4. 新增纯离线 `scripts/pdf-external-evaluation.js` 与 39 个测试：原始来源/页范围/输出所有权/角色、JSON 和终态、无号尾段、图片 token/资源/坐标、跨窗口倒序/重复/单侧缺口/共同缺口、显式单流支持、提示一次替换、真实 usage 分档费用、费用预留/未知提交/重复尝试。
5. 核对阿里 strict schema 实际关键词；模型端移除不支持的 uniqueItems，本地原 schema/重复页检查保持。固定版支持图像和 64K 输出，首轮保持显式 32768 上限；截断必须失败。模型权限、质量和实际 token 尚未实测。
6. 新增 ignored 独立测试工具，dispatch 前核人类授权、包/原图 hash、固定模型/域名、预算和单实例锁；请求先落账本，raw 先保存，再解码评估。dry-run 不加载密钥、不联网。实际执行授权缺失时已验证返回 HUMAN_UPLOAD_AUTHORIZATION_REQUIRED 且 dispatched=false，不产生提交账本。
7. 修复失效 verify:personal-stable 入口：退役 ownership 测试替换为当前 V1 契约及新 V2 原序检查；旧 runner preflight/dry-run 替换为隔离正常 UI PDF 保存重载验收。用户保护 smoke、历史 runner 和所有 DOCX/事务/准入套件保留。新增两项入口回归先红后绿；原 runner 测试按有意迁移更新固定清单和安全命令断言，真实调用禁令加强。

## 验证与未完成

39/39 新工具反例、6/6 稳定入口窄验证通过。首次完整门禁已通过新增工具；迁移稳定入口后，旧固定套件断言出现 2 项符合预期的失败，已明确修改范围并同步迁移断言，未改变业务坏例期望。最终 `verify:safe` 退出 0，主测试 1674/1674、DOCX 8/8、PDF known-bad 62/62、batch mock 8/8。最终 `verify:personal-stable` 也退出 0，15/15 套件通过，摘要保存为 personal-stable-summary.json。

增量范围检查通过：1194 个基线文件只允许修改验收脚本及其固定清单回归两项，新增6份任务/报告/工具/反例文件；1435个既有证据 hash 全部保持。原提示、schema、源 PDF、分支/HEAD保持，业务 runtime 未改。不是将历史 dirty 总量当作本轮贡献。

源码/日志：`local-run-artifacts/pdf-api-first-v2-execution-2026-10-13/`。其中 input-manifest/request-packet/provider-capabilities 描述实际配置，authorization-guard.log 是无发送证明；所有 red/失败日志保留。此前阶段的证据原样保留。

仍须：获得新候选实测外发范围答复；执行首轮并逐页核验，合格后继续13页/完整卷及独立保留集；只有胜出后才接生产身份、审核、图像、事务和退役 V1 新任务入口。没有模型准确性实测，不能报告成本/精度优化已达成。当前没有发现可用 GLM 或 MinerU API Token，不在聊天索要明文密钥，也不把 OpenXLab AK/SK 直接当作 MinerU Token。

生产 runtime、DOCX、源材料、数据库、正式入库、依赖、提示/schema原版保持；本轮未 commit/push。当前真实新候选调用 0、上传 0、新增识别费用 0。
