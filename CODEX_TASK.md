当前唯一任务：修复 LaTeX 展示归一化自测 multiple-options 失败，只修选项标签保护，不改其他功能。

当前自测失败：
window.__qisiLatexDisplayNormalizeSelfTest?.()
返回 ok:false，仅 multiple-options 失败。

失败详情：
input:
A. 1
B. \frac{1330鈭?}{3}蟺
C. $\frac{1}{2}$

actual:
A. 1
B. $\frac{1330\sqrt{2}}{3}\pi$
C$. \frac{1}{2}$

expected:
A. 1
B. $\frac{1330\sqrt{2}}{3}\pi$
C. $\frac{1}{2}$

问题判断：
- B 选项碎片 LaTeX 归一化已经成功；
- 失败点是 C 选项原本合法的 “C. $...$” 被错误改成 “C$. ...$”；
- 说明 normalizeBareLatexForDisplayOptions / normalizeBareLatexForDisplayText 处理多行选项时，没有保护选项标签 “A.”、“B.”、“C.”、“D.”。

允许修改：
- app.js
- main.html 仅允许更新 app.js 缓存号

禁止修改：
- app.css
- qisi-support-parser.js
- qisi-support-repair.js
- qisi-batch-importer.js
- qisi-batch-engine-v2.js
- qisi-local-server.js
- PDF 渲染
- prompt
- 模型
- coverage
- C-2 merge
- DB 结构
- options 显示模板
- LatexPreview 组件结构
- 提交 / 确认 / 入库逻辑
- 低置信度质量闸相关逻辑

修复要求：
1. 在多行 options 归一化时，先识别并保护行首选项标签：
   A. / B. / C. / D. / E. / F.
2. 对选项标签后面的内容做 LaTeX 归一化；
3. 重新拼回时必须保持：
   C. $\frac{1}{2}$
   不能变成：
   C$. \frac{1}{2}$
4. 不破坏已经合法的 $...$、\(...\)、\[...\]；
5. 不削弱 existing selftest；
6. 不把 selftest 期望改错来通过；
7. window.__qisiLatexDisplayNormalizeSelfTest?.() 必须返回 ok:true；
8. node --check app.js；
9. npm.cmd test。

建议实现方向：
- 对每一行先匹配：
  /^([A-F])\.\s*(.*)$/
- 如果匹配到选项标签，只把第二组内容交给 normalizeBareLatexForDisplayText / expression normalizer；
- 最后返回：
  `${label}. ${normalizedContent}`
- 如果没有匹配到选项标签，再走原来的文本归一化逻辑。