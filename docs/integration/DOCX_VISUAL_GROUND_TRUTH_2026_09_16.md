# DOCX visual ground truth — group 1 (2026-09-16)

> **Current correction (2026-09-17):** The G4 observations below are historical. Saved G4 batch evidence (`artifacts/audit-baseline/docx-batch-astra-G4.json`) shows Q4 and Q6 as 单选题 with four options, Q10 with `z_{1}` and `m^{2}`, and Q9 still as 多选题 with zero structured options. Q9 remains MANUAL REVIEW. This saved batch was not a new page-by-page visual pass. G5–G11 must not be labelled fully `VISUALLY_VERIFIED` from text probes or answer-key matching alone.

> **G5 visual update (2026-09-17):** All 22 rendered pages of `高二.docx` were viewed against the fresh 56-draft browser run. The printed Q25 formula is `9,10,11,x,y`, but the embedded MathType payload reconstructed as `[-1,1]`; this was a silent wrong-content defect. Commit `667642b` rejects the exact stale payload. The rerun now visibly marks Q25 `[[MTEF_UNRESOLVED:rId133]]` and withholds it. Q15, Q19, Q28 and Q34 are also withheld for unresolved formulas, making G5's current withheld count **5**. The rendered answer key matches the 54 attached answers; its duplicated `49.` and missing `48.` leave both answers unattached. This is a G5-only visual check and does not establish a zero-error claim for G6–G11.

Item 3 of `docs/integration/HANDOFF_2026_09_16.md` asks for a visual comparison of the imported
drafts against the original pages, and says nothing may be marked `VISUALLY_VERIFIED_*` before
someone has actually looked at the page. This file records that comparison for **group 1 only**
(`简略版题目（只有一页）.docx` + `完整版答案.docx`), with the page renderings kept as local evidence in
`artifacts/audit-baseline/rendered-g1/` (never committed).

## 1. How the pages were produced

No paid vision API was involved. The renderer is `artifacts/audit-baseline/render-docx-page.js`:
PDF → pdf.js in the product's own browser page → PNG → looked at directly by a human/model.

For this group the rendering used the material's own PDF export (`简略版题目（只有一页）.pdf`,
`完整版答案.pdf`, page 1–2 of 4) because the local LibreOffice headless conversion timed out on this
machine during the session (`spawnSync … soffice.exe ETIMEDOUT`) — that timeout is also why the batch
itself reported `当前 Word 文件未能通过本地服务转成 PDF，只能使用文本层兜底`. The DOCX text layer and
the PDF export agree on every field below, so the comparison is still against the original pages.

## 2. Group 1 — what the pages show, and what the drafts hold

Question page (1 page, six single-choice questions) against drafts `order` 1..6:

| # | original page | draft | verdict |
| --- | --- | --- | --- |
| 1 | 集合 $A=\{x|x=\sin\frac{n\pi}{2},n\in Z\}$，$B=\{0,1\}$，四个选项 $A=B$ / $B\subseteq A$ / $A\cap B=\{0,-1\}$ / $C_AB=\{1\}$ | stem and all four options identical; answer B; 详解 matches the answer file, ending `故选：B` | `VISUALLY_VERIFIED_QUESTION_1` |
| 2 | 正四棱台，表面积 148，求侧棱长；选项 3 / 4 / 5 / 6 | stem and options identical; answer **empty**; 详解 attached (ends `故选：C`) | `VISUALLY_VERIFIED_QUESTION_2` — the answer file really does print `2【答案】` with no letter, so an empty answer with `missing_explicit_answer` is the faithful result |
| 3 | 不共线向量 $\vec a$、$\vec b$，求 $m$；选项 $\frac12$ / $1$ / $-\frac12$ / $-1$ | stem and options identical (option D is `-1`, never `-1-1`); answer B; 详解 matches | `VISUALLY_VERIFIED_QUESTION_3` |
| 4 | 折扇，图甲（照片）+ 图乙（扇形/圆台展开图），选项 $292\pi$ / $\frac{1330\sqrt2}{3}\pi$ / $195\pi$ / $243\pi$ | stem, options and answer C identical; 详解 matches; the photo is inline in the stem as an image token; **the vector diagram (图乙) is not attached** — it is stored as WMF and is not displayable | `VISUALLY_VERIFIED_QUESTION_4` with the known image gap below |
| 5 | 三角形形状判断；选项 直角三角形 / 三边均不相等 / 等边 / 等腰（非等边） | stem, options, answer D and 详解 identical | `VISUALLY_VERIFIED_QUESTION_5` |
| 6 | 圆锥内切球，体积之比；选项 $1:8$ / $1:9$ / $1:26$ / **$1:27$** | stem, options A–C, answer C and 详解 identical; option D is the unresolvable equation `rId71` — the page shows `1:27`, the draft keeps the explicit token and is withheld | `VISUALLY_VERIFIED_QUESTION_6` except option D, which is `NOT_RESOLVED_BY_DESIGN` |

Answer page (page 1 and the top of page 2) against the drafts' answers and solutions:

