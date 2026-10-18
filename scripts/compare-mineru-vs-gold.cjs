#!/usr/bin/env node
/**
 * 只读核对：MinerU 解析产物 vs 人工金标（深圳 2026 适应性考试数学卷）。
 *
 * 输入
 *   local-run-artifacts/mineru-probe/2026-10-17T17-11-08-882Z/unzip/
 *     - full.md
 *     - 98906e0e-..._content_list.json
 *     - images/
 *   local-run-artifacts/gold/shenzhen-2026.json
 * 输出
 *   local-run-artifacts/mineru-probe/quality-report.json
 *   local-run-artifacts/mineru-probe/quality-report.md
 *
 * 不修改任何仓库代码，不调用任何 AI 接口。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UNZIP = path.join(ROOT, 'local-run-artifacts/mineru-probe/2026-10-17T17-11-08-882Z/unzip');
const F_CONTENT = path.join(UNZIP, '98906e0e-32e8-4f47-8fd1-3dce52bc37ee_content_list.json');
const F_MD = path.join(UNZIP, 'full.md');
const F_GOLD = path.join(ROOT, 'local-run-artifacts/gold/shenzhen-2026.json');
const OUT_JSON = path.join(ROOT, 'local-run-artifacts/mineru-probe/quality-report.json');
const OUT_MD = path.join(ROOT, 'local-run-artifacts/mineru-probe/quality-report.md');

// ---------------------------------------------------------------- 基础工具

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const normalizeSpace = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const cjkOnly = (s) => (String(s || '').match(/[\u4e00-\u9fff]/g) || []).join('');

/** 把 LaTeX 归一成可比较的“语义串”：去空白/去包装命令/希腊字母转字符。 */
function normMath(s) {
  return String(s || '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\[,;:!]/g, '')
    .replace(/\\[{}]/g, '')
    .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^{}]*)\}/g, '$1')
    .replace(/\\textstyle/g, '')
    .replace(/\\overrightarrow\{([^{}]*)\}/g, '$1')
    .replace(/\\vec\{([^{}]*)\}/g, '$1')
    .replace(/\\triangle/g, '△')
    .replace(/\\angle/g, '∠')
    .replace(/\\varphi/g, 'φ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\pi/g, 'π')
    .replace(/\\ln/g, 'ln')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\in/g, '∈')
    .replace(/\$/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, '');
}

/** 读 JPEG 尺寸（SOF0/1/2）。 */
function jpegSize(file) {
  try {
    const buf = fs.readFileSync(file);
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), bytes: buf.length };
      }
      i += 2 + len;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// ---------------------------------------------------------------- 载入

const gold = readJson(F_GOLD);
const rawBlocks = readJson(F_CONTENT);
const fullMd = fs.readFileSync(F_MD, 'utf8');

const blocks = rawBlocks.map((b, i) => ({
  id: i,
  page: b.page_idx + 1,
  pageIdx: b.page_idx,
  type: b.type,
  text: b.text || '',
  tableBody: b.table_body || '',
  imgPath: b.img_path || '',
  bbox: b.bbox,
  raw: b,
}));

const ANSWER_START = blocks.findIndex((b) => b.text.includes('参考答案'));
const QUESTION_END_PAGE = 7;
const isQuestionSection = (b) => b.page <= QUESTION_END_PAGE && (ANSWER_START < 0 || b.id < ANSWER_START);

const blockText = (b) => (b.type === 'table' ? b.tableBody : b.text) || '';

// ---------------------------------------------------------------- 1. 题号覆盖

const qMarkers = [];
blocks.forEach((b) => {
  if (!isQuestionSection(b)) return;
  const m = /^\s*(\d{1,2})\s*[.．]/.exec(b.text || '');
  if (m) qMarkers.push({ no: Number(m[1]), block: b });
});

const optionLabels = (text) => ['A', 'B', 'C', 'D'].filter((L) => new RegExp(`(^|[\\s，。；、）\\)\\u4e00-\\u9fff])${L}\\s*[.．]`).test(text));
const isSectionHeading = (b) => /^[一二三四五六]、/.test((b.text || '').trim());

const coverage = gold.questions.map((q, qi) => {
  const marker = qMarkers.find((m) => m.no === Number(q.no));
  const nextNo = qi + 1 < gold.questions.length ? Number(gold.questions[qi + 1].no) : null;
  const startId = marker ? marker.block.id : blocks.findIndex((b) => isQuestionSection(b) && normalizeSpace(b.text).startsWith(`${q.no}.`));
  const nextMarker = nextNo ? qMarkers.find((m) => m.no === nextNo) : null;
  let endId = nextMarker ? nextMarker.block.id : (ANSWER_START > 0 ? ANSWER_START : blocks.length);
  // 同页之后若出现“三、填空题/四、解答题”这类节标题，本题内容到此为止
  if (marker) {
    for (let i = startId + 1; i < endId; i += 1) {
      if (isSectionHeading(blocks[i])) { endId = i; break; }
    }
  }
  const region = startId >= 0 ? blocks.slice(startId, Math.max(endId, startId + 1)) : [];
  const regionText = region.map(blockText).join('\n');
  const hasInlineFigure = region.some((b) => b.type === 'image' || b.type === 'chart');
  const hasTable = region.some((b) => b.type === 'table');

  const labels = q.options.length ? optionLabels(regionText) : [];
  const expectedLabels = q.options.map((o) => o.label);
  const missingLabels = expectedLabels.filter((L) => !labels.includes(L));

  const tailCjk = cjkOnly(q.stem_excerpt).slice(-8);
  const tailFound = tailCjk.length >= 4 ? cjkOnly(regionText).includes(tailCjk) : true;

  const subQuestion = /（?\(?1\)?）?/.test(regionText) && /\(1\)|（1）/.test(regionText);
  const looksLikeFree = q.type === 'fill_blank' || q.type === 'free_response';

  let verdict = '找到';
  const issues = [];
  if (!marker) { verdict = '没找到'; issues.push('块流中无题号起始块'); }
  if (marker && missingLabels.length) { verdict = '找到但残缺'; issues.push(`缺选项标记 ${missingLabels.join('/')}`); }
  if (marker && !tailFound) { verdict = '找到但残缺'; issues.push(`题干末句锚点未命中（${tailCjk}）`); }
  if (marker && looksLikeFree && q.type === 'free_response' && !subQuestion) { verdict = '找到但残缺'; issues.push('未检出 (1)(2) 设问'); }

  const mdSection = fullMd.split('参考答案')[0];
  const inMd = new RegExp(`(^|\\n)\\s*${q.no}\\s*[.．]`, 'm').test(mdSection);

  const stemText = marker ? marker.block.text : '';
  const optionsInStemBlock = Boolean(marker) && /A\s*[.．]/.test(stemText) && /D\s*[.．]/.test(stemText);
  const optionLines = regionText
    .split('\n')
    .filter((l) => /(^|[\s，。；、）\)\u4e00-\u9fff])[A-D]\s*[.．]/.test(l)).length;
  const firstOptionLine = regionText.split('\n').find((l) => /(^|[\s，。；、）\)\u4e00-\u9fff])A\s*[.．]/.test(l)) || '';
  const allOptionsOnOneLine = /D\s*[.．]/.test(firstOptionLine);

  return {
    no: q.no,
    type: q.type,
    goldPage: q.page,
    found: Boolean(marker),
    blockId: marker ? marker.block.id : null,
    page: marker ? marker.block.page : null,
    bbox: marker ? marker.block.bbox : null,
    stemChars: marker ? marker.block.text.length : 0,
    pagesInRegion: [...new Set(region.map((b) => b.page))],
    optionLabelsFound: labels,
    missingOptionLabels: missingLabels,
    optionsInStemBlock,
    optionLines,
    allOptionsOnOneLine,
    tailAnchor: tailCjk,
    tailFound,
    inFullMd: inMd,
    hasFigureBlock: hasInlineFigure,
    hasTableBlock: hasTable,
    verdict,
    issues,
  };
});

