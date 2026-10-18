'use strict';
// 把 MinerU 的真实产物 + 人工金标做逐题比对，生成一份人能看懂的 HTML。
// 用法：node scripts/build-mineru-preview.cjs <解压目录> <金标 json> <输出 html>
// 只读产物、不调任何接口、不改业务代码。

const fs = require('node:fs');
const path = require('node:path');
const Segmenter = require('../qisi-paper-segmenter.js');
const Client = require('../qisi-mineru-client.js').internals;

const unzipDir = path.resolve(process.argv[2] || '');
const goldPath = path.resolve(process.argv[3] || '');
const outPath = path.resolve(process.argv[4] || path.join(unzipDir, '..', 'preview.html'));

const contentListFile = fs.readdirSync(unzipDir).find(name => name.endsWith('_content_list.json') && !name.includes('_v2'));
if (!contentListFile) throw new Error('未找到 content_list.json');

const raw = JSON.parse(fs.readFileSync(path.join(unzipDir, contentListFile), 'utf8'));
const normalized = Client.parseContentList(raw);
const blocks = normalized.pages.flatMap(page => page.blocks);
const answerTable = Client.parseAnswerTable(blocks);
const paper = Segmenter.segmentPaper(blocks);
const { questionSegment, solutionSegment } = paper;
const built = Segmenter.assemble({ ...paper, answerTable });

const gold = fs.existsSync(goldPath) ? JSON.parse(fs.readFileSync(goldPath, 'utf8')) : { questions: [] };
const goldByNo = new Map((gold.questions || []).map(item => [String(item.no), item]));

const rows = built.questions.map(question => {
    const reference = goldByNo.get(question.questionNo) || null;
    const goldAnswer = reference ? String(reference.answer || '') : '';
    const answerMatches = goldAnswer && question.answer ? String(goldAnswer).trim() === String(question.answer).trim() : null;
    const figureOk = reference ? ((reference.has_figure === true) === (question.figureBlocks.length > 0)) : null;
    const stemBlock = question.stemBlocks[0];
    const stemText = stemBlock ? String(built.blocksById[stemBlock].text || '') : '';
    return { question, reference, goldAnswer, answerMatches, figureOk, stemText };
});

const escape = text => String(text == null ? '' : text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const mark = value => value === null ? '<span class="na">—</span>' : value ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>';
const answered = rows.filter(row => row.answerMatches === true).length;
const compared = rows.filter(row => row.answerMatches !== null).length;
const located = rows.filter(row => row.question.solutionBlocks.length > 0).length;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>MinerU 识别结果 · 逐题比对</title>
<style>
:root{--ink:#1a1d24;--ink2:#4a5160;--ink3:#7a8290;--line:#e4e7ee;--ok:#1d7a4c;--bad:#c0392b;--warn:#9a6a00}
*{box-sizing:border-box}
body{margin:0;background:#fbfcfe;color:var(--ink);font-family:"Source Han Sans SC","Microsoft YaHei",system-ui,sans-serif;font-size:14px;line-height:1.7}
.wrap{max-width:1080px;margin:0 auto;padding:36px 24px 60px}
h1{font-size:24px;margin:0 0 6px}
.sub{color:var(--ink3);font-size:13px;margin-bottom:22px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0 26px}
.card{flex:1 1 160px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:14px 16px}
.card b{display:block;font-size:22px;line-height:1.2}
.card span{font-size:12px;color:var(--ink3)}
table{width:100%;border-collapse:collapse;background:#fff;font-size:13px}
th,td{border-bottom:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f5f7fb;font-size:12px;color:var(--ink2)}
.ok{color:var(--ok);font-weight:700}.bad{color:var(--bad);font-weight:700}.na{color:var(--ink3)}
.stem{color:var(--ink2);max-width:520px}
code{background:#f2f4f8;padding:1px 4px;border-radius:3px;font-size:12px}
.issue{color:var(--warn);font-size:12px}
</style></head><body><div class="wrap">
<h1>MinerU 识别结果 · 逐题比对</h1>
<div class="sub">解析产物：${escape(unzipDir)}<br>金标：${escape(goldPath)}</div>
<div class="cards">
  <div class="card"><b>${built.questions.length}</b><span>切出的题数</span></div>
  <div class="card"><b>${answerTable ? Object.keys(answerTable).length : 0}</b><span>答案表条目</span></div>
  <div class="card"><b>${compared ? answered + ' / ' + compared : '—'}</b><span>答案与金标一致</span></div>
  <div class="card"><b>${located} / ${built.questions.length}</b><span>解析已定位</span></div>
</div>
<table>
<thead><tr><th>题号</th><th>金标答案</th><th>识别答案</th><th>答案</th><th>解析</th><th>图块</th><th>有图</th><th>题干开头</th></tr></thead>
<tbody>
${rows.map(row => `<tr>
<td><b>${row.question.questionNo}</b></td>
<td>${escape(row.goldAnswer) || '<span class="na">—</span>'}</td>
<td>${escape(row.question.answer) || '<span class="na">（空）</span>'}</td>
<td>${mark(row.answerMatches)}</td>
<td>${row.question.solutionBlocks.length ? '✓ ' + row.question.solutionBlocks.length + ' 块' : '<span class="bad">未定位</span>'}</td>
<td>${row.question.figureBlocks.length}</td>
<td>${mark(row.figureOk)}</td>
<td class="stem">${escape(row.stemText.slice(0, 90))}</td>
</tr>`).join('')}
</tbody></table>
<h2 style="font-size:17px;margin:28px 0 8px">需要处理的问题</h2>
<ul>
${built.issues.map(issue => `<li class="issue"><code>${escape(issue.code)}</code> ${issue.no ? '第 ' + escape(issue.no) + ' 题' : ''} ${issue.table ? '（表：' + escape(issue.table) + '，解析：' + escape(issue.solution) + '）' : ''}</li>`).join('') || '<li>无</li>'}
${(solutionSegment?.issues || []).map(issue => `<li class="issue">答案区 <code>${escape(issue.code)}</code> ${issue.no ? '第 ' + escape(issue.no) + ' 题' : ''}</li>`).join('')}
</ul>
</div></body></html>`;

fs.writeFileSync(outPath, html);
console.log(JSON.stringify({
    questions: built.questions.length,
    answerTableEntries: answerTable ? Object.keys(answerTable).length : 0,
    answerMatches: compared ? answered + '/' + compared : null,
    solutionsLocated: located + '/' + built.questions.length,
    issues: built.issues.concat((solutionSegment?.issues || [])).map(i => i.code + (i.no ? ':' + i.no : '')),
    out: outPath
}, null, 2));
