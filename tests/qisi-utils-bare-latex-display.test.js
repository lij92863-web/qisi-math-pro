const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeBareLatexExpressionForDisplay,
    normalizeBareLatexForDisplayOptionLine,
    normalizeBareLatexForDisplayOptions,
    normalizeBareLatexForDisplaySpan,
    normalizeBareLatexForDisplayText,
    normalizeBareLatexForDisplayTextBody,
    splitQuestionForStorage
} = require('../qisi-utils.js');

test('splitting OCR options preserves angle formulas and removes inter-option LaTeX spacing', () => {
    const stem = String.raw`4. 若圆弧 $\overarc{DE}$ 和 $\overarc{AC}$ 的半径分别为 12 和 27，且 $\angle ABC=120^{\circ}$，求侧面积。`;
    const options = String.raw`A. $292\pi$ \quad B. $\frac{1330\sqrt{2}}{3}\pi$ \qquad C. $195\pi$ \quad D. $243\pi$`;
    assert.deepEqual(splitQuestionForStorage(stem + '\n' + options, '解答题'), {
        stem,
        options: [String.raw`$292\pi$`, String.raw`$\frac{1330\sqrt{2}}{3}\pi$`, String.raw`$195\pi$`, String.raw`$243\pi$`],
        type: '单选题'
    });
    const formulaSpacing = String.raw`$x\quad y$`;
    assert.equal(splitQuestionForStorage('请选出公式\nA. ' + formulaSpacing + '\nB. $z$', '单选题').options[0], formulaSpacing);
});

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


test('N39: math protection restores block delimiters literally', () => {
    const utils = require('../qisi-utils.js');
    const source = '$$\\frac{1}{2}$$';
    const protectedMath = utils.protectLatexMathSegments(source);
    assert.equal(utils.restoreLatexMathSegments(protectedMath.protectedText, protectedMath.chunks), source);
});
