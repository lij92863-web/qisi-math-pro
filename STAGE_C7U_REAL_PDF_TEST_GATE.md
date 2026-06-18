# STAGE C7U Real PDF Test Gate

## 阶段目标

设计真实 PDF+PDF 测试门槛，明确什么时候允许从 mock-verified 进入 real-review 测试。

## 当前前提

- DOCX+DOCX 仍是稳定主链；
- C7T 只是 mock-verified，不是 real-verified；
- PDF support 当前原则仍是宁可空，不错挂；
- controlled write 已经实现字段级 answer / solution 决策；
- 真实测试只能验证到审核页，不允许提交入库。

## 真实测试前置条件

真实 PDF+PDF 测试前必须满足：

- `git status --short` 为空；
- 当前分支明确；
- 已有可回滚 tag；
- `npm.cmd run verify:safe` 通过；
- 明确测试文件来源；
- 明确是否调用 AI/OCR；
- 明确预计调用次数；
- 明确可能产生费用；
- 明确只到审核页，不提交入库；
- 明确测试结果记录方式。

## 真实测试允许范围

允许：

- 上传 PDF 题目文件；
- 上传 PDF 答案/解析文件；
- 只观察识别结果；
- 只进入审核页；
- 记录题量、题号、answer、solution、warnings、fieldDecisions；
- 截图或复制 diagnostics；
- 不提交入库。

禁止：

- 不说明成本就运行真实识别；
- 连续反复跑真实 AI/OCR；
- 真实测试后直接补语义规则；
- 发现错挂后继续扩大测试；
- 将疑似错答案提交入题库；
- 为了填满答案牺牲安全闸；
- 绕过 aligner 或 controlled write 直接写草稿。

## 观察指标

至少记录：

- expectedQuestionNumbers；
- parser answerItems；
- parser solutionItems；
- legacy answerItems；
- legacy solutionItems；
- align mode：full / prefix / fail-closed；
- effectiveAnswerItems；
- effectiveSolutionItems；
- fieldDecisions；
- 被拒字段原因；
- objective answer 是否为 A/B/C/D 标签；
- parser answer=选项内容值时是否正确转换；
- parser answer 被拒时 parser solution 是否仍可安全写入；
- fused / 回跳 / 断号是否 fail-closed 或不写入；
- DOCX+DOCX 是否未受影响。

## 失败处理原则

如果真实 PDF 测试失败：

- 先记录 diagnostics；
- 先补 mock fixture；
- 先补单元测试或 batch mock；
- 不允许直接写语义关键词补丁；
- 不允许按题号特判；
- 不允许根据数学内容相似度挂答案；
- 不允许扩大 app.js 业务逻辑；
- 修改必须进入 qisi-*.js 模块；
- 修改后必须重新跑 verify:safe。

## 真实测试分级

- Level 0：不调用 AI/OCR，只跑 verify:safe 和 mock。
- Level 1：单份小型 PDF+PDF，最多一次真实识别，只到审核页。
- Level 2：两套不同格式 PDF+PDF，每套最多一次真实识别，只到审核页。
- Level 3：真实回归测试，但必须另行批准，不得默认执行。

## C7U 结论

C7U 只产出真实测试门槛文档，不进入真实测试。后续若要进入 C7V，需要用户明确批准真实 AI/OCR 调用。
