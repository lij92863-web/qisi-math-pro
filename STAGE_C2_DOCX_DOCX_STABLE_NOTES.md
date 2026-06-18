# Stage C2：DOCX+DOCX 稳定主线封版记录

## 1. 当前稳定 commit

当前稳定基线：

```text
commit: 28a904d
message: stage C2 stable baseline DOCX DOCX restored
tag: stage-c2-docx-docx-stable
status: working tree clean
```

当前主线目录：

```text
C:\Users\Administrator\Desktop\gpttiku
```

---

## 2. 当前支持范围

当前封版能力只确认覆盖：

```text
DOCX 题目 + DOCX 答案
```

PDF+PDF 暂停推进，不作为当前封版能力。

---

## 3. 已通过内容

已确认通过：

```text
1. DOCX 题目 + DOCX 答案主链恢复稳定；
2. Word+Word 审核页不再被低置信度质量闸误伤；
3. 题目、选项、答案主链可进入审核流程；
4. 第 1—9 题 options 显示正常；
5. 碎片 LaTeX 展示归一化自测通过；
6. 选项标签不再被 LaTeX 归一化误改；
7. Git 已初始化；
8. 当前稳定基线已提交；
9. 当前稳定 commit 已打 tag；
10. working tree clean。
```

---

## 4. 不覆盖内容

本稳定记录不覆盖：

```text
PDF+PDF；
PDF 题目 + DOCX 答案；
DOCX 题目 + PDF 答案；
图片批量录题；
复杂多源合并；
答案/解析图片绑定；
C-2 merge；
PDF 页面渲染；
PDF 公式识别；
PDF 低置信度质量闸。
```

---

## 5. 后续开发原则

```text
1. 先 Git 固定，再继续开发；
2. 一项任务一个 commit；
3. 每次修改前先 git status；
4. 每次修改后先 node --check 和 npm test；
5. 新功能不得污染 DOCX+DOCX 稳定主线；
6. PDF+PDF 后续必须单独开分支或单独阶段处理；
7. 实验功能先做只读诊断，不直接进入全局审核/提交拦截。
```

---

## 6. 最小回归清单

每次修改后至少检查：

```powershell
git status
node --check app.js
npm.cmd test
npm.cmd start
```

浏览器侧最小回归：

```text
1. Ctrl+F5 强制刷新；
2. 进入批量录题；
3. 导入 DOCX 题目；
4. 导入 DOCX 答案；
5. 开始识别；
6. 进入审核页；
7. 检查第 1—9 题选项是否正常；
8. 检查 LaTeX 是否正常显示；
9. 检查没有低置信度质量闸误伤；
10. 检查可以正常标记确认；
11. 检查没有 raw JSON 进入题干；
12. 检查可以继续入库流程。
```

---

## 7. 禁止事项

当前阶段禁止：

```text
1. 不要继续修 PDF+PDF；
2. 不要重新加入低置信度质量闸；
3. 不要改 validateDraftForReview；
4. 不要改 draftQuestionProblems；
5. 不要改 submitReviewedDraftQuestions；
6. 不要改 markDraftReviewed；
7. 不要改 parser；
8. 不要改 repair；
9. 不要改 PDF 渲染；
10. 不要改 prompt；
11. 不要改模型；
12. 不要改 DB；
13. 不要改 C-2 merge；
14. 不要恢复顺序兜底；
15. 不要手工补题号；
16. 不要让 PDF 实验功能污染 DOCX+DOCX 稳定主线。
```

---

## 当前结论

当前稳定主线为：

```text
Stage C2：DOCX+DOCX 稳定主线恢复并 Git 固定
```

当前稳定锚点是：

```text
28a904d
stage-c2-docx-docx-stable
```

PDF+PDF 暂停，不进入当前封版能力。