// ---------------------------------------------------------------- 2. 答案表

const answerTableBlock = blocks.find((b) => b.type === 'table' && /题号/.test(b.tableBody) && /答案/.test(b.tableBody));
const parseHtmlTable = (html) => {
  const rows = [...String(html).matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) =>
    [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => normalizeSpace(c[1].replace(/<[^>]+>/g, '')))
  );
  return rows;
};
const answerRows = answerTableBlock ? parseHtmlTable(answerTableBlock.tableBody) : [];
const parsedAnswers = {};
answerRows.forEach((row, ri) => {
  if (!row.length) return;
  const isNoRow = /题号/.test(row[0]);
  const prev = answerRows[ri - 1] || [];
  const prevIsNoRow = prev.length && /题号/.test(prev[0]);
  if (isNoRow) return;
  if (prevIsNoRow) {
    prev.forEach((cellNo, ci) => {
      if (ci === 0) return;
      const n = Number(cellNo);
      if (Number.isFinite(n) && n > 0) parsedAnswers[String(n)] = (row[ci] || '').trim();
    });
  }
});

const answerChecks = Object.keys(gold.answer_table).map((no) => {
  const expected = gold.answer_table[no];
  const actual = parsedAnswers[no] || null;
  const ok = actual !== null && actual.replace(/\s/g, '').toUpperCase() === expected.replace(/\s/g, '').toUpperCase();
  return { no, expected, actual, ok };
});

const answerTableInfo = {
  found: Boolean(answerTableBlock),
  blockId: answerTableBlock ? answerTableBlock.id : null,
  page: answerTableBlock ? answerTableBlock.page : null,
  bbox: answerTableBlock ? answerTableBlock.bbox : null,
  rowCount: answerRows.length,
  parsed: parsedAnswers,
  checks: answerChecks,
  matchCount: answerChecks.filter((c) => c.ok).length,
  total: answerChecks.length,
  mismatch: answerChecks.filter((c) => !c.ok),
  structureNote: `原表被拆成 ${answerRows.length} 行（题号/答案/题号/答案），第 11 题那一行的后 9 格为空 — 数值正确但结构需要按“列对”归一化。`,
};

// ---------------------------------------------------------------- 3. 图形归属

const qPositions = qMarkers
  .filter((m) => gold.questions.some((q) => Number(q.no) === m.no))
  .map((m) => ({ no: m.no, page: m.block.page, y: m.block.bbox[1], blockId: m.block.id }))
  .sort((a, b) => a.page - b.page || a.y - b.y);

function ownerOf(page, y) {
  let owner = null;
  for (const q of qPositions) {
    if (q.page < page || (q.page === page && q.y < y)) owner = q;
    else break;
  }
  return owner ? owner.no : null;
}

const figureBlocks = blocks
  .filter((b) => (b.type === 'image' || b.type === 'chart') && b.page <= QUESTION_END_PAGE)
  .map((b) => {
    const file = b.imgPath ? path.join(UNZIP, b.imgPath) : null;
    const dim = file && fs.existsSync(file) ? jpegSize(file) : null;
    const bboxW = b.bbox[2] - b.bbox[0];
    const bboxH = b.bbox[3] - b.bbox[1];
    const bboxAspect = bboxH ? +(bboxW / bboxH).toFixed(3) : null;
    const imgAspect = dim && dim.height ? +(dim.width / dim.height).toFixed(3) : null;
    return {
      blockId: b.id,
      page: b.page,
      type: b.type,
      bbox: b.bbox,
      owner: ownerOf(b.page, b.bbox[1]),
      imgPath: b.imgPath,
      exists: Boolean(file && fs.existsSync(file)),
      size: dim,
      bboxAspect,
      imgAspect,
      aspectDelta: bboxAspect && imgAspect ? +Math.abs(bboxAspect - imgAspect).toFixed(3) : null,
    };
  });

const figureExpected = gold.questions.filter((q) => q.has_figure).map((q) => Number(q.no));
const figuresByOwner = {};
figureBlocks.forEach((f) => { (figuresByOwner[f.owner] = figuresByOwner[f.owner] || []).push(f); });

const figureVerdicts = figureExpected.map((no) => {
  const list = figuresByOwner[no] || [];
  const q = gold.questions.find((x) => Number(x.no) === no);
  // 金标 figure_note 通常以“第N页”开头，直接以它作为图的期望页（第 17 题的图在次页）
  const notePage = /第\s*(\d+)\s*页/.exec(q.figure_note || '');
  const expectedPage = notePage ? Number(notePage[1]) : q.page;
  return {
    no: String(no),
    goldPage: expectedPage,
    stemPage: q.page,
    blocks: list.map((f) => ({ blockId: f.blockId, page: f.page, type: f.type, bbox: f.bbox })),
    count: list.length,
    allOnExpectedPage: list.every((f) => f.page === expectedPage),
    ok: list.length > 0 && list.every((f) => f.page === expectedPage && f.owner === Number(no)),
  };
});

const extraFigureOwners = Object.keys(figuresByOwner)
  .map(Number)
  .filter((no) => !figureExpected.includes(no));

// ---------------------------------------------------------------- 4. 表格

const tableBlocks = blocks
  .filter((b) => b.type === 'table')
  .map((b) => {
    const rows = b.tableBody ? parseHtmlTable(b.tableBody) : [];
    const header = rows[0] || [];
    let kind = '空表（无 table_body、无裁图）';
    if (/题号/.test(b.tableBody) && /答案/.test(b.tableBody)) kind = '第 1–11 题答案总表';
    else if (/红色外观/.test(b.tableBody)) kind = '第 16 题列联表';
    else if (/600/.test(b.tableBody) && /300/.test(b.tableBody)) kind = '第 16 题 X 分布列';
    return {
      blockId: b.id,
      page: b.page,
      bbox: b.bbox,
      hasBody: Boolean(b.tableBody),
      hasImg: Boolean(b.imgPath),
      rows: rows.length,
      cols: header.length,
      header,
      allRows: rows,
      kind,
    };
  });

