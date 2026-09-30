const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePdfSupportBlocks: parse } = require('../qisi-pdf-ocr-support-parser.js');
const Aligner = require('../qisi-pdf-support-aligner.js');
const plain = (q, answer = 'A') => q + '. ' + answer + '\n【解析】推导结果 $x=' + q + '$。';
const result = (text, expected = [1, 2, 3]) => parse({
    rawTextPages: [{ pageIndex: 9, sourceOrder: 9, text }],
    expectedQuestionNumbers: expected, sourceFileId: 'support-fixture'
});
const questions = items => items.map(item => item.question);
const table = String.raw`\begin{tabular}{|c|c|c|c|}
\hline
题号 & 1 & 2 & 3 & \\
\hline
答案 & A & C & BD & \\
\hline
\end{tabular}`;

test('numbered answers are fields with original source spans and pass the existing gate', () => {
    const parsed = result([plain(1), plain(2, 'C'), plain(3, 'BD')].join('\n'));
    assert.deepEqual(parsed.answerItems.map(item => item.answer), ['A', 'C', 'BD']);
    assert.deepEqual(questions(parsed.solutionItems), ['1', '2', '3']);
    assert.equal(parsed.answerItems[1].sourceTrace.sectionStartLine, 2);
    assert.ok(parsed.solutionItems[1].sourceTrace.rawBlockExcerpt.includes('2. C'));
    assert.deepEqual(parsed.warnings, []);
    assert.equal(Aligner.alignPdfSupport({ ...parsed, expectedQuestionNumbers: [1, 2, 3] }).mode, 'full');
});

test('TeX table cells corroborate matching root enumeration without nested item confusion', () => {
    const input = table + String.raw`
\begin{enumerate}
\item A
\begin{itemize}
\item【分析】先化简。
\item【详解】$x=1$。
\end{itemize}
\item C
\begin{itemize}
\item【详解】$x=2$。
\end{itemize}
\item BD
\begin{itemize}
\item【详解】$x=3$。
\end{itemize}
\end{enumerate}
答案第1页，共4页`;
    const parsed = result(input);
    assert.deepEqual(parsed.answerItems.map(item => item.answer), ['A', 'C', 'BD']);
    assert.deepEqual(questions(parsed.solutionItems), ['1', '2', '3']);
    assert.deepEqual(parsed.answerItems[2].sourceTrace.tableCell, { row: 1, column: 3 });
    assert.ok(parsed.answerItems[2].sourceTrace.rawBlockExcerpt.includes('题号 & 1'));
    assert.ok(parsed.answerItems[2].corroboratingSourceTrace);
    assert.equal(parsed.solutionItems.some(item => item.solution.includes('共4页')), false);
    assert.deepEqual(parsed.warnings, []);
});

test('Markdown and array tables retain explicit numbers and formula shells', () => {
    for (const input of [
        '| 题号 | 1 | 2 | 3 |\n| --- | --- | --- | --- |\n| 答案 | $A$ | C | BD |',
        String.raw`\begin{array}{ccc}题号 & 1 & 2 & 3 \\ 答案 & $A$ & C & BD \end{array}`
    ]) assert.deepEqual(result(input).answerItems.map(item => item.answer), ['$A$', 'C', 'BD']);
});

test('fill-in numbered math answers preserve exponents and fractions', () => {
    const input = String.raw`\begin{enumerate}
\item[12.] $\frac{x^2}{a^2}-\frac{y^2}{b^2}=1$
\end{enumerate}
\textbf{【分析】}由渐近线求解。
\textbf{【详解】}代入条件即可。
\begin{enumerate}
\item[13.] $n^2+n$
\end{enumerate}
【详解】数列求和。
\begin{enumerate}
\item[14.] $3\sqrt{2}$
\end{enumerate}`;
    const parsed = result(input, [12, 13, 14]);
    assert.deepEqual(questions(parsed.answerItems), ['12', '13', '14']);
    assert.equal(parsed.answerItems[0].answer, String.raw`$\frac{x^2}{a^2}-\frac{y^2}{b^2}=1$`);
    assert.deepEqual(questions(parsed.solutionItems), ['12', '13']);
});

test('formula numbers, subparts and nested itemize cannot create top-level anchors', () => {
    const input = String.raw`1. A
【详解】推导：
$$
2. x=3
$$
\begin{aligned}
3. y=2
\end{aligned}
(2) 继续推导。
\begin{itemize}
\item[3.] $z=1$
\end{itemize}
2. C
【解析】第二题。
3. BD
【解析】第三题。`;
    const parsed = result(input);
    assert.deepEqual(parsed.blocks.map(block => block.question), ['1', '2', '3']);
    assert.ok(parsed.solutionItems[0].solution.includes('2. x=3'));
    assert.ok(parsed.solutionItems[0].solution.includes('(2)'));
});

