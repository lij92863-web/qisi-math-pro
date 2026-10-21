# 手工导入失败后续修复

用户明确要求继续查根因并修复，保留现有已授权 dirty 工作；不 reset/stash/commit，不操作生产数据，不调用真实 AI/OCR。

本轮范围：核实测试与真实入口的差异；修复已确认的审核 E2E Promise 回收假失败；保留导入失败的可安全公开原因；复审此前 DOCX 结构分段修复的异常序列处理。允许修改对应已有测试、qisi-production-import-status-port.js、必要的 qisi-batch-importer.js / qisi-support-text-parser.js 及报告。app.js、PDF 模型/路由、依赖、数据库结构不扩张。

已确认事实：浏览器 CDP 的错误为 Promise was collected，同一页面未导航且已持久化 reviewed。验收改为真实按钮点击、等待存储条件，并保留全部字段断言。PDF normal UI 使用 disabled 的 PdfExternalProducer，MinerU 服务端/脚本与正常入口尚未连通；本轮不把旧付费服务静默启用。

验证：针对性回归，离线正常 UI 配置回归，重复审核交互验证，verify:safe；DOCX 如有增量变动再跑 batch-safety。报告区分真实文件验收、模拟外部响应验收和未验证的在线服务。