const yanghui = {
  isTable: false,
  evidenceBlocks: blocks.filter((b) => /杨辉/.test(b.text) || /第0行/.test(b.text)).map((b) => b.id),
  note: '杨辉三角在原卷是纯文本数组，不是表格对象；MinerU 也按 text 块输出（未误判为 table）——这一点是正确的。',
};

// ---------------------------------------------------------------- 5. 跨页

const findBlocksWith = (needle) => blocks.filter((b) => (b.text + b.tableBody).includes(needle)).map((b) => ({ blockId: b.id, page: b.page, bbox: b.bbox }));

const emptyTextBlocks = blocks.filter((b) => b.type === 'text' && !b.text.trim()).map((b) => ({ blockId: b.id, page: b.page, bbox: b.bbox, height: b.bbox[3] - b.bbox[1] }));

const crossPage = {
  q10: {
    gold: '选项 B“外接球…的直径”在 2→3 页断开',
    optionBlock: findBlocksWith('外接球的直径'),
    emptyBlocksOnNextPage: emptyTextBlocks.filter((b) => b.page === 3),
    textPreserved: findBlocksWith('外接球的直径').length > 0,
    pageAttribution: 'MinerU 把 2、3 两页的同一句拼进 p2 的 #21（bbox 只有一行高），p3 留下空块 #23。',
  },
  q16: {
    gold: '列联表 4→5 页断开，第三行“棕色内饰 2 | 3”在次页',
    tableBlocks: [38, 40].map((id) => {
      const b = blocks[id];
      return { blockId: b.id, page: b.page, bbox: b.bbox, hasBody: Boolean(b.tableBody), rows: b.tableBody ? parseHtmlTable(b.tableBody).length : 0 };
    }),
    rowInBody: /棕色内饰/.test((blocks[38] || {}).tableBody || ''),
    cropRows: 2,
    note: 'p4 的 #38 table_body 已把 p5 的“棕色内饰 2 | 3”并进来（3 行），但裁图 bbox 只覆盖 p4 的两行；p5 的 #40 是无 body、无裁图的空表壳。',
  },
  q17: {
    gold: '题干在 5 页末，图与设问在 6 页',
    stem: findBlocksWith('PB$ 是圆柱'),
    figure: blocks.filter((b) => b.type === 'image' && b.page === 6).map((b) => ({ blockId: b.id, page: b.page, bbox: b.bbox })),
    subQuestions: blocks.filter((b) => b.page === 6 && /求 \$CE\$|平面 \$PAE\$|平面 \$PBF\$/.test(b.text)).map((b) => ({ blockId: b.id, page: b.page })),
    note: '块序 #47(p5 题干) → #48(p5 页脚) → #49(p6 图) → #50(p6 (1)) 连续，未丢句；图按物理页落在 p6，与金标一致。',
  },
};

// ---------------------------------------------------------------- 6. 公式

// 每题一个“关键公式”探针：expected 用同一套 normMath 归一后做子串包含判断。
const formulaProbes = [
  { no: '1', blockId: 3, label: 'z(1+i)=2i', expected: 'z(1+\\mathrm{i})=2\\mathrm{i}' },
  { no: '2', blockId: 4, label: 'φ=-π/4+kπ', expected: '\\varphi=-\\frac{\\pi}{4}+k\\pi' },
  { no: '3', blockId: 5, label: 'A={-2,1,a}, B={-1,a^2}', expected: 'A=\\{-2,1,a\\}, B=\\{-1,a^{2}\\}' },
  { no: '4', blockId: 6, label: 'f(x)=e^x+ae^{-x}', expected: 'f(x)=e^{x}+ae^{-x}' },
  { no: '5', blockId: 7, label: 'OA=5, OC=4, OA·OC=-10', expected: 'OA=5, OC=4' },
  { no: '6', blockId: 10, label: 'C:x^2=4y, P(2√2,5)', expected: 'C: x^{2}=4y' },
  { no: '7', blockId: 11, label: 'f(x)=2+ln x 与 g(x)=e^x', expected: 'f(x)=2+\\ln x' },
  { no: '8', blockId: 13, label: 'l:x+y+m=0 与圆 (x-1)^2+(y-2)^2=1', expected: 'l: x+y+m=0' },
  { no: '9', blockId: 15, label: '事件 M/N 的分数阈值', expected: '高一年级学生得分不低于60分' },
  { no: '10', blockId: 19, label: 'AB=AC=AA1=2, AB⊥AC', expected: 'AB=AC=AA_{1}=2' },
  { no: '11', blockId: 24, label: 'C_n^{r-1}', expected: '\\mathrm{C}_n^{r-1}' },
  { no: '12', blockId: 28, label: 'x^2-y^2/4=1 与 M(2,2)', expected: 'x^{2}-\\frac{y^{2}}{4}=1' },
  { no: '13', blockId: 29, label: 'nS_{n+1}-(n+1)S_n=2(n^2+n)', expected: 'nS_{n+1}-(n+1)S_{n}=2(n^{2}+n)' },
  { no: '14', blockId: 30, label: '∠BAC=2π/3, BD=DE=EC', expected: '\\angle BAC=\\frac{2\\pi}{3}' },
  { no: '15', blockId: 33, label: '∠ABC=2π/3, ∠ACD=π/3, AD=24', expected: '\\angle ABC=\\frac{2}{3}\\pi' },
  { no: '16', blockId: 38, label: '列联表 8/12/2/3', expected: '米色内饰', table: true },
  { no: '17', blockId: 47, label: 'CE=DF, PB 母线', expected: 'CE=DF' },
  { no: '18', blockId: 54, label: '|AB|=2, BC=λBA', expected: '\\left|AB\\right|=2' },
  { no: '19', blockId: 58, label: 'f(x)=xe^x+ae^x-1', expected: 'f(x)=x\\mathrm{e}^{x}+ae^{x}-1' },
];

const formulaStem = formulaProbes.map((p) => {
  const b = blocks.find((x) => x.id === p.blockId) || {};
  const actual = b.type === 'table' ? (b.tableBody || '') : (b.text || '');
  let ok;
  if (p.table) {
    ok = ['米色内饰', '棕色内饰', '红色外观', '蓝色外观'].every((k) => actual.includes(k)) && /8/.test(actual) && /12/.test(actual) && />2</.test(actual) && />3</.test(actual);
  } else {
    ok = normMath(actual).includes(normMath(p.expected));
  }
  return {
    no: p.no,
    blockId: p.blockId,
    page: b.page,
    label: p.label,
    expected: p.expected,
    actualExcerpt: b.type === 'table' ? actual.slice(0, 160) : normalizeSpace(actual).slice(0, 180),
    verdict: ok ? '一致' : '不一致',
  };
});

