# I1 导入消费者与历史身份盘点

2026-10-22。实际检查目录：C:/Users/Administrator/Desktop/qisi-w2-candidate-20261021，HEAD 512a5d8427f4732ff14bcc54dd76de6b093625ad，加本轮已验收 E1–E3 修改；E3 完整 safe 2362/2362。I1 不修改运行代码。

动态证据：本目录 I1-observations.json；可复现脚本 probe-i1.cjs；静态引用逐项包含文件、行号和原句。浏览器使用端口 32858、独立合成 IndexedDB；截图响应替身只观察保留端口，无真实 AI/OCR 请求。

| 入口 / 消费者 | 分类及实际证据 | 处理决定 |
|---|---|---|
| 普通 DOCX 新批次 | 在用：RoutePolicy.selectNormalUiProducerMode 返回 docx-deterministic；app 的 ProductionDocxSourcePort runner → Bridge → 受控 persistence；真实 DOCX 身份/单文件/分离 support 的既有 UI 测试在 E3 safe 全绿 | 保留确定性链，不改解析或答案策略 |
| 普通 PDF 新批次 | 在用：RoutePolicy 返回 pdf；app 的 PdfMineruProducer 及现有 controller；单/双文件回放、未配置/锁定/保守序列等测试在完整 safe 中通过 | 保留；不得在 DOCX 退役修改中迁移 PDF producer |
| docx-vision 新批次 | 已退役：RoutePolicy 明确 PRODUCTION_IMPORT_PRODUCER_RETIRED；浏览器真实 DOCX 身份测试不进入 producer/OCR | 继续拒绝，不能偷偷转 deterministic 身份 |
| 历史 docx-vision 草稿显示 | 历史读取：probe 将合成批次/文件/草稿身份设为 vision，openBatchReview 成功显示原 sourceMode、rawText 和编辑源 | 保留 identity contract/schema/草稿读取；不借退役删除历史字段 |
| 历史 vision 重跑 | 已退役：通过真实 runBatchRecognition/controller/Bridge 拒绝，错误为 PRODUCER_RETIRED；重跑前后草稿字节一致，batch.producerMode 未变，正式库 0 | I2 继续保护明确拒绝及历史身份；已验证 prepared 在 committed-replay 之前，不存在直接借幂等成功绕过 route 的路径 |
| Bridge.recognition-source-loaded 的 vision 分支 | 应闭合：源代码仍可调用 ports.runDocxVisionImport，能力表仍探测该端口；正常 route 不可达，当前 app 未装配，但自定义 resolver/全局工厂仍有残余执行面 | I2 在 Bridge 接受选择结果时拒绝该身份、移除执行分支与能力探测 |
| Bridge.runDocxVisionShadow | 应闭合：公开工厂方法，既有 tests/docx-producer-route-contract.test.js 实际证明仍委托 vision shadow 端口；当前页面无生产调用者 | 保留同名明确退役拒绝接口作为兼容墓碑，不再调用端口；不假称历史读取依赖此执行方法 |
| ProductionDocxVisionSourcePort / DocxVisionReconciler 页面入口 | 已退役：main 无 script，runtime 为 dormant；浏览器 visionLoader/visionGlobal 均 false | 保持不加载；源码及纯投影 shadow 单测作为明确隔离历史/研究材料保留，不恢复生产入口 |
| app.strictQuestionPageRecognizer | 无用装配：静态只有声明；浏览器计数显示构造 1 次、执行 0 次；其 projectDocxVisionCandidate 依赖属于已退役装配 | I2 删除该未使用实例；不删除共享模块或通用工厂 |
| 手工截图识别 | 在用：真实文件 input → handleOcrChange/handleOcrFile → qwenDocumentOcrSource.recognizeManualQuestion；probe 实际传入合成 PNG，保留端口被调用一次，页面 OCR 草稿得到替身文本；严格 recognizer 执行仍为 0 | 保留 QwenVisionSourcePort.createProductionOcrRuntime、documentOcrSource、OCR adapter、文件读取/输出；测试不触及真实端点 |
| Qisi 全局工厂 | 在用/兼容：Bridge/Qwen 工厂在浏览器存在；vision producer 全局不存在 | 对 Bridge 退役方法明确 fail closed；不能凭 app 无字符串引用就认定所有动态调用消失 |
| deliverables 下历史 app.js | 归档证据：静态 grep 可命中旧 producer 装配；不在 main/runtime script 清单 | 原位保留，不据其历史引用恢复加载或删除档案 |

I1 退出结论：上述入口均有分类与具体后续决定，没有将“没有静态引用”单独当作删除证据。I2 只闭合明确已退役执行面；I3 再单独处理有效导入装配/缓存与会话应用顺序。截图、PDF、历史身份读取及正式准入不在退役删除范围。
