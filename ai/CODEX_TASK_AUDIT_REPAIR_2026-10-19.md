# 审计问题统一修复（用户已授权）

用户在阅读 REPORT_CODE_AUDIT_2026-10-19.md 后明确要求“现在认真修改”。基线3099a47；保留历史.workbuddy与本次审计报告，不reset/stash/commit/push，不调用真实AI/OCR，不写正式库。

目标：关闭审计F01–F12的代码缺陷，并纠正相关事务解释、删除详情读取边界与测试发现范围。按四个实现分组连续完成同一任务，不扩张MinerU上线、新讲义编排、软删除UI新功能或网络任务生命周期。

允许文件：qisi-support-evidence.js（唯一新增业务模块）、qisi-support-text-parser.js、qisi-docx-producer-identity-contract.js、qisi-production-docx-source-port.js、qisi-production-import-bridge.js、qisi-production-import-output-port.js、qisi-batch-importer.js、qisi-docx-numbering.js、qisi-draft-maintenance-service.js、qisi-storage-repository.js、qisi-utils.js、qisi-page-question-parser.js、qisi-handout-formula-gate.js；必要的main.html模块加载、architecture与docs/architecture相关登记；app.js仅打印格式化委托与未归属内容展示小范围接线；package.json仅限定正式测试发现范围；scripts/verify-write-boundary.js仅纠正错误的事务根因注释；相应tests/回归、ai/任务与完成报告。其他文件只读。

禁止：依赖变更/安装、package-lock、tmp、源材料、密钥、生产数据、旧PDF支持对齐/上游模型协议、app.js业务算法扩张、弱化既有known-bad门禁。

算法不变量：证据聚合满足交换/结合/幂等，冲突不因空值复活；角色先于证据消费；原文来源与范围保留；题目与答案区使用相同章节边界；段落位置使用原始坐标；同号异题不因字数合并；不同有效字段不自动择优；不可变草稿及其图片闭包守恒；选项识别保留既有合法语法且屏蔽数学区域；打印门禁与渲染使用同一规范化输入。

实施：先将审计反例固化为回归；按支持证据、结构/去重、维护资产、选项/打印四组修复；每组聚焦验证。最后verify:safe、docx-stable、pdf-known-bad、batch-safety、runtime/app-shell、精确diff范围。异常数据的正确结果是留证据待审核，不是抛整卷或猜答案。

app.js必要性：现有打印和未匹配展示消费者在其中；专属模块不能自行更改Vue调用参数。仅替换formatLatexForPrint函数体、传递门禁所需数据、修正showUnmatchedAnswerList字段展示；预期几十行以内，无新增解析业务。测试含门禁/打印同源、bridge持久化和全量浏览器回归。

输出：逐项关闭证据、测试结果、改动清单和剩余边界；完成后停止，不进入上述排除的新功能阶段。

生产路径补充（同一修复范围）：正常 UI 冲突回归证明 import-validation 将审核暂存与正式入库混为一谈；允许 qisi-import-validation-service.js 将有来源证据、字段已清空的 DOCX 支持冲突送入审核，正式准入策略不改。qisi-library-service.js 只纠正同类事务错误注释。追加修复后独立复审与回归，不扩展新功能。
