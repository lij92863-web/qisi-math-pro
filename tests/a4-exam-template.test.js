const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const template = require('../qisi-a4-exam-template');

const ROOT = path.join(__dirname, '..');

test('teacher A4 preset is the only exposed built-in template', () => {
    assert.deepEqual(Object.keys(template.PRESET_TEMPLATES), ['teacherA4']);
    assert.deepEqual(Object.keys(template.EXAM_LAYOUT_PRESETS), ['teacherA4']);
    assert.equal(template.DEFAULT_PRESET_KEY, 'teacherA4');

    const configSource = fs.readFileSync(path.join(ROOT, 'qisi-config.js'), 'utf8');
    const appSource = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');

    for (const legacy of ['quizSheet', 'examZh', '测验模板', '高考模板']) {
        assert.equal(configSource.includes(legacy), false, `qisi-config.js no longer exposes ${legacy}`);
        assert.equal(appSource.includes(legacy), false, `app.js no longer branches on ${legacy}`);
        assert.equal(htmlSource.includes(legacy), false, `main.html no longer displays ${legacy}`);
    }

    assert.ok(htmlSource.includes('qisi-a4-exam-template.js?v=a4-teacher-template-r1'));
    assert.ok(htmlSource.indexOf('qisi-a4-exam-template.js') < htmlSource.indexOf('qisi-config.js'));
    assert.equal(htmlSource.includes('新建模板'), false);
});

test('strict LaTeX source matches the retained teacher documents', () => {
    const latex = template.STRICT_LATEX_TEMPLATE;

    assert.match(latex, /\\documentclass\[UTF8,a4paper,zihao=5\]\{ctexart\}/);
    assert.match(latex, /paperwidth=210mm/);
    assert.match(latex, /paperheight=297mm/);
    assert.match(latex, /left=31\.75mm/);
    assert.match(latex, /right=31\.75mm/);
    assert.match(latex, /top=25\.4mm/);
    assert.match(latex, /bottom=25\.4mm/);
    assert.match(latex, /\\setmainfont\{Times New Roman\}/);
    assert.match(latex, /\\setCJKmainfont\{SimSun\}/);
    assert.match(latex, /\\renewcommand\{\\baselinestretch\}\{1\.5\}/);

    for (const packageName of ['amsmath', 'amssymb', 'mathtools', 'bm', 'graphicx', 'wrapfig', 'enumitem', 'array', 'tabularx', 'booktabs', 'needspace']) {
        assert.ok(latex.includes(packageName), `required package ${packageName}`);
    }

    assert.match(latex, /\\Needspace\{3\\baselineskip\}/);
    assert.equal(/\\begin\{(?:samepage|minipage)\}/.test(latex), false);
    assert.ok(latex.includes('{{EXAM_TITLE}}'));
    assert.ok(latex.includes('{{QUESTIONS}}'));
    assert.ok(latex.includes('{{ANSWERS}}'));
    assert.deepEqual(template.validateStrictLatex(latex), { ok: true, issues: [] });

    const invalid = template.validateStrictLatex(latex
        .replace('left=31.75mm', 'left=20mm')
        .replace('\\Needspace{3\\baselineskip}', '\\begin{samepage}'));
    assert.equal(invalid.ok, false);
    assert.ok(invalid.issues.some(issue => issue.includes('左页边距')));
    assert.ok(invalid.issues.some(issue => issue.includes('Needspace')));
    assert.ok(invalid.issues.some(issue => issue.includes('samepage')));
});

