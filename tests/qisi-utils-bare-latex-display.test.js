const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeBareLatexExpressionForDisplay,
    normalizeBareLatexForDisplayOptionLine,
    normalizeBareLatexForDisplayOptions,
    normalizeBareLatexForDisplaySpan,
    normalizeBareLatexForDisplayText,
    normalizeBareLatexForDisplayTextBody
} = require('../qisi-utils.js');

test('BMR7: normalizeBareLatexExpressionForDisplay normalizes project OCR variants', () => {
    assert.equal(normalizeBareLatexExpressionForDisplay('\\frac{1330鈭?}{3}蟺'), '\\frac{1330\\sqrt{2}}{3}\\pi');
    assert.equal(normalizeBareLatexExpressionForDisplay('√2π'), '\\sqrt{2}\\pi');
});

test('BMR7: normalizeBareLatexForDisplaySpan wraps bare math runs only', () => {
    assert.equal(
        normalizeBareLatexForDisplaySpan('表面积为 \\frac{1330鈭?}{3}蟺'),
        '表面积为 $\\frac{1330\\sqrt{2}}{3}\\pi$'
    );
    assert.equal(normalizeBareLatexForDisplaySpan('plain text'), 'plain text');
    assert.equal(normalizeBareLatexForDisplaySpan('$\\frac{1}{2}$'), '$$\\frac{1}{2}$$');
});

test('BMR7: normalizeBareLatexForDisplayTextBody protects existing math segments', () => {
    assert.equal(
        normalizeBareLatexForDisplayTextBody('已有 $\\frac{1}{2}$，新增 \\sqrt{2}'),
        '已有 $\\frac{1}{2}$，新增 $\\sqrt{2}$'
    );
    assert.equal(
        normalizeBareLatexForDisplayTextBody('∵$A+B+C=$π'),
        '∵$A+B+C=$\u200B$\\pi$'
    );
});

test('BMR7: normalizeBareLatexForDisplayOptionLine normalizes option labels and content', () => {
    assert.equal(
        normalizeBareLatexForDisplayOptionLine('Ａ. \\sqrt{2}'),
        'A. $\\sqrt{2}$'
    );
    assert.equal(normalizeBareLatexForDisplayOptionLine('not an option'), null);
});

test('BMR7: normalizeBareLatexForDisplayText handles multiline option text', () => {
    assert.equal(
        normalizeBareLatexForDisplayText('A. \\sqrt{2}\n普通文本'),
        'A. $\\sqrt{2}$\n普通文本'
    );
});

test('BMR7: normalizeBareLatexForDisplayOptions preserves non-array input', () => {
    assert.deepEqual(normalizeBareLatexForDisplayOptions(['\\sqrt{2}', 'plain']), ['$\\sqrt{2}$', 'plain']);
    assert.equal(normalizeBareLatexForDisplayOptions(null), null);
});

test('PDF Q11: legacy draft text commands do not leave vector LaTeX outside math delimiters', () => {
    const source = '\\text{\u5219} \\overline{CP} = (x-2,-\\sqrt{3}), ' +
        '\\overline{DP} = (x,-\\sqrt{3}), \\therefore ' +
        '\\overline{CP} \\cdot \\overline{DP} = x(x-2)+3 = (x-1)^2+2';
    const normalized = normalizeBareLatexForDisplayText(source);
    const outsideMath = normalized.replace(/\$[^$]*\$/g, '');

    assert.doesNotMatch(normalized, /\\text\s*\{/);
    assert.doesNotMatch(
        outsideMath,
        /\\(?:overline|sqrt|therefore|cdot)\b/
    );
});

test('PDF Q11: Chinese punctuation keeps every legacy vector island renderable', () => {
    const source = '\\text{\u5219} \\overline{CP} = (x-2,-\\sqrt{3})\uff0c' +
        '\\overline{DP} = (x,-\\sqrt{3})\uff0c\\therefore ' +
        '\\overline{CP} \\cdot \\overline{DP} = x(x-2)+3';
    const normalized = normalizeBareLatexForDisplayText(source);
    const outsideMath = normalized.replace(/\$[^$]*\$/g, '');

    assert.doesNotMatch(normalized, /\\text\s*\{/);
    assert.doesNotMatch(outsideMath, /\\(?:overline|sqrt|therefore|cdot)\b/);
});

test('PDF Q11: an already wrapped mixed prose block is repaired for legacy drafts', () => {
    const source = '$\\text{\u5219} \\overline{CP} = (x-2,-\\sqrt{3})\uff0c' +
        '\\overline{DP} = (x,-\\sqrt{3})\uff0c\\therefore ' +
        '\\overline{CP} \\cdot \\overline{DP} = x(x-2)+3$';
    const normalized = normalizeBareLatexForDisplayText(source);
    const outsideMath = normalized.replace(/\$[^$]*\$/g, '');

    assert.doesNotMatch(normalized, /\\text\s*\{/);
    assert.doesNotMatch(outsideMath, /\\(?:overline|sqrt|therefore|cdot)\b/);
});

test('PDF display normalization preserves valid internal text commands', () => {
    const source = '$x=\\begin{cases}1,&\\text{当 }x>0，\\\\0,&\\text{其他}\u3002\\end{cases}$';
    const normalized = normalizeBareLatexForDisplayText(source);

    assert.equal(normalized, source);
});

test('DOCX set-builder notation with Chinese text stays in one balanced math segment', () => {
    const source = '集合B满足B=\\left\\{x\\left|x\\in A\\text{且}\\frac{1}{x}\\in A\\right.\\right\\}.';
    const normalized = normalizeBareLatexForDisplayText(source);

    assert.equal(
        normalized,
        '集合B满足$B=\\left\\{x\\left|x\\in A\\text{且}\\frac{1}{x}\\in A\\right.\\right\\}$.'
    );
    assert.equal((normalized.match(/\$/g) || []).length, 2);
});