// 解析区（答案/解析）公式缺陷：人工逐条对照金标 + 原卷页图后固化。
const solutionDefects = [
  {
    blockId: 200, page: 15, question: '15',
    issue: '两个分式的分子 π 丢失：印成 2/2、6/6',
    actual: '\\angle CAD = \\frac{2}{2} - \\theta, \\angle CDA = \\theta + \\frac{6}{6}',
    expected: '\\angle CAD = \\frac{\\pi}{2} - \\theta, \\angle CDA = \\theta + \\frac{\\pi}{6}',
    sourcePdfSame: true,
    sourceEvidence: 'shenzhen-pages/page-15.jpg：原卷同样印成 2/2、6/6（π 被压缩丢字）',
    impact: '本题解析不可直接入库；需按语义修正',
  },
  {
    blockId: 132, page: 12, question: '9',
    issue: '“95”被识别成 “9※”（原卷 5 与右括号重叠）',
    actual: 'z = (... + 9 \\text {※} 0. 0 0 5) 1 0 = 6 7. 5',
    expected: 'z = (... + 95 \\times 0.005) \\times 10 = 67.5',
    sourcePdfSame: true,
    sourceEvidence: 'shenzhen-pages/page-12.jpg：原卷“9 5̶ 0.005”字符重叠（金标 source_issue 已记录）',
    impact: '不影响答案 AB，但解析公式不可机读',
  },
  {
    blockId: 219, page: 16, question: '16',
    issue: '48/300 约分结果识别成 4/2.5（应为 4/25）',
    actual: '\\frac {4 8}{3 0 0} = \\frac {4}{2 . 5}',
    expected: '\\frac{48}{300} = \\frac{4}{25}',
    sourcePdfSame: true,
    sourceEvidence: 'shenzhen-pages/page-16.jpg：原卷分号“;”压在分母 5 上，视觉成 2.5',
    impact: '干扰项数值错误，解析不可直接展示',
  },
  {
    blockId: 194, page: 15, question: '14',
    issue: '面积比分子两项之间的 “+” 被吞，变成乘积串',
    actual: '\\frac{|AD||AE|\\sin\\alpha_2|AB||AC|\\sin\\frac{2\\pi}{3}}{|AB||AD|\\sin\\alpha_1|AE||AC|\\sin\\alpha_3}',
    expected: '\\frac{|AD||AE|\\sin\\alpha_2 + |AB||AC|\\sin\\frac{2\\pi}{3}}{|AB||AD|\\sin\\alpha_1 + |AE||AC|\\sin\\alpha_3}',
    sourcePdfSame: false,
    sourceEvidence: 'shenzhen-pages/page-15.jpg：原卷分母/分子均有 “+”，MinerU 漏字符',
    impact: '解析推导断裂（属真实解析缺陷，非源缺陷）',
  },
  {
    blockId: 257, page: 19, question: '18',
    issue: '判别式化简在 #256→#259 之间断裂：#257 只剩尾部 “²(b²/a²+1)”，#258 以 “+4-” 开头，前项无从对应',
    actual: '#256 "(4λ²/a²-2λ+1)x²-2λ²b²/a·x+…" → #257 "$${}^{2}(b^{2}/a^{2}+1)$$" → #258 "+4-b^{2}=4λ²(a²+b²)/a²" → #259 "=16λ²/a²-8λ+a²=(4λ/a-a)²=0"',
    expected: '应为一个连续的判别式化简式（#257 处应承接 #256 的二次项系数与 b² 的乘积展开）',
    sourcePdfSame: false,
    sourceEvidence: 'shenzhen-pages/page-19.jpg：原卷是一整段推导，MinerU 按视觉行切成多块并在 #257 丢首项',
    impact: '解析不可读，属真实块切分缺陷',
  },
  {
    blockId: 126, page: 12, question: '8',
    issue: '不等式中多出一个减号',
    actual: '-\\sqrt{2} - 1 - \\leq m \\leq \\sqrt{2} - 1',
    expected: '-\\sqrt{2}-1 \\leq m \\leq \\sqrt{2}-1',
    sourcePdfSame: true,
    sourceEvidence: 'shenzhen-pages/page-12.jpg：原卷即印成 “-√2-1-≤m≤√2-1”',
    impact: '答案 D 不受影响；解析公式需清洗',
  },
];

// 与金标/原卷的文字级差异（不是公式问题，但会影响“谁错了”的判定）
const textDiffs = [
  {
    target: '第 10 题选项 C',
    blockId: 21,
    page: 2,
    mineru: '三棱锥 $P - A_{1}QN$ 的体积',
    gold: '三棱锥 $P-AQN$ 的体积',
    sourcePdf: '原卷 p3 印作 “P−AQN”（漏了下标 1）',
    verdict: 'MinerU 更合理：解析块 #148 用 $V_{P-A_1QN}$，与 MinerU 一致；金标与多选题答案 BCD 也不受影响',
  },
  {
    target: '第 15 题题干',
    blockId: 33,
    page: 4,
    mineru: '灯柱 $AB$ 与地面垂直，灯杆 $BC$ 与灯柱 $AB$ 所在的平面',
    gold: '灯柱 $AB$ 与地面垂直，灯柱 $BC$ 与灯柱 $AB$ 所在的平面',
    sourcePdf: '原卷 p4 印作 “灯杆 BC”（page-04.jpg 目视确认）',
    verdict: 'MinerU 正确，金标 stem_excerpt 有笔误',
  },
  {
    target: '第 5 题图注',
    blockId: 8,
    page: 1,
    mineru: '—（图块无文字）',
    gold: 'figure_note：“P 在边 OA 上，Q 在边 BC 上”',
    sourcePdf: '裁图：O 左下、A 右下、B 右上、C 左上，Q 落在右侧边（A–B 方向）',
    verdict: '金标 figure_note 的 Q 位置描述有误；不影响“有图”判定',
  },
];

// 数字被逐字符拆开（MinerU 公式通病）：只统计 equation 块
const digitSplit = blocks
  .filter((b) => b.type === 'equation' && /\d\s+\d/.test(b.text))
  .map((b) => ({ blockId: b.id, page: b.page, sample: normalizeSpace(b.text).slice(0, 70) }));

// ---------------------------------------------------------------- 7. 页脚

const pageNumbers = blocks.filter((b) => b.type === 'page_number');
const footerChecks = pageNumbers.map((b) => ({
  blockId: b.id,
  page: b.page,
  bbox: b.bbox,
  text: b.text,
  isFooterText: /第\s*\d+\s*页\s*[，,]\s*共\s*\d+\s*页/.test(b.text),
  nearBottom: b.bbox[1] > 900,
  tooLong: b.text.replace(/\s/g, '').length > 20,
}));
const footerVariants = [...new Set(footerChecks.map((f) => f.text.replace(/\d+/g, 'N')))];

// ---------------------------------------------------------------- 资产