test('solution continuation requires adjacent physical pages', () => {
    const pages = [
        { pageIndex: 9, sourceOrder: 9, text: '1. A\n【解析】第一行' },
        { pageIndex: 10, sourceOrder: 10, text: '第二行\n2. C\n【解析】完成' }
    ];
    const parsed = parse({ rawTextPages: pages, expectedQuestionNumbers: [1, 2] });
    assert.equal(parsed.solutionItems[0].solution, '第一行\n第二行');
    assert.equal(parsed.solutionItems[0].sourceTrace.pageEnd, 10);
    pages[1].pageIndex = 11;
    assert.equal(parse({ rawTextPages: pages, expectedQuestionNumbers: [1, 2] }).solutionItems.length, 0);
});

test('malformed tables cannot manufacture answer or formula-number evidence', () => {
    for (const attack of [
        table.replace('答案 & A & C & BD &', '答案 & A & C &'),
        table.replace('题号 & 1 & 2 & 3', '题号 & 1 & 1 & 3'),
        table.replace('题号 & 1 & 2 & 3', '题号 & 1 & 3 & 2'),
        table.replace('题号 & 1 & 2 & 3', '题号 & 1 & 2 & 9'),
        table.replace('答案 & A & C & BD', '答案 & A & & BD'),
        table.replace(String.raw`\end{tabular}`, '')
    ]) {
        const parsed = result(attack + '\n' + plain(1));
        assert.equal(parsed.answerItems.length, 0);
        assert.equal(parsed.solutionItems.length, 0);
        assert.ok(parsed.warnings.length);
    }
});

test('unknown and missing anchors do not attach the unproven suffix', () => {
    for (const suffix of [plain(3), plain(9)]) {
        const parsed = result(plain(1) + '\n' + suffix + '\n' + plain(2) + '\n' + plain(3));
        assert.ok(parsed.warnings.length);
        assert.equal(parsed.answerItems.some(item => item.question !== '1'), false);
    }
});

test('table versus numbered-answer conflict withholds the conflicting suffix', () => {
    const parsed = result(table + '\n' + plain(1) + '\n' + plain(2, 'D') + '\n' + plain(3, 'BD'));
    assert.deepEqual(questions(parsed.answerItems), ['1']);
    assert.deepEqual(questions(parsed.solutionItems), ['1']);
    assert.ok(parsed.warnings.some(w => w.code === 'ocr-answer-evidence-conflict'));
});

test('uncorroborated implicit enumeration and ambiguous numbered prose stay closed', () => {
    const parsed = result(String.raw`\begin{enumerate}
\item A
【详解】解释。
\end{enumerate}`);
    assert.equal(parsed.answerItems.length, 0);
    assert.ok(parsed.warnings.some(w => w.code === 'ocr-enumeration-unverified'));
    const ambiguous = result(plain(1) + '\n2. x+1\n3. BD\n【解析】第三题。');
    assert.deepEqual(questions(ambiguous.answerItems), ['1']);
});

test('invalid authority and unmatched math cannot produce complete support', () => {
    for (const expected of [[1, 1, 2], [1, 3], ['(1)(2)', 2], []]) {
        assert.equal(result(plain(1), expected).answerItems.length, 0);
    }
    const parsed = result(plain(1) + '\n2. C\n【解析】$x=2\n3. BD\n【解析】未闭合');
    assert.ok(parsed.warnings.some(w => w.code === 'ocr-support-math-unbalanced'));
    assert.deepEqual(questions(parsed.answerItems), ['1']);
});

test('multi-part answer and probability table stay in one top-level question', () => {
    const input = String.raw`16. (1) $\frac{1}{3}$
(2) 分布列：
| $X$ | $1$ | $2$ |
| --- | --- | --- |
| $P$ | $\frac12$ | $\frac12$ |
【分析】分别计算。
【详解】(1) 条件概率。(2) 计算期望。`;
    const parsed = result(input, [16]);
    assert.equal(parsed.answerItems.length, 1);
    assert.ok(parsed.answerItems[0].answer.includes('| $X$ |'));
    assert.equal(parsed.solutionItems.length, 1);
});

test('generated duplicate attacks never admit the duplicate or later fields', () => {
    for (let bad = 1; bad <= 30; bad += 1) {
        const expected = Array.from({ length: 30 }, (_, i) => i + 1);
        const prefix = expected.slice(0, bad).map(q => plain(q));
        const parsed = result([...prefix, plain(bad), ...expected.slice(bad).map(q => plain(q))].join('\n'), expected);
        assert.equal(parsed.answerItems.length, bad - 1);
        assert.equal(parsed.solutionItems.length, bad - 1);
    }
});

test('nested enumeration numbers and late malformed math cannot wash earlier unsafe evidence', () => {
    const nested = result(String.raw`1. A
【详解】分步骤：
\begin{enumerate}
\begin{enumerate}
\item[2.] $x=1$
\end{enumerate}
\end{enumerate}
2. C
【详解】第二题。
3. BD
【详解】第三题。`);
    assert.deepEqual(nested.blocks.map(block => block.question), ['1', '2', '3']);
    const broken = result('1. A\n【详解】$x=1$$\n2. C\n【详解】第二题。\n3. BD\n【详解】第三题。');
    assert.equal(broken.answerItems.length, 0);
    assert.ok(broken.warnings.some(w => w.code === 'ocr-support-math-unbalanced'));
});
