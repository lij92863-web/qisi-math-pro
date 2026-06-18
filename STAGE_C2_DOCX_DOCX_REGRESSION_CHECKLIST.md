# Stage C2 DOCX+DOCX 人工回归清单

## 1. 回归范围

本清单只覆盖：

```text
DOCX 题目 + DOCX 答案
```

不覆盖：

```text
PDF+PDF
PDF 题目 + DOCX 答案
DOCX 题目 + PDF 答案
图片批量录题
复杂多源合并
PDF 渲染
PDF 公式识别
PDF 低置信度质量闸
C-2 merge
```

回滚锚点：

```text
stage-c2-docx-docx-stable
```

## 2. 回归前检查

1. 确认当前分支：

```powershell
git branch --show-current
```

通过标准：

```text
输出为 stage-c2-next-safe-work
```

2. 确认工作区状态：

```powershell
git status
```

通过标准：

```text
没有未预期的 js/html/css/json/package 文件变更。
```

3. 启动本地服务：

```powershell
npm.cmd start
```

通过标准：

```text
本地服务正常启动，浏览器可打开 http://127.0.0.1:3000/main.html
```

## 3. 导入流程

1. 浏览器打开：

```text
http://127.0.0.1:3000/main.html
```

通过标准：

```text
页面正常加载，无启动报错。
```

2. 强制刷新：

```text
Ctrl+F5
```

通过标准：

```text
页面加载最新 app.js，没有旧缓存表现。
```

3. 进入批量录题：

```text
点击左侧或顶部导航中的“批量录题”。
```

通过标准：

```text
进入批量录题页面，可以看到创建任务入口。
```

4. 创建任务并上传 DOCX 题目文件：

```text
点击创建任务，上传题目 DOCX。
```

通过标准：

```text
文件出现在已添加文件列表中，文件类型显示为 Word/DOCX。
用途设置为“题目”或包含题目角色。
```

5. 上传 DOCX 答案文件：

```text
继续上传答案 DOCX。
```

通过标准：

```text
文件出现在已添加文件列表中，文件类型显示为 Word/DOCX。
用途设置为“答案”或“答案 + 解析”，视实际文件内容而定。
```

6. 检查默认信息：

```text
确认年级、题型、难度、来源、知识点等默认信息。
```

通过标准：

```text
默认信息可为空或按测试需要填写，不影响 DOCX+DOCX 主链识别。
```

7. 创建识别任务：

```text
点击“创建识别任务”。
```

通过标准：

```text
任务进入识别流程，最终进入审核页。
没有弹出 fatal error。
没有进入 PDF+PDF 专用流程。
```

## 4. 审核页检查

1. 检查草稿数量：

```text
观察左侧题目列表和顶部统计。
```

通过标准：

```text
题目数量符合 DOCX 题目文件预期。
没有明显重复题、缺题、错位题。
```

2. 检查题号：

```text
逐题查看题号顺序。
```

通过标准：

```text
题号与 DOCX 题目文件一致。
不得出现手工补题号、顺序兜底导致的错配。
```

3. 检查题干：

```text
逐题查看题干源码和右侧预览。
```

通过标准：

```text
题干为正常数学题文本。
不得出现 raw JSON、XML 残片、大段乱码或明显串题。
```

4. 检查选择题 options：

```text
重点检查第 1-9 题或本轮测试集中所有选择题的 A/B/C/D。
```

通过标准：

```text
选项数量正确。
选项内容显示在 options 区域或题目预览中。
不得丢 A/B/C/D。
不得把选项并入题干后无法辨认。
```

5. 检查 LaTeX 显示：

```text
查看题干、选项、答案、解析中的公式。
```

通过标准：

```text
合法 $...$、\(...\)、\[...\] 正常渲染。
选项标签如 A.、B.、C.、D. 不被公式归一化改坏。
不得出现 C$. \frac{...}$ 这类标签污染。
```

6. 检查答案：

```text
逐题查看答案区域。
```

通过标准：

```text
答案能按题号匹配到对应题目。
不得出现整体错位、上一题答案进入下一题、答案缺失但源文件存在。
```

7. 检查解析：

```text
逐题查看解析区域。
```

通过标准：

```text
解析能按题号匹配到对应题目。
解析不应被错误清空。
正常解析不应因为关键词差异被阻止确认。
```

8. 检查图片和公式图片占位：

```text
查看题干、选项、预览中的图片 token 或公式图片占位。
```

通过标准：

```text
可显示图片应正常显示。
不可直接转换的 WMF/EMF/OLE 占位应留给人工核对，不得静默当作完整 LaTeX。
```

## 5. 操作流程检查

1. 保存编辑：

```text
任选一道题做轻微人工编辑并保存。
```

通过标准：

```text
保存成功，刷新后内容仍在。
```

2. 标记确认：

```text
点击“标记已确认”。
```

通过标准：

```text
题目状态变为已确认。
不得被“解析与题干关键词差异较大”阻塞。
不得被 PDF 低置信度质量闸误伤。
```

3. 提交入库：

```text
对已确认题目执行提交入库，或打开提交已确认题目汇总。
```

通过标准：

```text
已确认且硬校验通过的题目可以提交。
正式题库 questions 被新增对应题目。
正式图片 images 不被清空或误删。
```

## 6. 浏览器侧自测

在控制台执行：

```javascript
window.__qisiLatexDisplayNormalizeSelfTest?.()
```

通过标准：

```text
返回 ok: true。
multiple-options 用例通过。
```

如存在 DOCX golden 自测入口，可执行：

```javascript
window.__qisiTestBatchDocxGolden?.()
```

通过标准：

```text
返回结果中 failedQuestions 为空或无关键失败。
题目、选项、答案主链符合预期。
```

## 7. 必须立即停止并回滚的现象

出现以下任一现象，立即停止继续测试，不要继续修补当前工作区：

```text
1. DOCX+DOCX 无法进入审核页；
2. 题目 DOCX 被错误走成 PDF+PDF 修复实验链路；
3. 低置信度质量闸重新影响 Word+Word 审核；
4. validateDraftForReview、draftQuestionProblems、markDraftReviewed、提交逻辑出现非预期改动；
5. parser、repair、qisi-batch-importer.js、qisi-batch-engine-v2.js 被非任务修改；
6. 题干出现 raw JSON；
7. 题号明显错位或批量重复；
8. A/B/C/D 选项大面积丢失或被并入题干；
9. 合法 LaTeX 选项标签被改坏，例如 C$. \frac{1}{2}$；
10. 答案/解析 coverage 明显缺题但流程仍假成功；
11. 正式题库 questions 或正式图片 images 被清空；
12. customTemplates 或 personalKnowledge 被清空；
13. DB schema 被修改；
14. PDF 渲染、prompt、模型、C-2 merge 被牵动。
```

回滚锚点：

```text
stage-c2-docx-docx-stable
```

建议回滚前先保存证据：

```powershell
git status
git diff --name-only
git diff --stat
```

然后按团队约定回到稳定锚点。

## 8. 回归通过记录模板

```text
日期：
分支：
测试文件：
题目数量：
答案/解析文件数量：
是否进入审核页：
options 是否正常：
LaTeX 自测是否 ok:true：
是否可标记确认：
是否可提交入库：
异常记录：
结论：通过 / 不通过
```
