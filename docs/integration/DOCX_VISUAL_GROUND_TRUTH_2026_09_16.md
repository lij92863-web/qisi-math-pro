# DOCX visual ground truth — group 1 (2026-09-16)

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

## 4. Group 3 — `题目.docx` + `答案.docx` (batch verified only)

This pair ships no PDF and the local LibreOffice conversion timed out during the session, so no page
has been looked at: **nothing of group 3 is marked `VISUALLY_VERIFIED_*` yet.** The batch run is
recorded in ledger §16.2 together with the two defects it exposed (a colon-less section header and an
unlabelled answer value), both of which are now fixed and regression-tested.

## 5. What this round does **not** claim

## 6. Survey of the remaining groups (batch level only)

After the archive-policy fix of ledger §17 every remaining real file runs; none of them has been
compared page by page yet, so nothing here is marked `VISUALLY_VERIFIED_*` except groups 1 and 2.

```text
高二.docx (full)                        review   51 questions   0 answers   5 withheld
河北昌黎第一中学…数学试卷.docx           review   19            19          4
广东佛山市第一中学…数学试题.docx         review   19            19          7
广东深圳高级中学…数学试卷 (1).docx       review   19            18          4
广东省十二所重点中学校…数学试题.docx     review   19            18          10
湖北省武汉市…数学试题.docx               review   19            18          5
题目+答案.docx                          review   14            14          4
2026年7月9日高中数学作业.docx           not present in the materials folder
```

Two things to look at next for these groups: the answer key of `高二.docx` (several answers per line)
and the unresolved formulas that keep 4-10 questions per exam paper withheld.

- No other group has been looked at yet (the handoff's items 4 and 5), so nothing outside group 1 may
  be marked `VISUALLY_VERIFIED_*`.
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
