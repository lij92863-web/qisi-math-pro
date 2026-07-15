const test = require('node:test');
const assert = require('node:assert/strict');

const integrity = require('../qisi-pdf-content-integrity.js');

test('bare LaTeX in Chinese prose becomes deterministic rich runs', () => {
    const result = integrity.normalizeMathContent(
        '故\\triangle ABC的面积S=\\frac{1}{2}bc\\sin A，\\therefore A\\in (\\frac{\\pi}{4},\\pi)'
    );

    assert.equal(result.rawLatexOutsideMathBlocks, 0);
    assert.match(result.value, /\$\\triangle ABC\$/);
    assert.match(result.value, /\$S=\\frac\{1\}\{2\}bc\\sin A\$/);
    assert.match(result.value, /\$\\therefore A\\in \(\\frac\{\\pi\}\{4\},\\pi\)\$/);
});

test('keyboard math is normalized for the PDF cases', () => {
    const result = integrity.normalizeMathContent(
        'sin A，sqrt(3)，AB∥CD，∠BAD，△ABC，CP·DP，120°'
    );
    assert.match(result.value, /\$\\sin A\$/);
    assert.match(result.value, /\$\\sqrt\{3\}\$/);
    assert.match(result.value, /\$AB\\parallel CD\$/);
    assert.match(result.value, /\$\\angle BAD\$/);
    assert.match(result.value, /\$\\triangle ABC\$/);
    assert.match(result.value, /\$\\overrightarrow\{CP\}\\cdot \\overrightarrow\{DP\}\$/);
    assert.match(result.value, /\$120\^\{\\circ\}\$/);
});

test('Unicode math symbols from real PDF transcription become LaTeX commands', () => {
    const result = integrity.normalizeMathContent(
        `\\frac{1330\\sqrt{2}}{3}\u03c0, \u2234 x\u22651, \u25b3ABC`
    );

    assert.match(result.value, /\\pi/);
    assert.match(result.value, /\\therefore/);
    assert.match(result.value, /\\ge/);
    assert.match(result.value, /\\triangle/);
    assert.equal(result.rawLatexOutsideMathBlocks, 0);
});

test('paired absolute value bars become balanced left and right delimiters', () => {
    const normalized = integrity.normalizeMathContent(
        String.raw`$\frac{|z|}{z}=|z||w|$`
    );

    assert.equal(
        normalized.value,
        String.raw`$\frac{\left|z\right|}{z}=\left|z\right|\left|w\right|$`
    );
    assert.equal(normalized.issues.length, 0);

    const alreadySized = integrity.normalizeMathContent(String.raw`$\left|z\right|$`);
    assert.equal(alreadySized.value, String.raw`$\left|z\right|$`);
});

test('left/right fragments merge only on the same page and visual line', () => {
    const merged = integrity.mergeMathFragments([
        { latex: '\\left(\\frac{1}{3}', page: 1, lineId: 'L4', bbox: [0.1, 0.2, 0.4, 0.25], space: 'normalized' },
        { latex: '\\right)^3', page: 1, lineId: 'L4', bbox: [0.405, 0.2, 0.55, 0.25], space: 'normalized' }
    ]);
    assert.equal(merged.fragments.length, 1);
    assert.equal(merged.fragments[0].latex, '\\left(\\frac{1}{3}\\right)^3');
    assert.deepEqual(merged.issues, []);

    const rejected = integrity.mergeMathFragments([
        { latex: '\\left(\\frac{1}{3}', page: 1, lineId: 'L4' },
        { latex: '\\right)^3', page: 2, lineId: 'L4' }
    ]);
    assert.equal(rejected.fragments.length, 2);
    assert.ok(rejected.issues.some(issue => issue.code === 'UNBALANCED_LEFT_RIGHT'));
});

test('incomplete standalone LaTeX commands are diagnosable and require review', () => {
    const item = integrity.normalizeQuestionItem({
        stem: '计算 \\left',
        options: ['A. 1', 'B. 2', 'C. 3', 'D. 4'],
        answer: 'A',
        solution: ''
    });
    assert.equal(item.manualReviewRequired, true);
    assert.ok(item.warnings.includes('公式需要人工复核'));
    assert.ok(item.contentIntegrity.issues.some(issue => issue.code === 'INCOMPLETE_LATEX_COMMAND'));
    assert.deepEqual(item.options, ['1', '2', '3', '4']);
});

test('already wrapped math survives the persistence shape without duplicate delimiters', () => {
    const first = integrity.normalizeQuestionItem({
        stem: '面积为 $\\frac{1330\\sqrt{2}}{3}\\pi$',
        options: [],
        answer: '',
        solution: '$\\left(\\frac13\\right)^3=\\frac1{27}$'
    });
    const second = integrity.normalizeQuestionItem(JSON.parse(JSON.stringify(first)));
    assert.equal(second.stem, first.stem);
    assert.equal(second.solution, first.solution);
    assert.doesNotMatch(second.stem, /\$\$/);
});

test('legacy PDF math fragments are conservatively collapsed into one complete formula', () => {
    const fragmented = String.raw`\frac{1330$\sqrt{2}$}{3}$\pi$`;
    const normalized = integrity.normalizeMathContent(fragmented);

    assert.equal(normalized.value, String.raw`$\frac{1330\sqrt{2}}{3}\pi$`);
    assert.equal(normalized.issues.length, 0);
    assert.equal(normalized.richRuns.length, 1);
    assert.equal(normalized.richRuns[0].kind, 'math');
});

test('independent math blocks separated by prose are never collapsed together', () => {
    const source = String.raw`$\frac{1}{2}$ and $\sqrt{2}$`;
    const normalized = integrity.normalizeMathContent(source);

    assert.equal(normalized.value, source);
    assert.equal(normalized.richRuns.filter(run => run.kind === 'math').length, 2);
});

test('set expressions at the start of options are content, not duplicate labels', () => {
    const normalized = integrity.normalizeQuestionItem({
        options: [
            'A = B',
            String.raw`B \subseteq A`,
            String.raw`A \cap B = \{0, -1\}`,
            String.raw`C_\mathbb{R}B = \{1\}`
        ]
    });

    assert.deepEqual(normalized.options, [
        '$A = B$',
        String.raw`$B \subseteq A$`,
        String.raw`$A \cap B = \{0, -1\}$`,
        String.raw`$C_\mathbb{R}B = \{1\}$`
    ]);
    assert.deepEqual(normalized.contentIntegrity.issues, []);
});

test('a second PDF normalization uses preserved raw stem and option evidence', () => {
    const first = integrity.normalizeQuestionItem({
        stem: String.raw`集合$A=\{0,1\}$`,
        options: [String.raw`A = B`, String.raw`B \subseteq A`, '', '']
    });
    const second = integrity.normalizeQuestionItem({
        ...first,
        stem: String.raw`集合$A=\{0,1\}$`,
        options: ['$A = B$', '$\\subseteq$ A', '', '']
    });

    assert.equal(second.options[0], '$A = B$');
    assert.equal(second.options[1], String.raw`$B \subseteq A$`);
    assert.deepEqual(second.contentIntegrity.issues, []);
});
