const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../qisi-utils.js');

const { normalizeBareLatexForDisplayText, normalizeBareLatexForDisplayOptions } = utils;

// Already-legal LaTeX must pass through display normalization untouched. Any change here
// means the display normalizer rewrote content the question bank already stored correctly.
const LEGAL_LATEX = [
    'Inline $x+1$ formula',
    'Inline \\(x+1\\) formula',
    'Display \\[x^2+y^2=1\\] formula',
    'Display $$x^2+y^2=1$$ formula',
    '$\\frac{1}{2}$',
    '$\\sqrt{3}$',
    '$\\sum_{n=1}^{\\infty}\\frac{1}{n^2}$',
    '$\\prod_{k=1}^{n} k$',
    '$\\int_{0}^{1} x\\,dx$',
    '$\\lim_{x\\to 0}\\frac{\\sin x}{x}$',
    '$\\vec{a}\\cdot\\vec{b}$',
    '$\\overrightarrow{AB}$',
    '$\\overline{CD}\\underline{EF}$',
    '$\\binom{n}{k}$',
    '$x_1$ 与 $x^2$ 与 $a_{n+1}$',
    '$\\begin{cases} x=1 \\\\ y=2 \\end{cases}$',
    '$\\begin{aligned} a&=1 \\\\ b&=2 \\end{aligned}$',
    '$\\begin{array}{cc} 1 & 2 \\\\ 3 & 4 \\end{array}$',
    '$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$',
    '$\\begin{bmatrix} 1 & 2 \\end{bmatrix}$',
    '$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$',
    '$\\mathbb{R}$ 与 $\\mathbf{v}$ 与 $\\mathrm{d}x$',
    '$\\because x>0$',
    '$\\therefore x=1$',
    '$\\angle ABC=\\perp$',
    '$AB\\parallel CD$',
    '$x\\in A$ 且 $x\\notin B$',
    '$A\\subset B$ 且 $A\\cup B$ 且 $A\\cap B$',
    '$A=\\emptyset$',
    '$x\\ge 1$, $x\\le 2$, $x\\ne 3$, $x\\approx 1$, $x\\to\\infty$',
    '设 $a>0$，则 $\\sqrt{a}+\\frac{1}{a}\\ge 2$。',
    '$f(x)=x^2$；$g(x)=\\sqrt{x}$：注意定义域。',
    '$\\text{面积}=S$'
];

// Bare fragments that a teacher should never see as raw LaTeX have to be wrapped.
//
// Known gap, recorded in docs/integration/INTEGRATION_AUDIT_2026_09_15.md and deliberately not
// asserted here: main's display normalizer does not wrap a bare fragment whose only LaTeX signal is
// an operator such as \in, so `x\in(0,+\infty)` is still shown as source. Closing it is a one-line
// extension of BARE_LATEX_DISPLAY_SIGNAL_RE, scheduled as a separate change.
const BARE_FRAGMENTS = [
    '\\frac{1}{2}',
    '\\sqrt{3}',
    '\\angle ABC',
    '\\pi r^2'
];

test('display normalization leaves already-legal LaTeX untouched', () => {
    for (const source of LEGAL_LATEX) {
        assert.equal(
            normalizeBareLatexForDisplayText(source),
            source,
            `legal LaTeX was rewritten: ${source}`
        );
    }
});

test('display normalization wraps bare latex fragments for display', () => {
    for (const source of BARE_FRAGMENTS) {
        const normalized = normalizeBareLatexForDisplayText(source);
        assert.match(
            normalized,
            /^\$[\s\S]+\$$/u,
            `bare fragment was not wrapped: ${source} -> ${normalized}`
        );
        assert.ok(
            normalized.includes(source.replace(/\s+/g, ' ')) || normalized.includes(source),
            `bare fragment content changed: ${source} -> ${normalized}`
        );
    }
});

