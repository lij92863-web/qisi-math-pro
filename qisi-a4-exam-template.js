(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.A4ExamTemplate = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function () {
        'use strict';

        const TEMPLATE_ID = 'teacherA4';
        const PAGE = Object.freeze({
            widthMm: 210,
            heightMm: 297,
            marginLeftMm: 31.75,
            marginRightMm: 31.75,
            marginTopMm: 25.4,
            marginBottomMm: 25.4,
            contentWidthMm: 146.5,
            contentHeightMm: 246.2
        });

        const STRICT_LATEX_TEMPLATE = String.raw`% !TEX program = xelatex
\documentclass[UTF8,a4paper,zihao=5]{ctexart}

% 奇思数学教师常用 A4 试卷模板
% 版式依据：题目与答案目录中的日常作业、晚测和基础训练文件。
\usepackage[
  paperwidth=210mm,
  paperheight=297mm,
  left=31.75mm,
  right=31.75mm,
  top=25.4mm,
  bottom=25.4mm,
  headheight=0pt,
  headsep=0pt,
  footskip=12mm
]{geometry}

\usepackage{amsmath,amssymb,mathtools,bm}
\usepackage{graphicx,wrapfig,float}
\usepackage{enumitem,array,tabularx,booktabs,multirow}
\usepackage{needspace}
\usepackage{fontspec}

\setmainfont{Times New Roman}
\setCJKmainfont{SimSun}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\renewcommand{\baselinestretch}{1.5}
\setlist{nosep,leftmargin=2em}

% 模板引擎插槽：{{EXAM_TITLE}} / {{QUESTIONS}} / {{ANSWERS}}
\newcommand{\QisiExamTitle}{高中数学作业}

\newcommand{\qisititle}[1]{%
  \begin{center}
    {\fontsize{15pt}{22.5pt}\selectfont\bfseries #1}
  \end{center}
  \vspace{1mm}%
}

\newcommand{\qisifields}{%
  \begin{center}
    \textbf{班别}\rule{31mm}{0.4pt}\quad
    \textbf{姓名}\rule{31mm}{0.4pt}\quad
    \textbf{评分}\rule{31mm}{0.4pt}
  \end{center}
  \vspace{2mm}%
}

\newcommand{\qisisection}[1]{%
  \Needspace{4\baselineskip}%
  \par\noindent\bfseries #1\par\normalfont
}

% 只保护题目开头三行；整题保持可跨页，避免形成不可分页的长盒子。
\newcommand{\qisiquestion}[2]{%
  \Needspace{3\baselineskip}%
  \par\noindent
  \hangindent=2em\hangafter=1
  \makebox[2em][l]{#1.}#2\par
}

\newcommand{\qisiblank}[1][24mm]{\rule[-1pt]{#1}{0.4pt}}

\newcommand{\qisifourchoices}[4]{%
  \par\smallskip
  \begin{tabularx}{\linewidth}{@{}>{\raggedright\arraybackslash}X>{\raggedright\arraybackslash}X>{\raggedright\arraybackslash}X>{\raggedright\arraybackslash}X@{}}
    A. #1 & B. #2 & C. #3 & D. #4
  \end{tabularx}\par
}

\newcommand{\qisitwochoices}[4]{%
  \par\smallskip
  \begin{tabularx}{\linewidth}{@{}>{\raggedright\arraybackslash}X>{\raggedright\arraybackslash}X@{}}
    A. #1 & B. #2 \\
    C. #3 & D. #4
  \end{tabularx}\par
}

\newcommand{\qisifigure}[2][0.48\linewidth]{%
  \begin{center}
    \includegraphics[width=#1,height=48mm,keepaspectratio]{#2}
  \end{center}%
}

\begin{document}
\qisititle{\QisiExamTitle}
\qisifields

% {{QUESTIONS}}

% 需要答案卷时由模板引擎在此处插入 \clearpage 后的答案与解析。
% {{ANSWERS}}
\end{document}`;

        const DEFAULT_CONFIG = Object.freeze({
            title: '高中数学作业',
            subtitle: '',
            organizer: '',
            subject: '数学',
            mode: '普通',
            paperType: '学生版',
            paperSize: 'A4',
            fontSize: '五号',
            fontFamily: '宋体',
            themeColor: '#111827',
            showDifficulty: false,
            showSource: false,
            showAnswer: false,
            showSolution: false,
            answerSpace: true,
            showNotice: false,
            showScore: true,
            showQuestionName: false,
            includeAnswerSection: false,
            showHeaderFields: true,
            showAnswerGrid: false,
            answerGridCount: 9,
            answerLineStart: 10,
            answerLineCount: 3,
            showCornerMarks: false,
            compactMode: false,
            showSecretMark: false
        });

        const PRESET_TEMPLATES = Object.freeze({
            [TEMPLATE_ID]: Object.freeze({
                name: '教师常用 A4 模板',
                desc: '复刻日常作业/晚测版式：标准 A4、左右 31.75 mm、上下 25.4 mm、宋体五号、真实跨页。',
                code: STRICT_LATEX_TEMPLATE
            })
        });

        const EXAM_LAYOUT_PRESETS = Object.freeze({
            [TEMPLATE_ID]: Object.freeze({
                name: '教师常用 A4 模板',
                desc: PRESET_TEMPLATES[TEMPLATE_ID].desc,
                config: DEFAULT_CONFIG
            })
        });

        const escapeHtml = (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const normalizeThemeColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ''))
            ? String(value)
            : '#111827';

        const validateStrictLatex = (source) => {
            const latex = String(source || '');
            const required = [
                ['文档类型必须是 UTF8/A4/五号 ctexart', /\\documentclass\[UTF8,a4paper,zihao=5\]\{ctexart\}/],
                ['纸张宽度必须是 210mm', /paperwidth\s*=\s*210mm/],
                ['纸张高度必须是 297mm', /paperheight\s*=\s*297mm/],
                ['左页边距必须是 31.75mm', /left\s*=\s*31\.75mm/],
                ['右页边距必须是 31.75mm', /right\s*=\s*31\.75mm/],
                ['上页边距必须是 25.4mm', /top\s*=\s*25\.4mm/],
                ['下页边距必须是 25.4mm', /bottom\s*=\s*25\.4mm/],
                ['必须使用 Times New Roman', /\\setmainfont\{Times New Roman\}/],
                ['必须使用宋体', /\\setCJKmainfont\{SimSun\}/],
                ['题目必须保留短行数 Needspace 保护', /\\Needspace\{3\\baselineskip\}/],
                ['必须保留 EXAM_TITLE 插槽', /\{\{EXAM_TITLE\}\}/],
                ['必须保留 QUESTIONS 插槽', /\{\{QUESTIONS\}\}/],
                ['必须保留 ANSWERS 插槽', /\{\{ANSWERS\}\}/]
            ];
            const issues = required
                .filter(([, pattern]) => !pattern.test(latex))
                .map(([message]) => message);

            if (/\\begin\{(?:samepage|minipage)\}/.test(latex)) {
                issues.push('整题不能放入 samepage 或 minipage，否则长题无法跨页');
            }

            return { ok: issues.length === 0, issues };
        };

        const buildPrintCss = (config = {}) => {
            const themeColor = normalizeThemeColor(config.themeColor);
            const bodySize = config.fontSize === '小四' ? 12 : 10.5;
            const mathScale = Math.min(1.16, Math.max(1.02, Number(config.mathScale) || 1.08));

            return `
:root {
    --qisi-page-width: ${PAGE.widthMm}mm;
    --qisi-page-height: ${PAGE.heightMm}mm;
    --qisi-page-margin-left: ${PAGE.marginLeftMm}mm;
    --qisi-page-margin-right: ${PAGE.marginRightMm}mm;
    --qisi-page-margin-top: ${PAGE.marginTopMm}mm;
    --qisi-page-margin-bottom: ${PAGE.marginBottomMm}mm;
    --qisi-content-width: ${PAGE.contentWidthMm}mm;
    --qisi-content-height: ${PAGE.contentHeightMm}mm;
    --qisi-math-scale: ${mathScale.toFixed(3)};
    --qisi-option-columns: 4;
}
* { box-sizing: border-box; }
html { margin: 0; min-height: 100%; background: #e5e7eb; }
body {
    margin: 0;
    padding: 0;
    min-height: 100%;
    color: #111;
    background: #e5e7eb;
    font-family: "Times New Roman", "SimSun", "Songti SC", "STSong", serif;
    font-size: ${bodySize}pt;
    line-height: 1.5;
}
.qisi-print-toolbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    min-height: 48px;
    padding: 8px 18px;
    color: #334155;
    background: rgba(248, 250, 252, .96);
    border-bottom: 1px solid #cbd5e1;
    font-family: "Microsoft YaHei", sans-serif;
    font-size: 13px;
}
.qisi-print-toolbar button {
    border: 0;
    border-radius: 6px;
    padding: 8px 15px;
    color: #fff;
    background: #1a73e8;
    font-weight: 700;
    cursor: pointer;
}
.qisi-print-toolbar button:disabled { background: #94a3b8; cursor: wait; }
.qisi-screen-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12mm;
    padding: 12mm 0 18mm;
}
.qisi-paper-page {
    position: relative;
    flex: 0 0 var(--qisi-page-height);
    width: var(--qisi-page-width);
    height: var(--qisi-page-height);
    padding: var(--qisi-page-margin-top) var(--qisi-page-margin-right) var(--qisi-page-margin-bottom) var(--qisi-page-margin-left);
    overflow: hidden;
    background: #fff;
    box-shadow: 0 5px 22px rgba(15, 23, 42, .18);
}
.qisi-paper-page::after {
    content: "第 " attr(data-page) " 页";
    position: absolute;
    right: 13mm;
    bottom: 7mm;
    color: #94a3b8;
    font: 9pt/1.2 "Microsoft YaHei", sans-serif;
}
.qisi-page-content {
    width: var(--qisi-content-width);
    height: var(--qisi-content-height);
    overflow: hidden;
}
.qisi-print-source {
    position: absolute;
    left: -10000px;
    top: 0;
    width: var(--qisi-content-width);
    visibility: hidden;
}
main { width: 100%; margin: 0; padding: 0; }
.header { margin: 0 0 4mm; padding: 0; text-align: center; }
.title { margin: 0 0 1mm; font-size: 15pt; line-height: 1.5; font-weight: 700; }
.subtitle, .organizer { margin-top: 1mm; font-size: 10.5pt; color: #222; }
.student-fields { display: flex; justify-content: center; gap: 8mm; margin: 1mm 0 2mm; font-weight: 700; }
.student-fields span { display: inline-flex; align-items: flex-end; gap: 1.5mm; white-space: nowrap; }
.student-fields i { display: inline-block; width: 27mm; border-bottom: .4pt solid #111; transform: translateY(-1.5px); }
.notice { margin: 2mm 0 0; padding: 0; border: 0; text-align: left; font-size: 10.5pt; }
.group-title {
    margin: 3mm 0 1.5mm;
    padding: 0;
    border: 0;
    font-size: 10.5pt;
    line-height: 1.5;
    font-weight: 700;
    break-after: avoid-page;
    page-break-after: avoid;
}
.exam-question {
    display: flow-root;
    margin: 0 0 4mm;
    overflow: visible;
    break-inside: auto;
    page-break-inside: auto;
}
.question-row { position: relative; display: block; padding-left: 2em; }
.q-index { position: absolute; left: 0; top: 0; width: 2em; font-weight: 400; line-height: 1.5; }
.question-flow-body { display: block; min-width: 0; line-break: strict; overflow: visible; }
.question-flow-body::after, .exam-question::after { content: ""; display: block; clear: both; }
.gaokao-options {
    display: grid;
    grid-template-columns: repeat(var(--qisi-option-columns, 4), minmax(0, 1fr));
    gap: 1.5mm 4mm;
    width: 100%;
    margin: 1.5mm 0 0;
    padding: 0;
}
.gaokao-options.long-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.gaokao-option { display: flex; align-items: flex-start; min-width: 0; break-inside: avoid; page-break-inside: avoid; }
.option-label { flex: 0 0 1.8em; font-weight: 400; }
.option-content { flex: 1; min-width: 0; overflow-wrap: normal; word-break: normal; }
.option-content .katex, .katex { font-size: calc(1em * var(--qisi-math-scale)); white-space: nowrap; }
.katex-display { margin: .35em 0; overflow: visible; }
.answer-grid-wrap { margin: 2mm 0 4mm; }
.answer-grid { margin: 0 auto; border-collapse: collapse; font-weight: 700; }
.answer-grid th, .answer-grid td { min-width: 11mm; height: 7mm; padding: 0 1mm; border: .4pt solid #111; text-align: center; }
.answer-lines { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; width: 88%; margin: 2mm auto 0; font-weight: 700; }
.answer-lines span { display: flex; align-items: flex-end; gap: 1.5mm; }
.answer-lines i { flex: 1; border-bottom: .4pt solid #111; transform: translateY(-1.5px); }
.answer-section.new-page { break-before: page; page-break-before: always; }
.answer-section h2 { margin: 0 0 4mm; text-align: center; font-size: 15pt; break-after: avoid-page; }
.answer-item { margin: 0 0 3mm; break-inside: auto; page-break-inside: auto; }
.answer-solution { margin-top: 1mm; color: #222; }
.q-note { margin-top: 1.5mm; padding-left: 2mm; border-left: 2px solid ${themeColor}; font-size: 9pt; color: #444; }
.print-answer, .print-solution { margin-top: 1.5mm; }
.answer-blank, .nowrap { display: inline-block; white-space: nowrap; break-inside: avoid; }
.answer-blank { min-width: 2.4em; text-align: center; }
.print-image { max-width: 82mm; max-height: 48mm; width: auto; height: auto; object-fit: contain; break-inside: avoid; page-break-inside: avoid; }
.print-image.centered { display: block; margin: 2mm auto 2.5mm; }
.print-image.float-left { float: left; margin: 1mm 3mm 2mm 0; }
.print-image.float-right { float: right; margin: 1mm 0 2mm 3mm; }
.qisi-image-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3mm;
    width: 100%;
    margin: 2mm 0 2.5mm;
    clear: both;
    break-inside: avoid;
    page-break-inside: avoid;
}
.qisi-image-row-item { flex: 0 1 calc(var(--qisi-source-width, .46) * 100%); min-width: 0; }
.qisi-image-row .print-image { display: block; width: 100%; max-width: 100%; height: auto; margin: 0 auto; }
.qisi-media-before { display: block; margin-bottom: 1.5mm; }
.qisi-media-text {
    display: grid;
    grid-template-columns: minmax(0, calc(var(--qisi-media-width, .42) * 100%)) minmax(0, 1fr);
    align-items: center;
    gap: 3mm;
    width: 100%;
    margin: 2mm 0 2.5mm;
    clear: both;
    break-inside: avoid;
    page-break-inside: avoid;
}
.qisi-media-figure, .qisi-media-copy { display: block; min-width: 0; }
.qisi-media-figure .print-image { display: block; width: 100%; max-width: 100%; height: auto; margin: 0; }
.qisi-latex-table-wrap { display: block; max-width: 100%; margin: 2.5mm auto; overflow: visible; break-inside: avoid; page-break-inside: avoid; }
.qisi-latex-table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; font-size: 0.96em; line-height: 1.5; }
.qisi-latex-table td { box-sizing: border-box; border: 0.25mm solid #111827; padding: 1.2mm 1.8mm; overflow-wrap: anywhere; }
.qisi-latex-table .katex { font-size: calc(1em * var(--qisi-math-scale)); }
.missing-image, .latex-render-error { color: #b91c1c; font-size: 9pt; }
.secret-mark, .corner-marks { display: none; }

@page {
    size: ${PAGE.widthMm}mm ${PAGE.heightMm}mm;
    margin: ${PAGE.marginTopMm}mm ${PAGE.marginRightMm}mm ${PAGE.marginBottomMm}mm ${PAGE.marginLeftMm}mm;
}
@media print {
    html, body {
        width: auto !important;
        min-width: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: #fff !important;
    }
    .qisi-print-toolbar, .qisi-screen-preview { display: none !important; }
    .qisi-print-source {
        position: static !important;
        left: auto !important;
        top: auto !important;
        display: block !important;
        width: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        visibility: visible !important;
    }
}`;
        };

        const screenPaginationScript = () => String.raw`
(function () {
    const source = document.getElementById('qisiPrintSource');
    const preview = document.getElementById('qisiScreenPreview');
    const status = document.getElementById('qisiPageStatus');
    const button = document.getElementById('printBtn');

    const waitForAssets = async () => {
        const images = Array.from(source ? source.querySelectorAll('img') : []);
        await Promise.all(images.map((image) => image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true });
                image.addEventListener('error', resolve, { once: true });
            })));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
    };

    const collectBlocks = () => {
        const blocks = [];
        Array.from(source.children).forEach((container) => {
            const forceNewPage = container.classList.contains('new-page');
            const children = (container.matches('main') || container.classList.contains('answer-section'))
                ? Array.from(container.children)
                : [container];
            children.forEach((child, index) => blocks.push({
                node: child,
                forceNewPage: forceNewPage && index === 0
            }));
        });
        return blocks;
    };

    const minimumReadableScale = 0.72;
    const fitQuestionImages = (node, pageContent) => {
        if (!node || !pageContent || pageContent.scrollHeight <= pageContent.clientHeight + 1) return false;
        const images = Array.from(node.querySelectorAll('.print-image')).filter(image => {
            const rect = image.getBoundingClientRect();
            return rect.width > 24 && rect.height > 24;
        });
        if (!images.length) return false;

        const measurements = images.map(image => ({ image, rect: image.getBoundingClientRect() }));
        const totalImageHeight = measurements.reduce((sum, item) => sum + item.rect.height, 0);
        const excess = pageContent.scrollHeight - pageContent.clientHeight + 2;
        if (totalImageHeight <= 0 || excess <= 0) return false;
        const requiredScale = (totalImageHeight - excess) / totalImageHeight;
        if (requiredScale < minimumReadableScale || requiredScale >= 1) return false;

        measurements.forEach(({ image, rect }) => {
            image.style.maxWidth = Math.max(24, rect.width * requiredScale) + 'px';
            image.style.maxHeight = Math.max(24, rect.height * requiredScale) + 'px';
            image.style.width = 'auto';
            image.style.height = 'auto';
            image.dataset.qisiFitScale = requiredScale.toFixed(3);
        });
        node.dataset.qisiImagesCompressed = requiredScale.toFixed(3);
        return pageContent.scrollHeight <= pageContent.clientHeight + 1;
    };

    const paginate = () => {
        preview.replaceChildren();
        let page = null;
        let content = null;

        const newPage = () => {
            page = document.createElement('section');
            page.className = 'qisi-paper-page';
            page.dataset.page = String(preview.children.length + 1);
            content = document.createElement('div');
            content.className = 'qisi-page-content';
            page.appendChild(content);
            preview.appendChild(page);
        };

        const blocks = collectBlocks();
        newPage();

        blocks.forEach((entry, index) => {
            if (entry.forceNewPage && content.children.length) newPage();

            const clone = entry.node.cloneNode(true);
            content.appendChild(clone);
            fitQuestionImages(clone, content);

            const nextEntry = blocks[index + 1];
            const shouldProbeNext = clone.classList.contains('group-title') && nextEntry;
            let probe = null;
            if (shouldProbeNext) {
                probe = nextEntry.node.cloneNode(true);
                probe.querySelectorAll('.gaokao-options, .qisi-image-row, .qisi-media-text, .print-image, .q-note, .print-answer, .print-solution').forEach(node => node.remove());
                probe.style.maxHeight = '4.5em';
                probe.style.overflow = 'hidden';
                content.appendChild(probe);
            }

            const overflowed = content.scrollHeight > content.clientHeight + 1;
            if (probe) probe.remove();

            if (overflowed && content.children.length > 1) {
                clone.remove();
                newPage();
                content.appendChild(clone);
            }

            if (content.scrollHeight > content.clientHeight + 1) {
                page.dataset.longBlock = 'true';
                page.title = '此题或解析超过单页，实际打印时将按正文自然跨页。';
            }
        });

        const count = preview.children.length;
        status.textContent = count + ' 页 · A4 210 × 297 mm';
        document.documentElement.dataset.qisiPreviewPages = String(count);
        document.documentElement.dataset.qisiPreviewReady = 'true';
        button.disabled = false;
        button.textContent = '打印 / 另存为 PDF';
    };

    waitForAssets().then(paginate).catch((error) => {
        status.textContent = '分页预览失败：' + (error && error.message ? error.message : error);
        document.documentElement.dataset.qisiPreviewReady = 'error';
        button.disabled = false;
        button.textContent = '直接打印';
    });
})();`;

        const buildPrintDocument = ({
            content = '',
            title = '试卷打印',
            config = {},
            katexCssHref = 'https://unpkg.com/katex@0.16.8/dist/katex.min.css'
        } = {}) => {
            const katexLink = katexCssHref
                ? `<link rel="stylesheet" href="${escapeHtml(katexCssHref)}">`
                : '';

            return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${katexLink}
<style>${buildPrintCss(config)}</style>
</head>
<body>
<div class="qisi-print-toolbar">
    <span id="qisiPageStatus">正在按 A4 分页…</span>
    <button id="printBtn" type="button" onclick="window.print()" disabled>正在准备图片和公式…</button>
</div>
<div id="qisiScreenPreview" class="qisi-screen-preview" aria-label="A4 打印分页预览"></div>
<div id="qisiPrintSource" class="qisi-print-source">${content}</div>
<script>${screenPaginationScript()}</script>
</body>
</html>`;
        };

        return {
            TEMPLATE_ID,
            DEFAULT_PRESET_KEY: TEMPLATE_ID,
            PAGE,
            STRICT_LATEX_TEMPLATE,
            DEFAULT_TEMPLATE: STRICT_LATEX_TEMPLATE,
            DEFAULT_CONFIG,
            PRESET_TEMPLATES,
            EXAM_LAYOUT_PRESETS,
            validateStrictLatex,
            buildPrintCss,
            buildPrintDocument
        };
    }
);
