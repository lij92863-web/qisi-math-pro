const MAIN_PATH = '/main.typ';

const appendMappedBlock = (state, descriptor, bodyLines) => {
    const startLine = state.lines.length + 1;
    state.lines.push(`// TEX-H1-BLOCK ${descriptor.blockId}`);
    state.lines.push(...bodyLines);
    const endLine = state.lines.length;
    state.lines.push('');
    state.lineMap.push(Object.freeze({
        path: MAIN_PATH,
        blockId: descriptor.blockId,
        formulaId: descriptor.formulaId || null,
        startLine,
        endLine
    }));
};

const documentPrelude = () => [
    '#import "/mitex/lib.typ": mi, mitex',
    '',
    '#set page(',
    '  paper: "a4",',
    '  margin: (x: 20mm, top: 20mm, bottom: 18mm),',
    '  header: context align(right, text(size: 8.5pt, fill: rgb("#64748b"))[TEX题库 · H1 浏览器排版验证]),',
    '  footer: context align(center, text(size: 8.5pt, fill: rgb("#64748b"))[第 #counter(page).display() 页]),',
    ')',
    '#set text(font: ("New Computer Modern", "Noto Serif CJK SC"), size: 10.5pt, lang: "zh")',
    '#set par(justify: true, leading: 0.82em)',
    '#set heading(numbering: "1.")',
    ''
];

export function buildProofDocument({ invalidFormula = false } = {}) {
    const state = {
        lines: documentPrelude(),
        lineMap: []
    };

    appendMappedBlock(state, { blockId: 'title' }, [
        '#align(center)[',
        '  #text(size: 19pt, fill: rgb("#0f172a"))[TEX题库讲义排版验证]',
        '  #v(4pt)',
        '  #text(size: 9pt, fill: rgb("#475569"))[浏览器 Typst + MiTeX · 固定本地资源]',
        ']'
    ]);

    appendMappedBlock(state, { blockId: 'intro' }, [
        '= 中文与行内公式',
        '本页验证简体中文、固定字体、A4 页边距和页眉页脚。行内 LaTeX 公式为',
        '#mi(`\\frac{\\sqrt{3}+1}{2}`)，并验证向量 #mi(`\\overrightarrow{AB}`) 与集合 #mi(`A\\cup B`)。'
    ]);

    appendMappedBlock(state, {
        blockId: 'piecewise',
        formulaId: invalidFormula ? 'formula-bad' : 'formula-piecewise'
    }, invalidFormula ? [
        '== 故意失败的公式',
        '#(mitex(`x^2`) + formula-bad-symbol)'
    ] : [
        '== 分段函数',
        '#mitex(`\\begin{cases} x^2+1, & x\\ge 0 \\\\ 1-x, & x<0 \\end{cases}`)'
    ]);

    appendMappedBlock(state, {
        blockId: 'matrix',
        formulaId: 'formula-matrix'
    }, [
        '== 矩阵',
        '#mitex(`A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix},\\quad \\det A=-2`)'
    ]);

    appendMappedBlock(state, { blockId: 'diagram' }, [
        '== 本地图片',
        '#figure(',
        '  image("/assets/coordinate-system.svg", width: 58%),',
        '  caption: [本地 SVG 坐标示意图],',
        ')'
    ]);

    appendMappedBlock(state, { blockId: 'page-break' }, [
        '#pagebreak()'
    ]);

    appendMappedBlock(state, { blockId: 'second-page' }, [
        '= 第二页与长文档',
        '第二页用于证明分页、页码递增和页眉重复。所有编译都在 Web Worker 中执行，主线程只负责状态和 PDF 预览。',
        '',
        '#table(',
        '  columns: (1fr, 1fr, 1fr),',
        '  inset: 7pt,',
        '  stroke: rgb("#cbd5e1"),',
        '  [验证项], [输入], [预期],',
        '  [中文], [固定字体], [无缺字],',
        '  [公式], [MiTeX], [行内与行间均可读],',
        '  [导出], [同一 PDF 字节], [预览与下载一致],',
        ')',
        '',
        '#v(10pt)',
        '#rect(',
        '  width: 100%,',
        '  inset: 10pt,',
        '  radius: 4pt,',
        '  fill: rgb("#eff6ff"),',
        '  stroke: rgb("#bfdbfe"),',
        ')[',
        '  #text(fill: rgb("#1e3a8a"))[若公式、字体、图片或虚拟文件缺失，编译必须失败并显示内容块与公式编号；不得沿用旧 PDF。]',
        ']'
    ]);

    return Object.freeze({
        mainFilePath: MAIN_PATH,
        source: `${state.lines.join('\n')}\n`,
        lineMap: Object.freeze(state.lineMap),
        expected: Object.freeze({
            minimumPages: 2,
            textTokens: Object.freeze([
                'TEX题库讲义排版验证',
                '浏览器 Typst',
                '中文与行内公式',
                '第二页与长文档',
                '本地 SVG 坐标示意图'
            ])
        })
    });
}
