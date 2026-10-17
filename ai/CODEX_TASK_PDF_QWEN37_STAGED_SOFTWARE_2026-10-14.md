# 固定千问的分阶段模型任务 — 离线软件实施

用户在真实困难页失败报告后明确要求“继续”。本轮落实通用改进：原页全文/资源转写、纯文本结构整理、独立原页与实际裁图复核分别调用固定千问 3.7 Flash。保留所有已授权 dirty 工作和旧证据。本轮不付费识别，不重发未知请求，不默认启用，不进入整卷验收。

模型负责阅读顺序、全文保全、复杂公式/表格、题号边界、跨页续接、归属、图框和源异常。软件只检查合同/命名空间，机械编号块与资源、按模型框裁图，登记每个物理请求、费用和完整证据缓存，展示模型标疑和老师审核。不按深圳题号/“略”词语补文本，不降低正式入库门禁。

允许：新 qisi-pdf-page-evidence.js（纯页文合同/机械投影）；qisi-pdf-external-contract.js（导出既有 schema 检查、展示独立转写标疑）；qisi-pdf-external-provider.js（显式复用现有千问端口解析/整理、阶段提示、缓存恢复）；qisi-pdf-external-producer.js（完整缓存 profile 与校验、本地资源裁图先于复核、实际裁图/费用/标疑传递）；qisi-qwen-vision-source-port.js（PDF 多页请求传送实际裁图，保留既有 DOCX 端口）；qisi-config.js（关闭状态下固定三阶段 profile）；main.html（新模块加载、标疑来源链接条件）；architecture/{runtime-modules,layers,owners}.json、docs/architecture/{layers,owners}.json（精确登记新模块/依赖）；tests/pdf-page-evidence.test.js、tests/pdf-qwen-staged-pipeline.test.js、tests/fixtures/pdf-qwen-staged.json、tests/pdf-external-model-led.test.js、tests/e2e/pdf-external-chain.test.js；本任务、ai/PDF_QWEN37_STAGED_SOFTWARE_2026-10-14.md 和新 ignored 证据目录。

独立复核的执行顺序有意改为先取得实际裁图再复核，因此既有资源账目测试的阶段顺序可按该设计调整，仍验证实际调用/费用数量、原文不变和缓存恢复；不弱化错误断言。历史 direct/v2.1 与外部 parser 模式继续原接口；新绑定必须明确启用，不从失败自动 fallback。

禁止：app.js、DOCX 解析、旧冻结 PDF、正式入库策略、数据库/schema、生产数据、源文件、依赖/.env/凭据、服务重启、commit/push。无真实 AI/OCR 调用，既有付费额度与未知账本保留不变。

验证：泛化合成 fixture 覆盖前置证明/后文略、多页尾段、表格、无号尾段、不同题号与上下文；原文保持、合法本地标识、非有限坐标/假 blank/来源缺失拒绝；三个实际模型调用的 mock 账目、未知/失败费用、纯文本无图、原页与实际裁图复核、缓存损坏拒绝及提示/模型变化失效；隔离浏览器默认 profile 三阶段到人工候选，老 DOCX/PDF 场景不退化；最终 verify:safe、架构/运行时与精确增量/旧证据哈希核对。

浏览器隔离补充：允许 tests/harness/browser-engine-injection.js 给已有 v2.1 mock profile 显式指定 mode=direct。该 fixture 原本只模拟一次视觉识别，不能继承新生产默认三阶段模式；新三阶段浏览器场景单独覆盖默认分阶段配置。既有断言与生产配置不因隔离而降低。

停止：本离线软件范围交付即停；安全回归若出现范围外失败则停并报告。真实质量仍需另列完整阶段清单，不将 mock 当质量证明。