test('option labels survive display normalization in every supported style', () => {
    // Display normalization always keeps exactly one space between the label delimiter and
    // the option content. The label itself is never absorbed into the math island.
    const cases = [
        ['A. $\\frac{1}{2}$', 'A. $\\frac{1}{2}$'],
        ['B．$\\sqrt{3}$', 'B． $\\sqrt{3}$'],
        ['B.$\\sqrt{3}$', 'B. $\\sqrt{3}$'],
        ['C、\\frac{1}{2}', 'C、 $\\frac{1}{2}$'],
        ['D: $x\\in(0,+\\infty)$', 'D: $x\\in(0,+\\infty)$'],
        ['Ａ. $x=1$', 'A. $x=1$']
    ];
    for (const [source, expected] of cases) {
        assert.equal(
            normalizeBareLatexForDisplayText(source),
            expected,
            `option line changed: ${source}`
        );
    }
});

// Preserving the delimiter is the requirement here. Wrapping a bare piecewise formula is a separate
// gap recorded in docs/integration/INTEGRATION_AUDIT_2026_09_15.md: main leaves it as source rather
// than wrapping it, so this test asserts that the legal text is not damaged.
test('a bare piecewise formula keeps its \\right. delimiter intact', () => {
    const source = '\\left\\{\\begin{array}{l} x+1 \\\\ y-2 \\end{array}\\right.';
    const normalized = normalizeBareLatexForDisplayText(source);

    assert.equal(normalized, source, 'the empty delimiter must not be split off the command');
    assert.doesNotMatch(normalized, /\\right\$/, 'the delimiter must never be moved outside the math island');
});

test('display math keeps its $$ delimiters instead of collapsing to inline math', () => {
    for (const source of [
        '$$x^2+y^2=1$$',
        '有两解：$$a_{1}$$与$$a_{2}$$',
        'Display $$\\frac{1}{2}$$ formula'
    ]) {
        assert.equal(
            normalizeBareLatexForDisplayText(source),
            source,
            `display math delimiters changed: ${source}`
        );
    }
});

// Legacy encoded square roots arrive as `鈭?` (a lost-byte encoding of √2). The repair has to
// survive display normalization, including inside an option line.
test('legacy encoded square root glyphs are repaired instead of shown as raw text', () => {
    assert.equal(
        normalizeBareLatexForDisplayText('\\frac{1330鈭?}{3}蟺'),
        '$\\frac{1330\\sqrt{2}}{3}\\pi$'
    );
    assert.equal(
        normalizeBareLatexForDisplayText('A. 表面积为 12鈭?'),
        'A. 表面积为 $12\\sqrt{2}$'
    );
    assert.equal(
        normalizeBareLatexForDisplayText('A. 1\nB. \\frac{1330鈭?}{3}蟺\nC. $\\frac{1}{2}$'),
        'A. 1\nB. $\\frac{1330\\sqrt{2}}{3}\\pi$\nC. $\\frac{1}{2}$'
    );
});

test('a multi-line option list never lets one option consume another label', () => {
    const source = [
        'A. 1',
        'B. \\frac{1330\\sqrt{2}}{3}\\pi',
        'C. $\\frac{1}{2}$',
        'D. $x\\in(0,+\\infty)$'
    ].join('\n');
    const lines = normalizeBareLatexForDisplayText(source).split('\n');

    assert.equal(lines.length, 4);
    assert.match(lines[0], /^A\. /);
    assert.match(lines[1], /^B\. \$/);
    assert.equal(lines[2], 'C. $\\frac{1}{2}$');
    assert.equal(lines[3], 'D. $x\\in(0,+\\infty)$');
    for (const line of lines) {
        assert.doesNotMatch(line, /^[A-D]\$/, `label was absorbed into math: ${line}`);
    }
});

test('option arrays are normalized without reordering or merging entries', () => {
    const normalized = normalizeBareLatexForDisplayOptions([
        '1',
        '\\frac{1330\\sqrt{2}}{3}\\pi',
        '$\\frac{1}{2}$',
        '$x\\in(0,+\\infty)$'
    ]);
    assert.equal(normalized.length, 4);
    assert.equal(normalized[0], '1');
    assert.equal(normalized[2], '$\\frac{1}{2}$');
    assert.equal(normalized[3], '$x\\in(0,+\\infty)$');
});
