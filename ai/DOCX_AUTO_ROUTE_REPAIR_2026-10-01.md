# DOCX 结构读取与自动路由修复

用户明确要求 DOCX XML/OMML/MathType 结构读取，取代之前视觉路径。正常 UI 仅选择题目、答案或题目+答案，自动生成 docx-deterministic；PDF 保留其生产路径。

本地读取 Equation Native/MTEF，优先 MathType MT6.dll + LaTeX.tdl，JavaScript reader fallback，按 relationship ID 绑定。未知或冲突公式不猜，留待审核且阻止不完整公式入库。原文 XML、字节证据保留。新增四个 owner 已登记 runtime 及双架构清单。app.js 仅创建任务和审核载入的小量胶水，九个核心 handler 哈希不变。

实际文件、速度与后续全局修复详见 IMPORT_GLOBAL_AUDIT_REPAIR_2026-10-02.md。原始 before 快照在项目外 docx-auto-route-2026-10-01，不修改其内容。