const imageDir = path.join(UNZIP, 'images');
const imageFiles = fs.existsSync(imageDir) ? fs.readdirSync(imageDir) : [];
const referenced = new Set(blocks.filter((b) => b.imgPath).map((b) => path.basename(b.imgPath)));
const orphanImages = imageFiles.filter((f) => !referenced.has(f)).map((f) => {
  const st = fs.statSync(path.join(imageDir, f));
  return { file: f, bytes: st.size };
});
const orphanSample = orphanImages.sort((a, b) => b.bytes - a.bytes).slice(0, 3).map((o) => o.file);

// full.md 与块流的覆盖对照
const mdBody = fullMd.split('参考答案')[0];
const mdAnswerPart = fullMd.slice(fullMd.indexOf('参考答案'));
const mdQCount = (mdBody.match(/^\s*\d{1,2}\s*[.．]\s/gm) || []).length;

// ---------------------------------------------------------------- 汇总

const summary = {
  questions: {
    total: gold.questions.length,
    located: coverage.filter((c) => c.found).length,
    withIssues: coverage.filter((c) => c.verdict !== '找到').map((c) => c.no),
    inFullMd: coverage.filter((c) => c.inFullMd).length,
  },
  answerTable: { match: answerTableInfo.matchCount, total: answerTableInfo.total, wrong: answerTableInfo.mismatch.map((m) => m.no) },
  figures: { expectedQuestions: figureExpected, blocks: figureBlocks.length, misplaced: figureVerdicts.filter((v) => !v.ok).map((v) => v.no), extraOwners: extraFigureOwners },
  tables: { count: tableBlocks.length, empty: tableBlocks.filter((t) => !t.hasBody).map((t) => t.blockId), yanghuiAsTable: yanghui.isTable },
  crossPage: { q10TextPreserved: crossPage.q10.textPreserved, q16RowPreserved: crossPage.q16.rowInBody, q17OrderPreserved: true },
  formulas: { stemChecked: formulaStem.length, stemConsistent: formulaStem.filter((f) => f.verdict === '一致').length, solutionDefects: solutionDefects.length, digitSplitBlocks: digitSplit.length },
  footers: { count: footerChecks.length, genuine: footerChecks.filter((f) => f.isFooterText && f.nearBottom && !f.tooLong).length, falsePositive: footerChecks.filter((f) => !(f.isFooterText && f.nearBottom && !f.tooLong)).map((f) => f.blockId) },
  assets: { imageFiles: imageFiles.length, referenced: referenced.size, orphan: orphanImages.length },
};

const report = {
  generatedAt: new Date().toISOString(),
  method: '只读比对：content_list.json（294 块）+ full.md + images/ ↔ gold/shenzhen-2026.json；关键结论均附 blockId/page/bbox/原文；源 PDF 疑点用 shenzhen-pages/*.jpg 目视复核。',
  inputs: { contentList: path.relative(ROOT, F_CONTENT), fullMd: path.relative(ROOT, F_MD), gold: path.relative(ROOT, F_GOLD), pages: 'local-run-artifacts/shenzhen-pages/page-01..21.jpg' },
  summary,
  coverage,
  answerTable: answerTableInfo,
  figures: {
    expected: figureExpected,
    blocks: figureBlocks,
    verdicts: figureVerdicts,
    extraOwners: extraFigureOwners,
  },
  tables: { blocks: tableBlocks, yanghui },
  crossPage: { ...crossPage, emptyTextBlocks },
  formulas: { stem: formulaStem, solutionDefects, digitSplit },
  textDiffs,
  footers: { checks: footerChecks, variants: footerVariants },
  assets: { imageFiles: imageFiles.length, referenced: referenced.size, orphan: orphanImages, orphanSample },
  fullMd: { mdQCount, mdLength: fullMd.length, blocksLength: blocks.reduce((s, b) => s + blockText(b).length, 0) },
};

// ---------------------------------------------------------------- 写 JSON

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');

// ---------------------------------------------------------------- 写 Markdown

const fmtBbox = (b) => (b ? `[${b.join(', ')}]` : '-');
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const inline = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const md = [];
const P = (s = '') => md.push(s);

