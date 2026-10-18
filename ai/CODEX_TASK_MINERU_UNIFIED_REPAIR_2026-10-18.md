# MinerU 统一证据与准入修复

用户在审计交接后明确要求开始修复，并再次要求从根因设计算法、解决一类问题，禁止按具体试卷补丁。当前 dirty 与 frozen-for-astra.json 的 14 项 SHA256 全部一致，是已授权继续处理的输入；保留既有 DeepSeek/本会话修改，不 reset/stash/commit/push。

本轮有界目标：统一 MinerU 识别结果的规范化、来源引用、确定性分段与模型字段归属的准入契约，消除错误仍能输出可用答案/解析、共享选项复制、预览协议分叉和 HTTP 证据丢失。先设计后实现，离线反例、六份既有结果重放和完整安全门禁验收。网络任务/资产持久化与正式 UI 接入在报告中单列，未经实际闭环不称完成。

允许：qisi-mineru-client.js、qisi-paper-segmenter.js、qisi-paper-pairing.js、qisi-block-ownership.js、qisi-block-ownership-prompt.js、新的纯函数 qisi-mineru-evidence.js；qisi-local-server.js 仅 MinerU 响应协议透传；scripts/build-mineru-preview.cjs；上述对应 tests；architecture/runtime-modules.json 仅新模块登记；本任务、设计、协议和验证报告；ignored local-run-artifacts/mineru-unified-2026-10-18。

禁止：app.js、main.html、DOCX/旧 PDF 生产链、依赖、数据库、原始资料、系统代理、真实 AI/OCR、提交推送。此范围覆盖审计 A/B/C 及 D01 的身份部分；其他生命周期问题不可通过改阈值伪装修好。

验收：错误引用/错序/重复/冲突零支持材料绑定；原文片段守恒；模型不能扩大确定性来源范围；复用同一规范化入口；语法/结构/原页准确性分别报告；verify:safe、batch-safety、runtime/app-shell/diff-scope。