test('print CSS uses exact A4 geometry and permits question fragmentation', () => {
    const css = template.buildPrintCss();

    assert.match(css, /size:\s*210mm 297mm/);
    assert.match(css, /margin:\s*25\.4mm 31\.75mm 25\.4mm 31\.75mm/);
    assert.match(css, /\.qisi-paper-page\s*\{[\s\S]*width:\s*var\(--qisi-page-width\)[\s\S]*height:\s*var\(--qisi-page-height\)/);
    assert.match(css, /\.exam-question\s*\{[\s\S]*break-inside:\s*auto/);
    assert.match(css, /@media print\s*\{[\s\S]*padding:\s*0 !important/);
    assert.equal(css.includes('height: 100vh'), false);
    assert.match(css, /--qisi-math-scale:/);
    assert.match(css, /qisi-image-row/);
    assert.match(css, /--qisi-option-columns/);
});

test('print body, option numerals, and KaTeX roots stay regular under bold source ancestry', { timeout: 30_000 }, async () => {
    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage();
        const content = `
            <main>
                <div class="exam-question">
                    <div class="question-row">
                        <span class="q-index">1.</span>
                        <div class="question-flow-body"><strong>题干 <span class="katex">90</span></strong></div>
                    </div>
                    <div class="gaokao-options">
                        <div class="gaokao-option">
                            <span class="option-label">A.</span>
                            <span class="option-content"><strong><span class="katex">292π</span></strong></span>
                        </div>
                    </div>
                </div>
            </main>`;
        await page.setContent(template.buildPrintDocument({ content, katexCssHref: '' }));

        const result = await page.evaluate(() => {
            const styleOf = selector => getComputedStyle(document.querySelector(selector));
            return {
                bodyWeight: styleOf('body').fontWeight,
                bodySynthesis: styleOf('body').fontSynthesis,
                questionWeight: styleOf('.question-flow-body').fontWeight,
                optionLabelWeight: styleOf('.option-label').fontWeight,
                formulaWeight: styleOf('.question-flow-body .katex').fontWeight,
                optionFormulaWeight: styleOf('.option-content .katex').fontWeight,
                formulaSynthesis: styleOf('.option-content .katex').fontSynthesis
            };
        });

        assert.deepEqual(result, {
            bodyWeight: '400',
            bodySynthesis: 'none',
            questionWeight: '400',
            optionLabelWeight: '400',
            formulaWeight: '400',
            optionFormulaWeight: '400',
            formulaSynthesis: 'none'
        });
    } finally {
        await browser.close();
    }
});

test('screen pagination applies adaptive image fitting before moving a whole question', () => {
    const html = template.buildPrintDocument({ content: '<main></main>', katexCssHref: '' });
    const fitIndex = html.indexOf('fitQuestionImages');
    const overflowIndex = html.indexOf('const overflowed =');
    assert.ok(fitIndex >= 0, 'adaptive image fitter is missing');
    assert.ok(overflowIndex > fitIndex, 'overflow is decided before adaptive image fitting');
    assert.match(html, /minimumReadableScale/);
});

test('browser preview creates discrete A4 sheets and PDF spans physical A4 pages', { timeout: 60_000 }, async () => {
    const questions = Array.from({ length: 48 }, (_, index) => `
        <div class="exam-question">
            <div class="question-row">
                <span class="q-index">${index + 1}.</span>
                <div class="question-flow-body">
                    已知函数 f(x)=x²+${index + 1}，求其在给定区间上的最值，并写出完整推理过程。本题用于验证标准 A4 页面会自然分页，而不是形成一张无限长页面。
                    <div class="gaokao-options">
                        <div class="gaokao-option"><span class="option-label">A.</span><span class="option-content">选项一</span></div>
                        <div class="gaokao-option"><span class="option-label">B.</span><span class="option-content">选项二</span></div>
                        <div class="gaokao-option"><span class="option-label">C.</span><span class="option-content">选项三</span></div>
                        <div class="gaokao-option"><span class="option-label">D.</span><span class="option-content">选项四</span></div>
                    </div>
                </div>
            </div>
        </div>`).join('');
    const content = `<main><div class="header"><div class="title">高中数学作业</div><div class="student-fields"><span>班别<i></i></span><span>姓名<i></i></span><span>评分<i></i></span></div></div><div class="group-title">一、单选题（共 48 题）</div>${questions}</main>`;
    const html = template.buildPrintDocument({ content, title: 'A4 分页验收', katexCssHref: '' });

    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        await page.setContent(html, { waitUntil: 'load' });
        await page.waitForFunction(() => document.documentElement.dataset.qisiPreviewReady === 'true');

        const preview = await page.evaluate(() => {
            const pages = [...document.querySelectorAll('.qisi-paper-page')];
            const first = pages[0].getBoundingClientRect();
            return {
                count: pages.length,
                width: first.width,
                height: first.height,
                longBlockCount: pages.filter(item => item.dataset.longBlock === 'true').length,
                status: document.getElementById('qisiPageStatus').textContent
            };
        });

        assert.ok(preview.count > 1, `screen preview page count: ${preview.count}`);
        assert.ok(Math.abs(preview.width - 793.7) < 1.5, `A4 screen width: ${preview.width}`);
        assert.ok(Math.abs(preview.height - 1122.5) < 1.5, `A4 screen height: ${preview.height}`);
        assert.equal(preview.longBlockCount, 0);
        assert.match(preview.status, /^\d+ 页 · A4 210 × 297 mm$/);

        await page.emulateMedia({ media: 'print' });
        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        const source = pdf.toString('latin1');
        const pageObjects = source.match(/\/Type\s*\/Page\b/g) || [];
        assert.ok(pageObjects.length > 1, `physical PDF page count: ${pageObjects.length}`);

        const mediaBox = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(source);
        assert.ok(mediaBox, 'PDF contains a MediaBox');
        const widthPt = Number(mediaBox[3]) - Number(mediaBox[1]);
        const heightPt = Number(mediaBox[4]) - Number(mediaBox[2]);
        assert.ok(widthPt > 594 && widthPt < 597, `A4 PDF width: ${widthPt}`);
        assert.ok(heightPt > 840 && heightPt < 843, `A4 PDF height: ${heightPt}`);
    } finally {
        await browser.close();
    }
});