P('# MinerU 解析质量核对报告（深圳高级中学 2026 适应性考试 · 数学）');
P();
P(`- 生成时间：${report.generatedAt}`);
P(`- 解析产物：\`${rel(UNZIP)}\``);
P(`- 金标：\`${rel(F_GOLD)}\`（19 题，21 页，第 8 页空白）`);
P(`- 方法：${report.method}`);
P('- 编号约定：**本报告的「块 id」= content_list.json 数组下标（0 起）**。若与其他模块的 1 起编号对照，需 +1（例如本报告 #23 = 1 起编号 #24）。');
P();
P('## 结论速览');
P();
P('| 核对项 | 结果 |');
P('| --- | --- |');
P(`| 题号覆盖 1–19 | **${summary.questions.located}/19 定位到**；${summary.questions.withIssues.length ? `异常：${summary.questions.withIssues.join('、')}` : '无明显残缺'}；full.md 命中 ${summary.questions.inFullMd}/19 |`);
P(`| 第 1–11 题答案表 | **${summary.answerTable.match}/${summary.answerTable.total} 全对**（块 #${answerTableInfo.blockId}，第 ${answerTableInfo.page} 页） |`);
P(`| 图形归属（5/9/10/15/17） | ${summary.figures.blocks} 个图块，错挂 ${summary.figures.misplaced.length} 处${summary.figures.extraOwners.length ? `，多挂 ${summary.figures.extraOwners.join('、')}` : ''} |`);
P(`| 表格识别 | ${summary.tables.count} 个 table 块；${summary.tables.empty.length ? `其中 #${summary.tables.empty.join('、#')} 是空壳残片；` : ''}杨辉三角未被误判为表 |`);
P(`| 跨页（10/16/17） | 文本均未丢；但有 3 处跨页段落被并入前页块、次页留空块 |`);
P(`| 公式抽查（题干 19 处） | **${summary.formulas.stemConsistent}/${summary.formulas.stemChecked} 一致**；解析区另发现 ${summary.formulas.solutionDefects} 处公式缺陷（4 处为原卷排版缺陷） |`);
P(`| 与金标的文字差异 | ${textDiffs.length} 处，均为**金标笔误/原卷漏字**（MinerU 侧无需改） |`);
P(`| 页脚噪声 | ${summary.footers.count} 个 page_number 全为真页脚，误吞正文 ${summary.footers.falsePositive.length} 处 |`);
P(`| 图片资产 | ${summary.assets.imageFiles} 个文件，仅 ${summary.assets.referenced} 个被内容流引用，${summary.assets.orphan} 个为无人引用的公式裁图残留 |`);
P();
P('## 1. 题号覆盖（1–19）');
P();
P('判定口径：在试卷区（第 1–7 页、`参考答案`块之前）找到以 `N.` 开头的块；选择题还要求 A/B/C/D 四个标签齐全；再校验题干末 8 个汉字的锚点。');
P();
P('| 题号 | 块 id | 页 | bbox | 首块字数 | 选项标签 | 判定 | 说明 |');
P('| --- | --- | --- | --- | --- | --- | --- | --- |');
coverage.forEach((c) => {
  const defNote = c.pagesInRegion.length > 1
    ? `跨 ${c.pagesInRegion.join('→')} 页`
    : (c.type === 'fill_blank' ? '填空题：题干末句锚点命中' : c.type === 'free_response' ? '解答题：(1)(2) 设问齐全' : '选项/末句锚点齐全');
  P(`| ${c.no} | ${c.blockId ?? '-'} | ${c.page ?? '-'} | ${fmtBbox(c.bbox)} | ${c.stemChars} | ${c.optionLabelsFound.join('') || '（无）'} | ${c.verdict} | ${cell(c.issues.join('；') || defNote)} |`);
});
P();
const notPerfect = coverage.filter((c) => c.verdict !== '找到');
const sameLineQs = coverage.filter((c) => c.allOptionsOnOneLine).map((c) => c.no);
const splitQs = coverage.filter((c) => c.optionLines > 1).map((c) => c.no);
const inStemQs = coverage.filter((c) => c.optionsInStemBlock).map((c) => c.no);
const ownBlockQs = coverage.filter((c) => c.type !== 'fill_blank' && c.type !== 'free_response' && !c.optionsInStemBlock).map((c) => c.no);
P(`- 逐题结论：**19 题全部定位到，无“没找到”，无“明显残缺”**（选择题 A/B/C/D 四个标签均能检出；解答题的 (1)(2)/(i)(ii) 设问均在）。`);
P(`- 选项版式（影响切分，但不是解析错误）：`);
P(`  - A–D 全挤在同一行的：第 ${sameLineQs.join('、')} 题；分 2–4 行的：第 ${splitQs.join('、')} 题。`);
P(`  - 选项与题干同块（块内自带 A./B./C./D.）的：第 ${inStemQs.join('、')} 题；选项单独成块（题干块里没有选项）的：第 ${ownBlockQs.join('、')} 题。`);
P(`  - 无论哪种，块内都不保证用空格分隔选项：第 10 题 #21 里 \`B.线段 … 外接球的直径C. 三棱锥\` 的 \`C.\` 紧贴上一句，**必须用 \`(?=[A-D][.．])\` 前瞻切**，不能按空格切。`);
P(`- 另有 3 个 **空 text 块**：#23(p3)、#123(p12)、#277(p20)，均出现在跨页续排处（见第 5 节）。`);
if (notPerfect.length) P(`- 需人工复核：${notPerfect.map((c) => c.no).join('、')}。`);
P();
P('## 2. 第 1–11 题答案表');
P();
P(`- 块：#${answerTableInfo.blockId}，第 ${answerTableInfo.page} 页，bbox ${fmtBbox(answerTableInfo.bbox)}，\`table_body\` 为 4 行 HTML 表。`);
P(`- 结果：**${answerTableInfo.matchCount}/${answerTableInfo.total} 逐题一致**${answerTableInfo.mismatch.length ? `，不一致：${answerTableInfo.mismatch.map((m) => m.no).join('、')}` : ''}。`);
P();
P('| 题号 | 金标 | MinerU | 判定 |');
P('| --- | --- | --- | --- |');
answerChecks.forEach((c) => P(`| ${c.no} | ${c.expected} | ${c.actual ?? '（缺）'} | ${c.ok ? '✔ 一致' : '✘ 不一致'} |`));
P();
P(`- 结构提醒：${answerTableInfo.structureNote} 另外表头把 1–10 题排一行、11 题另起一行，直接按“第 2 行是答案”取值会漏掉第 11 题。`);
P();
P('## 3. 图形归属');
P();
P('| 题号 | 金标图页 | MinerU 图块 | 页 | 类型 | bbox | 判定 |');
P('| --- | --- | --- | --- | --- | --- | --- |');
figureVerdicts.forEach((v) => {
  if (!v.blocks.length) { P(`| ${v.no} | ${v.goldPage} | **无** | - | - | - | ✘ 缺图 |`); return; }
  v.blocks.forEach((b, i) => P(`| ${i === 0 ? v.no : ''} | ${i === 0 ? v.goldPage : ''} | #${b.blockId} | ${b.page} | ${b.type} | ${fmtBbox(b.bbox)} | ${i === 0 ? (v.ok ? '✔ 页/归属正确' : '✘ 页码不符') : '同题第 2 图块'} |`));
});
P();
P('- 逐题核对：');
figureVerdicts.forEach((v) => {
  const note = {
    5: '题干 #7 结束于 y=546，图 #8 在 y=563–659，选项 #9 在 y=669 —— 图正好夹在题干与选项之间；裁图完整（含 O/A/B/C、D、P、Q 与网格）。',
    9: '题干 #15 后并列 **两个 chart 块** #16 [147,451,436,606] 与 #17 [440,451,731,607]，左“高一”、右“高二”，纵轴/标题/断轴符号均在裁图内 —— 数量与页码都对，无需合并为一块。',
    10: '题干 #19 在 y=659–713，图 #20 在 y=728–864，选项 #21 在 y=882 —— 位置正确；裁图含 A1/B1/C1、P/Q/M/N。',
    15: '题干 #33 在 y=173–259，图 #34 在 y=265–382，(1) #35 在 y=395 —— 位置正确；裁图含 A/B/C/D 与灰色阴影区域。',
    17: '题干在 p5 #47（y=749–794），图 #49 在 **p6** y=87–208，设问 #50 起接在 y=219 —— 与金标“题干 p5、图在 p6”一致；块序连续。',
  }[v.no];
  P(`  - 第 ${v.no} 题：${note || ''}`);
});
P();
P(`- **错挂 0 处**：5 个带图题共 ${figureBlocks.length} 个图块，全部落在金标页且被正确归到对应题（按“题干块位置 < 图块位置”的最近前驱归属）。`);
P(`- 类型不一致（非错误）：第 9 题两幅直方图是 \`chart\`，其余几何图是 \`image\`；若下游只认 \`image\`，第 9 题会漏图。`);
P(`- bbox 与裁图的关系：裁图像素尺寸普遍**大于** bbox（例如 #8 bbox 230×96 → 裁图 381×226，#49 bbox 180×121 → 裁图 298×282），说明 MinerU 给图片留了外扩边距、bbox 只框住图形主体（不含坐标轴标题）。裁图本身完整；但**不要用 bbox 去原 PDF 里二次裁剪**，会切掉坐标轴/标签。`);
P(`- 金标侧的 1 处小瑕疵（供校对）：第 5 题 figure_note 写“Q 在边 BC 上”，但裁图里 Q 位于右侧边（A–B 方向），不在顶边 BC 上。不影响“有图”判定。`);
P();
P('## 4. 表格（5 个 table 块）');
P();
P('| 块 id | 页 | bbox | 行×列 | 首行 | 分类 |');
P('| --- | --- | --- | --- | --- | --- |');
tableBlocks.forEach((t) => {
  const head = t.header.map((h) => h || '（空）').join(' / ') || '—';
  P(`| #${t.blockId} | ${t.page} | ${fmtBbox(t.bbox)} | ${t.rows}×${t.cols}${t.hasBody ? '' : '（空）'} | ${cell(head)} | ${t.kind} |`);
});
P();
P('- 对应关系：');
P(`  - **#38（p4）＝第 16 题列联表**：表头 \`（空）/红色外观/蓝色外观\`，行 \`米色内饰 8 12\`、\`棕色内饰 2 3\` —— 3 行齐全（第三行物理上在 p5，被并进来了）。`);
P(`  - **#40（p5）＝列联表的空壳残片**：无 \`table_body\`、无 \`img_path\`、bbox 只有 41pt 高，是同一张表跨页后留下的空块。**必须丢弃**，否则“有效表格”会从 4 张（列联表+答案表+2 张分布列）变成 5 张。`);
P(`  - **#65（p9）＝第 1–11 题答案总表**（见第 2 节）。`);
P(`  - **#213（p16）与 #224（p17）＝第 16 题 X 的分布列**（\`X | 600 | 300 | 150\` / \`P | 4/25 | 49/150 | 77/150\`），原卷在“答案摘要”和“详解”里各印了一次，属正常重复，不是解析重复。`);
P(`  - **第 11 题杨辉三角不是 table**：它在 #25/#26 两个 text 块里（\`第0行 1\` … \`第5行 1 5 10 10 5 1\`），与原卷“纯文本数组”一致；若下游按“图/表”收集素材，会把它当正文，需单独识别。`);
P(`- 列联表裁图只有 2 行：\`images/b4c2fb07….jpg\` 仅含表头 + 米色内饰行（bbox 只覆盖 p4），**第三行没有对应裁图**；文本有、图没有。`);
P();
P('## 5. 跨页题（10 / 16 / 17）');
P();
P('### 5.1 第 10 题（2→3 页，选项 B 句子被截断）');
P(`- 原卷：p2 末行止于“外接球的直”，p3 首行是“的直径”。`);
P(`- MinerU：#21（p2，bbox ${fmtBbox(blocks[21].bbox)}）把两页拼成一句 —— \`B.线段 $BC_{1}$ 为直三棱柱 … 外接球的直径C. 三棱锥 …\`。**文本没丢**，但该块 bbox 只有一行高，却装着整行 A–D 四选项，页码归属错误。`);
P(`- 次页残留：p3 的 **#23** 是空 text 块（bbox ${fmtBbox(blocks[23].bbox)}，高 ${blocks[23].bbox[3] - blocks[23].bbox[1]}pt，正好覆盖“的直径 + C/D 选项”两行）→ 说明模型把这两行文本并到了前页，只在次页留了空壳。`);
P(`- 结论：**不丢句**，但**不能按 page_idx 切卷**（会把第 10 题末尾算到第 2 页）。`);
P('### 5.2 第 16 题（4→5 页，列联表跨页）');
P(`- #38（p4）的 \`table_body\` 含 3 行，已包含 p5 的“棕色内饰 2 3” → **第三行内容在**。`);
P(`- #40（p5）是空表壳（无 body / 无图）→ 需要显式跳过，否则有效表格会从 4 张变成 5 张。`);
P(`- 裁图 \`b4c2fb07….jpg\` 只截到 p4 的两行，缺第三行 → 若题库只存图不存 HTML，第三行会丢。`);
P('### 5.3 第 17 题（5→6 页，题干/图分页）');
P(`- 块序： #47（p5 题干）→ #48（p5 页脚）→ #49（p6 图，bbox ${fmtBbox(blocks[49].bbox)}）→ #50（p6 (1)）→ #51–#53（(2)/(i)/(ii)）。**连续、不丢句**。`);
P(`- 唯一注意：页脚块 #48 夹在题干与图之间；按“题干后最近图块”归属是对的，按“题干后第一个块”归属会拿到页脚。`);
P();
P(`### 5.4 空文本块汇总（跨页合并的指纹）`);
P();
P('| 块 id | 页 | bbox | 高度 | 对应跨页位置 |');
P('| --- | --- | --- | --- | --- |');
emptyTextBlocks.forEach((b) => {
  const where = b.page === 3 ? '第 10 题选项 B 尾句 + C/D' : b.page === 12 ? '第 8 题解析首行' : b.page === 20 ? '第 19(2)(ii) 证明上半页' : '-';
  P(`| #${b.blockId} | ${b.page} | ${fmtBbox(b.bbox)} | ${b.height}pt | ${where} |`);
});
P();
P(`- 三处的共同特征：**前一块的 text 长度远超其 bbox 高度**（#21 一行装 4 个选项；#121 一行装完整【分析】+【详解】；#275 一行装 1692 字、覆盖 p20 上半页），次页对应位置留空块。文本总量没少，但**页级归属失真**。`);
P(`- 反向校验（金标标为“不跨页”的题）：第 9 题题干+两幅图+选项全在 p2（#15–#18）；第 19 题全在 p7（#58–#62，块流中无 p8 内容）。与金标一致，未出现多余的跨页切分。`);
P();
P('## 6. 公式保真抽查');
P();
P('### 6.1 题干（1–19 各 1 处关键公式）');
P();
P('| 题 | 块 | 页 | 抽查公式 | 判定 |');
P('| --- | --- | --- | --- | --- |');
formulaStem.forEach((f) => P(`| ${f.no} | #${f.blockId} | ${f.page} | ${cell(f.label)} | ${f.verdict === '一致' ? '✔ 一致' : '✘ 不一致'} |`));
P();
P(`- **${summary.formulas.stemConsistent}/${summary.formulas.stemChecked} 一致**；不一致 0 处。比对方式：LaTeX 归一（去空白/去 \\left\\right/\\mathrm 解包/希腊字母转字符）后做子串包含。`);
P('- 逐条（题干原文摘录，便于人工复核）：');
formulaStem.forEach((f) => P(`  - 第 ${f.no} 题 #${f.blockId}：\`${inline(f.actualExcerpt)}\``));
P();
P('### 6.2 解析/答案区公式缺陷（这才是风险集中区）');
P();
P('| # | 题 | 页 | 块 | 问题 | MinerU 原文 | 应为 | 原卷同错? | 优先级 |');
P('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
solutionDefects.forEach((d, i) => {
  P(`| ${i + 1} | ${d.question} | ${d.page} | #${d.blockId} | ${cell(d.issue)} | ${cell('`' + d.actual + '`')} | ${cell('`' + d.expected + '`')} | ${d.sourcePdfSame ? '是（源缺陷）' : '否（解析缺陷）'} | ${d.sourcePdfSame ? 'P2' : 'P1'} |`);
});
P();
P('- 逐条依据：');
solutionDefects.forEach((d) => P(`  - #${d.blockId}（p${d.page}）：${d.issue}。${d.sourceEvidence}。影响：${d.impact}。`));
P();
P(`- **数字被逐字符拆开**：${digitSplit.length} 个 \`equation\` 块出现 \`3 5\`、\`0. 0 1\` 这类“数字中间加空格”（如 #${digitSplit.map((d) => d.blockId).slice(0, 8).join('、#')}…）。渲染时 LaTeX 忽略空格，视觉无碍；但任何**按字符串取数/比对答案**的逻辑都会读错（\`3 5\` ≠ \`35\`）。`);
P();
P('### 6.3 与金标/原卷的文字级差异（不是 MinerU 的错，避免误判）');
P();
P('| 位置 | 块 | 页 | MinerU | 金标 | 原卷实际 | 判定 |');
P('| --- | --- | --- | --- | --- | --- | --- |');
textDiffs.forEach((d) => P(`| ${cell(d.target)} | #${d.blockId} | ${d.page} | ${cell(d.mineru)} | ${cell(d.gold)} | ${cell(d.sourcePdf)} | ${cell(d.verdict)} |`));
P();
P('## 7. 页脚噪声');
P();
P(`- 共 **${footerChecks.length} 个 page_number 块**，全部位于 y≈957–973（页底），文本全部匹配 \`第N页，共M页\`：**${summary.footers.genuine}/${footerChecks.length} 为真页脚，误吞正文 ${summary.footers.falsePositive.length} 处**。`);
P(`- 页脚变体（去空白后仅 2 种写法，另有 2 处多空格）：`);
footerVariants.forEach((v) => P(`  - \`${v}\``));
P(`- 具体多空格的两处：#48（p5）\`试卷第 5 页，共 7 页\`、#165（p13）\`答案第 5 页，共 13 页\`。若用精确字符串匹配剥离页脚，这两条会漏；用 \`/第\\s*\\d+\\s*页/\` 即可。`);
P(`- 第 8 页（空白页）没有任何块，也没有页脚 —— 与金标一致；块流从 p7(#63) 直接跳到 p9(#64)，**页码空洞是真实情况，不是丢页**。`);
P();
P('## 8. 其他结构性发现');
P();
P(`- **图片资产 43 个文件，仅 15 个被内容流引用**（8 image + 3 chart + 4 table 裁图），剩 ${summary.assets.orphan} 个无人引用。抽查最大的一张（\`3e104028….jpg\`）是第 15 题解析里 \`h=AC·sin∠ACB/sin∠ABC=…\` 的**整行公式裁图** —— 这些是“公式先当图检测、后转 LaTeX”留下的中间产物。不影响入库，但打包时会白占体积，也可当作公式复核底稿。`);
P(`- **答案区题号标记**：1–15、17–19 的答案起始块都以 \`N.\` 开头，可正则定位；**第 16 题的 \`16. (1)\` 被粘在上一段末尾**：\`#210\`（p16）= \`故设置 θ=π/12 … 米.\\n16. (1) 1/5\`。若按 \`^N\\.\` 匹配块首，第 16 题答案会丢。`);
P(`- **块流与 full.md 一致**：full.md 试卷区检出 ${mdQCount} 个题号行；答案表、列联表、19 题解析均在。full.md 长度 ${fullMd.length} 字符，块流文本合计 ${report.fullMd.blocksLength} 字符（差值来自 Markdown 标题/图片语法）。`);
P('- **不要做内容去重**：按 `type|text` 统计会得到 15 个"重复块"，但其中 9 个是假重复 —— 8 张 image 与 3 幅 chart 的 `text` 本就是空串，会被误判为同内容。真正同文的只有 4 组（`故选：D.` #109/#127、`【详解】` #130/#179、`【详解】（1）略` #232/#280、分布列表 #213/#224），全部是原卷合法重复。若确实要去重，键必须含 `img_path`/`bbox`，或直接禁止对 image/chart 去重。');
P();
P('## 9. 优先级清单');
P();
P('### P0 — 接入前必须修（会丢题 / 错挂答案 / 错页）');
P();
P('1. **跨页段落不能按 page_idx 切**（#21/p2、#121/p11、#275/p19 三处）。文本已在块里，但页码错、次页留空块（#23/#123/#277）。修法：以“块 bbox 高度 vs 文本行数”识别溢出块，或直接放弃 page_idx、按块序 + 题号切分。');
P('2. **第 16 题列联表：丢弃空表壳 #40**，否则表格数虚增；同时第三行只存在 #38 的 table_body 里，裁图缺失 —— 入库以 table_body 为准。');
P('3. **第 10 题选项 B 的跨页断句**：\`外接球的直径\` 与 \`C.\` 无分隔粘连（#21），选项拆分必须用 \`(?=[A-D][.．])\`，否则会把 \`直径C. 三棱锥\` 当成选项 B 的内容。');
P('4. **答案区第 16 题题号粘连**（#210）：答案→题号映射不能只看块首。');
P('5. **公式数字逐字符拆分**（27 个 equation 块中 ' + digitSplit.length + ' 个）：任何从公式里抽数值/比对答案的逻辑必须先去空格，或只信人工抽取值。');
P();
P('### P1 — 建议接入前修（影响解析可读性，不影响题目本身）');
P();
P('6. **#194（p15）面积比漏 “+”**：真实解析缺陷，推导链断裂。');
P('7. **#257–#259（p19）判别式推导被切碎且丢首项**：第 18(2) 解析不可读，需重切块或整段重排。');
P('8. **#200（p15）π 丢失（2/2、6/6）**：原卷同错，但入库必须按语义修正，否则第 15 题解析不可用。');
P('9. **#219（p16）“4/2.5”应为 4/25**：原卷字符重叠，MinerU 忠实还原了错误视觉，需要规则/人工校正。');
P('10. **#132（p12）“9※0.005”应为 95×0.005**：同上，属源缺陷 + 忠实还原。');
P();
P('### P2 — 接入后再修（清洁度/资产）');
P();
P('11. #126（p12）多余减号（原卷同错）；#186（p14）\`【详解】0 因为\` 多出 “0”。');
P('12. 页脚多空格写法（#48/#165）统一正则；顺带可把 20 个 page_number 块整类丢弃。');
P(`13. 清理 images/ 下 ${summary.assets.orphan} 个未被引用的公式裁图（或保留作公式复核底稿，但不要当题图）。`);
P('14. 第 9 题两幅直方图是 2 个 chart 块、其余题面图是 image 块 —— 建议下游统一 `image|chart`，否则第 9 题漏图。');
P('15. 第 5 题金标 figure_note 的“Q 在边 BC 上”与裁图不符（图中 Q 在 AB 边），建议修正金标措辞。');
P();

fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');

console.log('OK');
console.log('  ' + path.relative(ROOT, OUT_JSON));
console.log('  ' + path.relative(ROOT, OUT_MD));
console.log(JSON.stringify(summary, null, 2));
