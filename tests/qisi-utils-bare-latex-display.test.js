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
