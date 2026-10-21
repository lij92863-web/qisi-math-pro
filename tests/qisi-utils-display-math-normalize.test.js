const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../qisi-utils.js');

test('a multi-line display block is never double-wrapped with inline dollars', () => {
    const source = '故\n$$\n\\overrightarrow {C D} \\cdot \\overrightarrow {P Q} = \\frac {7}{2}.\n$$';
    const normalized = Utils.normalizeBareLatexForDisplayText(source);
    assert.equal(normalized, source);
    assert.doesNotMatch(normalized, /\$\$\s*\n\s*\$/);
});

test('bare geometry labels, equations and sub-question labels become math', () => {
    const normalized = Utils.normalizeBareLatexForDisplayText(
        '在正方形ABCD中，AB=3，设x>0，(i) 求a的值；(ii) 求点A(1,2)的坐标。'
    );
    assert.match(normalized, /正方形\$ABCD\$中/);
    assert.match(normalized, /\$AB=3\$/);
    assert.match(normalized, /\$x>0\$/);
    assert.match(normalized, /\$\(\\mathrm\{i\}\)\$/);
    assert.match(normalized, /\$\(\\mathrm\{ii\}\)\$/);
    assert.match(normalized, /求\$a\$的值/);
    assert.match(normalized, /点\$A\(1,2\)\$的坐标/);
});

test('ocr fill-in blanks render as underscores, not literal backslashes', () => {
    const normalized = Utils.normalizeBareLatexForDisplayText(
        '则 $a+b$ 的值为 \\_\\_\\_\\_.'
    );
    assert.match(normalized, /\$\\_\\_\\_\\_\$\.$/);
    assert.doesNotMatch(normalized, /^.*[^$]\\_\\_\\_\\_[^$]/);
});

test('existing math and Chinese prose are left untouched', () => {
    const source = '已有 $\\frac{1}{2}$ 和 $AB$ 不重复，解析文字保持原样。';
    assert.equal(Utils.normalizeBareLatexForDisplayText(source), source);
    assert.equal(Utils.normalizeBareLatexForDisplayText('纯中文题目，没有公式。'), '纯中文题目，没有公式。');
});
