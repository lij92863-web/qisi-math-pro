# 阶段 1A：批量录题 DOCX/PDF 主链封版候选

## 已通过回归

- 题目 DOCX + 答案 DOCX
- 题目 DOCX + 答案 PDF
- 题目 DOCX only
- 题目 PDF + 答案 PDF
- 缺页 / 缺题 fail closed

## 本阶段修复内容

- support parser 题号 1—12 稳定
- `answerRaw / solutionRaw` 字段清洗
- 清理 `description / itemize / enumerate / \item` 残留
- 移除答案解析中的 `tikzpicture` 源码残留
- 题目 strict JSON 中 LaTeX 单反斜杠容错
- PDF 页面渲染失败诊断
- DOCX 题目侧 failure snapshot
- 日志降噪，保留关键 diagnostics

## 保留的不变量

- 不降低 coverage
- 不允许缺题假成功
- 不允许 missingBlocks / missingAnswers / missingSolutions 被忽略
- 不允许 parser 静默丢 block
- 不允许 repair 覆盖已有答案解析
- 不允许手工补题号

## 暂缓功能

- 答案/解析图片绑定
- C-2 显式题号安全合并
- 题图绑定优化
- 更稳定多源合并
- 审核页体验优化

## 后续建议

- 短期不要继续大改
- 下一阶段优先做 C-2 的“显式题号安全合并”
- 每个新功能必须先定边界、先审代码、先加诊断、再最小修改
- 每次修改后必须保留回滚点
