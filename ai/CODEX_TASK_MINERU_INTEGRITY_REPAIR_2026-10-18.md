# MinerU 内容及归属完整性修复

用户明确要求分析根因、严格设计算法并解决一类问题。保留并修复现有 DeepSeek 未提交实现，当前 dirty 是已审查的任务输入，不 reset/stash/commit/push。上一轮六份真实结果全部离线复用，不再次调用识别服务。

允许：qisi-mineru-client.js、qisi-paper-segmenter.js、qisi-paper-pairing.js、qisi-block-ownership.js、qisi-block-ownership-prompt.js；对应 tests；ai/MINERU_BLOCK_PROTOCOL.md、本任务与算法/验证报告；scripts/build-mineru-preview.cjs（仅引用协议消费者）；architecture/runtime-modules.json（登记已有 pairing 模块）；ignored local-run-artifacts/mineru-repair-2026-10-18。

目标：统一无损内容、边界语法、来源片段、编号验证与配对准入。修复图片标题/脚注遗漏、明确答案标记不能识别、多题同块、引用失联、重复/倒序仍绑定等同类问题；保留错误证据，不按文件名/具体题号/数学语义修补。

禁止：app.js/UI/生产导入路线/DB/DOCX/依赖/环境配置/代理修改，网络识别、提交、推送。暂不扩大为正式 UI 接入、图片持久化或网络客户端重构。

基线：85441f5 与开始时未提交修改；修改前文件及 SHA256 已保存于 local-run-artifacts/mineru-repair-2026-10-18/before。

验证：先用合成反例证明缺陷；纯模块回归及变形测试；六份 raw content_list 离线重放与两文件真实配对；已识别的 caption 与来源片段视觉检查；verify:safe、架构/差异范围检查。现有测试若明确要求异常顺序仍附答案，改为更严格的空绑定断言，并记录这一行为修正，不删坏例。