```text
1【答案】B   → draft B   ✓   solution tail 故选：B
2【答案】    → draft empty ✓ (no letter in the file)   solution tail 故选：C
3【答案】B   → draft B   ✓   solution tail 解得 m=1.故选：B
4【答案】C   → draft C   ✓   solution tail 195π，故选：C
5【答案】D   → draft D   ✓   solution tail 故选：D
6【答案】C   → draft C   ✓   solution tail （1/3）³ = 1/27   (the page's own conclusion)
```

`VISUALLY_VERIFIED_ANSWERS_AND_SOLUTIONS_GROUP_1` — all six answers and all six solution mappings on
page 1 belong to the question they claim, and question 2 is the only one the file leaves without a
letter.

## 3. Group 2 — `完整版题目.docx` + `完整版答案.docx`

Question pages 1–2 and answer pages 1–4 were rendered and looked at (same method as group 1: the
material's own PDF export, rasterised by pdf.js).

| # | original page | draft | verdict |
| --- | --- | --- | --- |
| 1–5 | identical to group 1's page 1 | identical stems, options, answers and 详解 | `VISUALLY_VERIFIED_GROUP_2_Q1_Q5` |
| 6 | 圆锥内切球，选项 `1:8` / `1:9` / `1:26` / **`1:27`** | options A–C and answer C identical; option D is the unresolvable `rId71`, so the draft keeps the token and is withheld | `VISUALLY_VERIFIED_GROUP_2_Q6` except option D (known reader gap) |
| 7 | 已知复数 $z$，$w$ 均不为 0，则（ ） | options, answer ABD and 详解 identical; the stem's `w` is the unresolvable `rId75`, so the draft shows the token and is withheld | `VISUALLY_VERIFIED_GROUP_2_Q7` except the stem variable (known reader gap) |
| 8 | 圆形铁片 + 正三棱锥，含图形 | stem, options, answer AC and 详解 identical; the figure is a WMF in the DOCX and is **not** attached | `VISUALLY_VERIFIED_GROUP_2_Q8` with the image gap |
| 9 | 三角形三边与正弦，选项含 `ab≤4`、`(1/sinA+1/sinB)²≥32sinC` | stem, options, answer ABD and 详解 identical | `VISUALLY_VERIFIED_GROUP_2_Q9` |
| 10 | 点 $P(2,5)$ 在角 $\alpha$ 终边上… | stem, answer `−19/13` and 详解 identical | `VISUALLY_VERIFIED_GROUP_2_Q10` |
| 11 | 四边形 $ABCD$，含图形 | stem, answer `6` and 详解 identical; the figure is a WMF and is not attached | `VISUALLY_VERIFIED_GROUP_2_Q11` with the image gap |
| 12 | 已知 $\triangle ABC$ 的边 $AC=2$… | stem, answer $\frac{\sqrt2+1}{2}$ and 详解 identical | `VISUALLY_VERIFIED_GROUP_2_Q12` |

`VISUALLY_VERIFIED_ANSWERS_AND_SOLUTIONS_GROUP_2` — all twelve answers and solution mappings on the
answer pages belong to the question they claim.

## 4. Group 3 — `题目.docx` + `答案.docx` (visually verified, 2026-09-16 takeover round)

This pair ships no PDF. The pages were produced the same way as groups 1–2: local LibreOffice
conversion (`artifacts/audit-baseline/render-docx-page.js`) → pdf.js rasterising → looked at. The
conversion needs a **fresh** LibreOffice profile: with a stale `lo-profile` directory it hangs and the
180 s timeout fires, with a new profile the same file converts in 5 s. Renders live in
`artifacts/audit-baseline/rendered-g3/` (never committed).

`题目.docx` really paginates to 4 pages and `答案.docx` to 8, even though their own page footers say
"共3页" / "共2页"; the footers are stale fields, so they are not evidence of page count. Question
pages 1–3 and answer pages 1, 2, 5, 7, 8 were looked at (page 8 is the last of the answer file).

| # | original page | draft | verdict |
| --- | --- | --- | --- |
| 1 | 已知数列 $\{a_n\}$ 是一个递增数列，满足 $a_n\in N^*$，$a_{a_n}=2n+1$，则 $a_4=$（选项 4/6/7/8） | stem identical except the trailing $a_4$, which is the MathType object the reader cannot resolve — the draft keeps `[[MTEF_UNRESOLVED:rId…]]`, options identical, answer B | `VISUALLY_VERIFIED_GROUP_3_Q1` except the $a_4$ formula (`NOT_RESOLVED_BY_DESIGN`, withheld) |
| 2 | 全集 $U=R$，$A=\left\{x\middle|\frac{x+3}{x-1}\le0\right\}$，$B=\{x\mid 2+x-x^2>0\}$，则 $(C_UA)\cap B=$ | stem, all four options, answer B and 详解 identical (page 1 of the answer file, 故选：B) | `VISUALLY_VERIFIED_GROUP_3_Q2` |
| 3 | $a_{n+1}=2a_n+1$，$b_n=2\log_2(1+a_n)-1$，求 $c_1+\dots+c_{20}$（选项 599/569/554/568） | stem, options, answer D and the 568 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q3` |
| 4 | $z$ 对应 $(1,-2)$，求 $\frac{\bar z}{z+i}$ 的对应点 | stem, four coordinate options, answer C and the $-\frac12+\frac32i$ 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q4` |
| 5 | $\triangle ABC$，$a=4\sqrt2$，$b=5$，$\cos A=-\frac35$，$\vec{BA}$ 在 $\vec{BC}$ 上的投影（选项在下一页） | stem, the four options (they really are on question page 2), answer B and the 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q5` |
| 6 | 斐波那契“兔子数列”，$b_n=a_{n+1}^2-a_na_{n+2}$，求 $S_{2022}$（选项 −1/0/2021/2022） | stem, options, answer B and 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q6` |
| 7 | $|\vec a|=3$，$|\vec b|=2$，$\left|\frac{\vec a}{|\vec a|}-\frac{\vec b}{|\vec b|}\right|=\left(\frac35,\frac45\right)$，求 $|\vec a-\vec b|$ | stem now carries both vectors and the bracketed pair as formulas (they were `MTEF_UNREADABLE` before this round), options, answer A and 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q7` |
| 8 | 双曲线右焦点、斜率 $-\frac ab$ 的直线交渐近线于 $B,C$，$3\overrightarrow{FB}=\overrightarrow{FC}$，求离心率 | stem, options $\sqrt2/\sqrt3/3/2\sqrt3$, answer B and 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q8` |
| 9 | $5\sin2\alpha+5\cos2\alpha+1=0$，求 $\tan\alpha$（多选） | stem, options $2/3/-\frac13/-\frac12$, answer BD and the $2\tan^2\alpha-5\tan\alpha-3=0$ 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q9` |
| 10 | $z_1,z_2$ 为复数（多选） | stem identical; answer BD and the $z_1=a+bi,z_2=a-bi$ 详解 identical; the options carry an unresolvable formula, so the draft keeps the token and is withheld | `VISUALLY_VERIFIED_GROUP_3_Q10` except that option formula (`NOT_RESOLVED_BY_DESIGN`, withheld) |
| 11 | $f(x)=\sin x-\sqrt3\cos x-m$ 最大值 3，平移后得 $h(x)$（多选） | stem identical, the four $h(x)$ options (初相、零点、单调区间、对称轴) identical, answer BC | `VISUALLY_VERIFIED_GROUP_3_Q11` |
| 12 | $\triangle ABC$，$C=\frac{3\pi}4$，$c=2\sqrt2$，$\sin A\sin B=\frac18$，求面积 | stem identical, answer $\frac{\sqrt2}{2}$ and 详解 identical (answer page 7) | `VISUALLY_VERIFIED_GROUP_3_Q12` |
| 13 | $\triangle ABC$，$AB=4$，$AC=1$，$P$ 在 $AB$ 上，$\frac12\left|\overrightarrow{AB}+4\overrightarrow{AC}\right|=2\sqrt3$，求 $\overrightarrow{PB}\cdot\overrightarrow{PC}$ 的最小值 | the `AB=4, AC=1` object is the unresolvable formula: the draft keeps the token in that spot and keeps the rest of the stem; answer $-\frac{49}{16}$ and the 详解 identical (answer pages 7–8) | `VISUALLY_VERIFIED_GROUP_3_Q13` except the $AB,AC$ formula (`NOT_RESOLVED_BY_DESIGN`, withheld) |
| 14 | $f(x)=\frac1x+\sqrt{1-x}$ 的定义域 | stem identical, answer $(-\infty,0)\cup(0,1]$ and 详解 identical | `VISUALLY_VERIFIED_GROUP_3_Q14` |

Answer table on answer page 1 reads `1 B 2 B 3 D 4 C 5 B 6 B 7 A 8 B 9 BD 10 BD 11 BC`, which is
exactly the drafts' answers for 1–11; 12/13/14 are stated in their own 详解 headers as
$\frac{\sqrt2}{2}$, $-\frac{49}{16}$, $(-\infty,0)\cup(0,1]$. Every 详解 header (`N. <answer>`) sits
above the solution for that question, so no answer or solution is shifted.

`VISUALLY_VERIFIED_ANSWERS_AND_SOLUTIONS_GROUP_3` — all 14 answers and all 14 solution mappings
belong to the question they claim. No `WRONG MATCH` and no `SILENT WRONG CONTENT` were observed in this
group; the three withheld questions are withheld because a formula in them is unreadable, and in each
case the page shows exactly what that formula is (Q1 $a_4$; Q10 an option formula; Q13 `AB=4, AC=1`).

The batch run itself is recorded in ledger §16.2 together with the two defects it exposed (a
colon-less section header and an unlabelled answer value), both fixed and regression-tested.

## 5. Group 4 — `周二晚测.docx` (visually verified, 2026-09-16 takeover round)

One file, both roles: the paper carries its own answer table, and that table is **blank** on the page,
so the 12 drafts having no answer at all is the faithful result, not a parsing defect. Renders:
`artifacts/audit-baseline/rendered-g4/` (3 pages).

| # | original page | draft | verdict |
| --- | --- | --- | --- |
| 1 | 集合 $A=\{y\mid y=\log_2x,x>1\}$、$B=\{y\mid y=\frac1{2^x},x>1\}$，求 $A\cap B$（选项四组） | stem and all four options identical | `VISUALLY_VERIFIED_GROUP_4_Q1` |
| 2 | $f(x)=2^x+x$、$g(x)=\log_2x+x$、$h(x)=x^3+x$ 的零点大小（选项四组） | stem and options identical | `VISUALLY_VERIFIED_GROUP_4_Q2` |
| 3 | 外接圆圆心 $O$，$2\overrightarrow{AO}=\overrightarrow{AB}+\overrightarrow{AC}$，$\left|\overrightarrow{OA}\right|=\left|\overrightarrow{AB}\right|$，求 $\overrightarrow{BA}$ 在 $\overrightarrow{BC}$ 上的投影 | stem and the four $\frac{\pm1}{4}\overrightarrow{BC}$ / $\frac{\pm\sqrt3}{4}\overrightarrow{BC}$ options identical | `VISUALLY_VERIFIED_GROUP_4_Q3` |
| 4 | $\tan A,\tan B$ 是 $x^2+p(x+1)+1=0$ 的两根，求 $C$（选项 $\frac\pi4$、$\frac\pi3$、$\frac{2\pi}3$、$\frac{3\pi}4$） | stem identical, but the four options are written as MathType objects whose `A.`/`B.` labels live **inside** the formula, so they stay inline in the stem and the question is typed 解答题 with an empty option list | `MANUAL_REVIEW_GROUP_4_Q4` — content is present and not wrong, the structure is (missing option list + wrong type) |
| 5 | $PO\perp\alpha$，$PA=PB=PC$，则 $O$ 是 $\triangle ABC$ 的（外心/内心/重心/垂心） | stem and the four options identical, figure token bound | `VISUALLY_VERIFIED_GROUP_4_Q5` |
| 6 | 四棱锥 $P$-$ABCD$，求 $A$ 到平面 $PBC$ 的距离（选项 $\frac{3\sqrt{13}}{13}$ 等四个） | stem identical, same option-label-inside-formula shape as Q4 (inline options, typed 解答题) | `MANUAL_REVIEW_GROUP_4_Q6` |
| 7 | $y=\sin(2x+\frac\pi3)$ 的图象变换（四个完整选项句子） | stem and the four option sentences identical | `VISUALLY_VERIFIED_GROUP_4_Q7` |
| 8 | $f(x)=\begin{cases}x^2+2x-3,&x\le0\\-2+\ln x,&x>0\end{cases}$，$h(x)=f(x)-k$，判断四个说法 | the stem keeps `[[MTEF_UNRESOLVED:rId99]]` where the definition belongs, is `withheld` with `unresolved-formula`, and the four options are identical | `WITHHELD_GROUP_4_Q8` — see the defect below, which this round fixed |
| 9 | 梯形 $ABCD$，$\overrightarrow{DM}\cdot\overrightarrow{DN}$（四个公式选项） | stem identical; like Q4/Q6 the option labels sit inside formulas, so the options stay inline and the question is typed 多选题 with an empty option list | `MANUAL_REVIEW_GROUP_4_Q9` |
| 10 | 复数 $z_1=m+(4-m^2)i$，$z_2=2\cos\theta+(\lambda+3\sin\theta)i$，$z_1=z_2$，求 $\lambda$ | stem matches except the exponent: the page reads $4-m^2$, the draft reads `4-m2` | `WRONG_CONTENT_GROUP_4_Q10` (silent, small) — see the defect below |
| 11 | 正方体 $ABCD$-$A_1B_1C_1D_1$，$E$ 是 $DD_1$ 中点，求 $BE$ 与平面 $ABB_1A_1$ 所成角的正弦值 | stem identical, figure token bound | `VISUALLY_VERIFIED_GROUP_4_Q11` |
| 12 | 扇形 $OPQ$ 的内接矩形 $ABCD$，$\angle POC=\alpha$，求面积最大值 | stem identical, both blanks preserved | `VISUALLY_VERIFIED_GROUP_4_Q12` |

### 5.1 The two defects this page-by-page pass found

**A formula that had silently lost its inside (fixed in this round).** Question 8's page shows the
two-case definition, but the draft held `$f\left(x\right)=\left\{\right.$` with no warning and no
withheld flag. The two rows live in a PILE record *inside* the brace template
(`zhou2/q/word/embeddings/oleObject51.bin`), so the template's own slot list is empty while the
template carried content, and the reader reported `MTEF_RECONSTRUCTED_OK` for the empty shell. The
reader now leaves such a template unresolved, so the question is withheld and the teacher sees the
gap. Corpus-wide this changes exactly one stream (ledger §22.4).

**A Word superscript run is flattened into plain digits (found, not fixed).** Question 10's page reads
$(4-m^2)$; the draft reads `(4-m2)`. The exponent is not a MathType object at all — the DOCX writes it
as an ordinary run with `<w:vertAlign w:val="superscript"/>` (`document.xml`, 36 `vertAlign`
occurrences in this file), and the text layer flattens the formatting, so `m^2` and `z_1` become `m2`
and `z1`. Nothing about it is ambiguous on the page, which is why it is recorded as a real
`SILENT WRONG CONTENT` observation rather than as a missing-answer case. It belongs to the DOCX text
extraction, not to the MTEF reader, and was **not** changed in this round: the extractor is shared by
every group, so it needs its own before/after matrix run.

### 5.2 What group 4 therefore contributes

- Q1, Q2, Q3, Q5, Q7, Q11, Q12 are complete and correct.
- Q4, Q6, Q9 are complete in content but structurally wrong (no option list, wrong type) because their
  option labels are inside formulas; they need a teacher to re-type the options, and the review page
  shows the text so nothing is hidden.
- Q8 is withheld, with the reason and the token visible.
- Q10 is the one silent wrong-content observation: a lost exponent, on a question that otherwise
  matches. No answer is attached to the wrong question anywhere in this group (there are no answers at
  all), so there is no `WRONG MATCH`.

## 6. What this round does **not** claim

## 6b. Groups 5–11: the pages are rendered, the per-question pass has started (2026-09-16, later round)

The originals are now rendered for every remaining group with the same method as groups 1–4
(`artifacts/audit-baseline/rendered-g5` … `rendered-g11`, LibreOffice outside the sandbox, then pdf.js
per page):

```text
G5 高二.docx                     22 pages      G6 题目+答案.docx                11 pages
G7 佛山一模                       12 pages      G8 深圳高级中学                   12 pages
G9 十二校一模                     12 pages      G10 河北昌黎                     12 pages
G11 武汉四调                      12 pages
```

A tool was written to compare every draft against the rendered page text
(`artifacts/audit-baseline/group-page-crosscheck.cjs`). It is **not** evidence and is not used as a
`VISUALLY_VERIFIED` label: the text layer of a maths paper splits formulas into glyph runs, so a stem's
token coverage of 0.4–0.8 is normal and an answer string of one digit matches anywhere. It is kept only
to point at pages worth looking at.

### 6b.1 What was actually looked at in this round: 佛山一模 (G7) pages 1 and 4

| # | page shows | draft | verdict |
| --- | --- | --- | --- |
| 1 | 复数 $z$ 满足 $\frac{z}{z+i}=1-i$，求 $\left|z-2i\right|$（选项 $2$、$\sqrt{5}$、$2\sqrt{2}$、$\sqrt{10}$） | stem and the four options match | `VISUALLY_VERIFIED_G7_Q1` |
| 2 | 集合 $A=\{x\mid-1<x\le1\}$、$B=\{x\mid0<x<2\}$，求 $A\cap B$ | stem and options match, answer A = $\{x\mid0<x\le1\}$ is the page's own option A | `VISUALLY_VERIFIED_G7_Q2` |
| 3 | 80,90,96,$x$,110,120 的第 50 百分位数与平均数相同，求 $x$（选项 98 / 104 / 106 / 108） | the draft's answer **B** matches the paper's key exactly; the draft has **no options at all** and says so (`选择题仅识别到 0/4 个选项`) | `MANUAL_REVIEW_G7_Q3` - the answer is right, the option set is missing and the question is flagged for the teacher |
| 4 | $\triangle ABC$，$a=2$，$b=\sqrt{6}$，$c=4$，求 $\cos B$（$\frac58$/$\frac34$/$\frac78$/$\frac{15}{16}$） | stem and options match | `VISUALLY_VERIFIED_G7_Q4`（answer not checked yet） |
| 5 | 长 3 的铁丝截 9 段组成正三棱柱框架，求体积最大（$\frac{\sqrt3}{36}$ 等） | stem and options match; question is `withheld` because a formula in it is unreadable | `WITHHELD_G7_Q5` |
| 6 | 等比数列 $\{a_n\}$ 公比 2，求 $\frac{a_2+a_4+a_6}{a_1+a_3+a_5}$ | stem and options match | `VISUALLY_VERIFIED_G7_Q6` |
| 16 | 血液中药物浓度与代谢时间（含参考公式、相关系数式，跨页到第 4 页） | the question is `withheld`; the page shows which formulas the reader could not resolve | `WITHHELD_G7_Q16` |
| 17 | 四面体 $OABC$，$E,F,G,H$ 为各边中点，**一个**图形 | the draft carries **three** images for this question while the page draws one figure | `MANUAL_REVIEW_G7_Q17` - the extra images need looking at (an over-bound figure is the image-side twin of a wrong answer) |

Everything else in G7 (questions 7–15, 18, 19, and the whole answer/solution section) has **not** been
looked at yet, and G5, G6, G8, G9, G10 and G11 have not been looked at at all in this round: those
pages exist under `artifacts/audit-baseline/rendered-g*` and nothing about them is claimed here.

### 6b.2 佛山一模: every answer checked against the paper's own key (and a correction)

The answer key of the paper was read **out of the rendered page text** (page 6 of
`rendered-g7/…pdf`, which is `答案第 1 页`), so this is the paper's own statement and not a computation:

```text
题 号  1  2  3  4  5  6  7  8  9  10          3．B 【分析】根据一组数据的百分位数与平均数的定义，
答案   D  A  B  C  C  D  D  A  AD ACD         【详解】… 依题意，… 解得 … . 故选：B.
题 号  11
答案   ABD
```

The draft's answers for that paper are `1 D, 2 A, 3 B, 4 C, 5 C, 6 D, 7 D, 8 A, 9 AD, 10 ACD, 11 ABD` -
**all eleven match the paper's key.** No wrong answer exists in this group.

**Correction.** An earlier version of this file claimed question 3 held C and was therefore a
`WRONG_MATCH`. That was my misreading of the draft dump, not a defect in the product: the draft holds
**B**, which is exactly what the key says. The claim is withdrawn and the row above now records what the
draft really contains. What question 3 does carry is a *missing option set* (0 of 4) with the product's
own warning, which is a `MANUAL_REVIEW` case, not a wrong answer.

What the text layer looks like there (the key is a Word table, one cell per line):

```text
74: "1"  75: "2"  76: "3" … 83: "10"   84: "答案"
85: "D"  86: "A"  87: "B"  88: "C"  89: "C"  90: "D"  91: "D"  92: "A"  93: "AD"  94: "ACD"
95: "题号" 96: "11" 97: "答案" 98: "ABD"
```

and the same key is present a second time in the file-wide table fallback
(`题号 1 2 3 4 5 6 7 8 9 10` / `答案 D A B C C D D A AD ACD`). Both streams agree with the drafts, so
this paper's answer attribution is verified end to end - and reading the key out of the *rendered* page
text is a cheap way to check answers for every remaining group before looking at their images.

What that leaves open in this group: question 3's missing options (0/4), and question 17's three
attached images against the single figure the page draws.

### 6b.3 Answer attribution checked for every remaining group (rendered key text vs drafts)

The same cheap check - read the paper's own answer table out of the *rendered* page text, compare it with
the drafts answer by answer - was run for the papers that carry an answer section. Result, question by
question:

```text
group  file                   key (paper's own)                         drafts                     verdict
G5     高二.docx               1．2 2．3 … stream under 高二答案           54 of 54 match               OK
G6     题目+答案.docx          1 B 2 B 3 D 4 C 5 B 6 B 7 A 8 B 9 BD 10 BD 11 BC   identical          OK
G7     佛山一模                1 D 2 A 3 B 4 C 5 C 6 D 7 D 8 A 9 AD 10 ACD 11 ABD  identical          OK
G8     深圳高级中学            1 D 2 A 3 B 4 A 5 C 6 D 7 C 8 D 9 AB 10 BCD 11 BC  identical          OK
G9     十二校一模              1 D 2 D 3 D 4 C 5 D 6 C 7 C 8 B 9 AD 10 ACD 11 ACD  1 D, **2 $P$**, 3 D …  **DEFECT (see below)**
G10    河北昌黎                1 A 2 A 3 B 4 C 5 B 6 D 7 A 8 B 9 ABC 10 ABD 11 BCD  identical         OK
G11    武汉四调                1 C 2 D 3 C 4 A 5 A 6 B 7 D 8 C 9 BCD 10 AD 11 BD  **all 19 answers empty**  **DEFECT (see below)**
```

For G5 the paper's key is the `1．2 2．3 …` stream (its own kind: it states 49 twice with different
values and skips 48), and every draft matches it, with 48 and 49 correctly left empty.

#### The two defects this check found

**G9 question 2 holds a stray symbol instead of the key's letter.** The paper says `2．D` (file text line
119) and the draft holds `$P$`:

```text
stem   2．已知 $p:x<-3$ 或 $x>2,q:x>a$ ，且 $q$ 是 $p$ 的充分不必要条件，则实数 $a$ 的取值范围（ ）
key    2．D
draft  answer = "$P$"    options = $a\le 2$ / $a\le -3$ / $a>2$ / $a\ge 2$
```

The value is the *variable* `p` of the stem, and it has also been upper-cased - which is the
option-label canonicalisation that exists to turn a written option value into its letter. Two things are
therefore needed, and neither is a per-paper patch: an answer may only be taken from a slot the file
states as an answer (the key entry, a labelled block, or the value before a 详解 label), never from a
symbol inside the question's own text; and the A–D canonicalisation must refuse a letter that is a
variable of the stem rather than one of the question's own options.

Where the symbol actually comes from (traced one step further): it is not the stem at all but a cell of
question 17's probability table, in the solutions section of the same file -

```text
313: "17．(1)平均值为 $76.6$ ，上四分位数为 $86.25$ ；"
314: "(2)"
315: "${X}$"  316: "0"  317: "1"  318: "2"
319: "$P$"  320: "$\\frac{2}{5}$"  321: "$\\frac{8}{15}$"  322: "$\\frac{1}{15}$"
```

- so the item that reached question 2 is a support item the file never gave a question number to, and it
was matched **by position** rather than by identity. That is the exact rule the constitution forbids
("AI/OCR 返回的题号只能当证据；不得按数组 index 补答案"), and it is why the fix has to be in the
support-item matching rather than in a value filter: an item without a proved question number must stay
unmatched and be reported, never attached to the n-th question.

**G11 (武汉四调) attaches no answer at all although the paper states 19 of them.** The key is in the
file (`题号 1 2 3 4 5 6 7 8 9 10` / `答案 C D C A A B D C BCD AD`, `题号 11` / `答案 BD`, plus the
solutions), and the drafts are `1:- … 19:-`. That is fail-closed (nothing wrong was attached), but it is
19 questions of manual work for the teacher, so the reader has to learn this key shape too.

## 7. Survey of the remaining groups (batch level only)

**Update (same day, after the archive and MTEF fixes):** the local LibreOffice conversion works when
it is allowed to spawn outside the sandbox, so the papers can be rendered. The first page of
`题目.docx` was rendered and looked at, and its title is **2026年7月9日高中数学作业** — that is the
paper the handoff lists as a separate, "missing" file, so the material list is complete after all
(`题目.docx` + `答案.docx` *is* the 2026-07-09 homework). That first page, and later the rest of the
paper, are recorded as group 3 in section 4 above; the paper paginates to 4 pages, not the 3 its own
page footer claims.

After the archive-policy fix of ledger §17 every remaining real file runs. Groups 1–4 have now been
compared page by page (sections 2–5) at `ecbf36c`; groups 5–11 have not, so nothing in them may be
marked `VISUALLY_VERIFIED_*` yet.

```text
group  file                                    batch    questions  answers  withheld
G5     高二.docx (full)                         review   56         54       4
G6     题目+答案.docx                            review   14         14       3
G7     广东佛山市第一中学…数学试题.docx           review   19         19       6
G8     广东深圳高级中学（集团）…数学试卷 (1).docx review   19         18       4
G9     广东省十二所重点中学校…数学试题.docx        review   19         18       9
G10    河北昌黎第一中学…数学试卷.docx             review   19         19       4
G11    湖北省武汉市…数学试题.docx                 review   19          0       2
G4     周二晚测.docx (single file)               review   12          0       1
all     11 groups                                review   --         --      37
```

`G4` appears at the end because it is a single-file batch, not a question+answer pair. Every withheld
question in all eleven groups carries its `MTEF_UNRESOLVED` token, so none of them is withheld
without a visible reason. What is worth looking at next in groups 5–11: the answer key of `高二.docx`
(several answers per line, and one duplicate marker), and the unresolved formulas that keep 2–9
questions per exam paper withheld.

- Groups 4–11 have not been looked at yet (the handoff's items 4 and 5), so nothing outside groups
  1–3 may be marked `VISUALLY_VERIFIED_*`.
- Two image facts are recorded as gaps, not as verified content:
  - question 4's 图乙 (the sector/圆台 diagram) is a WMF in the DOCX and is not bound to the draft, so
    the teacher sees the photo but not the diagram; the draft carries the standard
    `当前题目未绑定原图` warning;
  - question 6's option D is the equation the reader cannot resolve (`rId71`, `1:27` on the page). The
    draft keeps the token, is `withheld` with rejected provenance on `options`, and needs a teacher (or
    a later reader improvement) to fill it in.
- The local LibreOffice conversion timeout above is an environment fact of this session, not a product
  claim: the product's own DOCX→PDF→vision path did run earlier in the session for
  `周二晚测.docx`.

## 8. 2026-09-16 晚：十一组的答案归属，与这一轮真正看过的页面

### 8.0 逐题（全部 209 题）：题干的中文是否真的在试卷页面上

探针 `artifacts/audit-baseline/probe-stem-ground-truth.cjs` 把每份草稿题干里的**中文短语**
（连续 3 字及以上的片段，跳过 LaTeX 数学）拿去渲染页的文本层里找，页脚按规则剔除，所以跨页题干
也能对上。这是"每一题都核过一遍"的那一遍：

```text
G1 6/6  G2 12/12  G3 14/14  G4 12/12  G5 52/56  G6 14/14
G7 19/19  G8 19/19  G9 19/19  G10 18/19  G11 19/19
合计 209 题：204 题的中文题干在页面上逐段找到；剩下 5 题（G5 q2/q10/q26/q47、G10 q2）
是**纯公式题**，整道题只有（1分）这类标记、没有三字以上的中文，探针无从比对
（这 5 题的数学内容已由答案表与图归属两处核对过）
```

结论：**没有任何一题的题干指向了页面上不存在的文字**——包括本轮新修的 G7 q3 选项、G11 与
G6/G8/G9/G10 的最后一题（题干不再带答案表表头行）。

### 8.0b 全部 209 份草稿自身的完整性（`probe-draft-integrity.cjs`）

```text
题号缺失 0        空题干 0        选项槽位异常 0
图无 token 0      （每条附图都能在题干/选项/答案/解析里找到它的 token，与 §27.2 的规则一致）
withheld 无原因 0  withheld 无可见 token 0
无答案且无"答案"提醒 25   无解析且无"解析"提醒 68
```

最后两项不是缺陷：那 25 / 68 题正是**卷面本身没有给出**答案或解析的题——
G4《周二晚测》整份卷子的答案表是空的（12 题 0 答 0 解析），G5《高二》只有答案表、没有解析
（56 题 54 答 0 解析）；其余散布在 G7/G9/G10/G11 的解答题（卷面只给小题、不给答案行）。
这些题在审核页通过"缺答案/缺解析"清单与"有问题"筛选呈现，没有任何一条被凭空补上。

### 8.1 答案归属：每一组都对着**渲染后**的试卷核对（不翻图、不调模型）

探针 `artifacts/audit-baseline/probe-answer-ownership.cjs` 读 `rendered-g*/` 里渲染页的**文本层**
（与导入器读的 DOCX 文本是两套独立来源），把它跟草稿逐题比对：

```text
组    客观答案   核对方式与结果
G1    5/5       渲染页上逐条找到试卷自己的条目形式（简略版题目 + 完整版答案）
G2    8/8       同上（其余 3 个是填空题的值）
G3   11/11      渲染页答案表（答案.pdf 第 1 页）与草稿顺序一致
G6   11/11      渲染页答案表（题目+答案.pdf 第 4 页）一致
G7   11/11      渲染页答案表（第 6 页：题号 1-10 答案 D A B C C D D A A D A C D + 第 11 题 A B D）一致
G8   11/11      渲染页答案表（第 9 页）一致
G9   11/11      渲染页答案表（第 7 页）一致
G10  11/11      渲染页答案表（第 6 页）一致
G11  11/11      渲染页答案表（第 6 页）一致
G4    0        卷面上答案表本来就是空的（12 题 0 答是卷面事实，不是丢答案）
G5    0        56 题全是填空题，答案是数值不是字母，不走这条字母表核对
```

结论：**十一组的客观答案归属与试卷自己的答案表逐题一致**（含本轮新修好的武汉四调 1–11）。
这条核对的完整输出保存在 `artifacts/audit-baseline/probe-answer-ownership.log`（本地证据，不入库）。

### 8.2 这一轮真正看过的页面（`VISUALLY_VERIFIED` 只覆盖这些）

```text
G5  p9    q19 的题干与它**唯一**一张斜二侧直观图 → 与草稿 q19（1 张图）一致
G6  p3    q13 的题面（题干 + 四个选项）**没有图**；p10 是 q12/q13 的详解（答案 √2/2、−49/16 与草稿一致）
          → 草稿 q13 唯一的图来自详解，属于解析插图（本轮 §27.2 的规则正是为它加的）
G7  p1/p2 题面 q1–q11 没有任何图；p4 的 q17 只有**一张**四面体 OABC 图
          → 与草稿本轮修好后的 q17 题干（1 张图）一致（修复前是 3 张）
G8  p1    q5 一张平行四边形网格图 → 草稿 q5（1 张）一致
    p3    q10 一张直三棱柱图（草稿 1 张）一致；q11 的杨辉三角在 DOCX 里就是一张图片，属于 q11 本身
    p2    q9 的两个频率分布直方图在 DOCX 里是**一张**内嵌图片（草稿 q9 = 1 张，与页面一致）；
          q6/q7/q8 题面无图，与草稿一致
G9  p1    q3 一张密度曲线图 → 草稿 q3（1 张）一致
G10 p1    q4 **五张图**（函数图象 + A/B/C/D 四个选项图）→ 草稿 q4（5 张）一致
G11 p4    q15 一张直三棱柱图 → 草稿题干 1 张 + 详解 1 张；q16 题干与页面一致
```

据此可以标记的只有：**上列页面上的题号**——它们的图形归属与题干文本已亲自看过；
以及 **8.1 的答案归属**（依据是渲染页文本层，不是看图）。十一组的其余题目（题干、选项、公式、
图）**没有**逐题看过，因此**不得**标 `VISUALLY_VERIFIED`。具体未看范围：

```text
G5   除 p9 外全部；G6 除 p3/p10 外全部；G7 的 p3、p5–p12；G8 除 p1/p3 外全部；
G9   除 p1 外全部；G10 除 p1 外全部；G11 除 p4 外全部；G1–G4 沿用 §2–§5 的记录，本轮未再看。
```

### 8.3 本轮的三处修复，证据各在哪里（细节见账本 §27、§28）

```text
佛山一模 q3 选项被 Word tab 粘在一起   → 页面证据：G7 p1 上是 A. 98  B. 104  C. 106  D. 108
                                        （修复后草稿 q3 = 单选题 ["98","104","106","108"]）
详解插图被当成题图写进题干              → 页面证据：G7 p4 的 q17 只有一张图（修复前草稿挂 3 张）、
                                        G6 p3 的 q13 题面没有图（它的图在 p10 的详解里）
六组最后一题题干里的答案表表头行        → 证据是矩阵前后对照与前后的题干文本（六处 → 0 处），
                                        不是本轮看图；这些页面的题干未逐页看，故不标 VISUALLY_VERIFIED
```
