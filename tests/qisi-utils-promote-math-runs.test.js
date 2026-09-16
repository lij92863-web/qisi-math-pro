const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../qisi-utils.js');

// The rule is the product's only answer to "a letter that means a symbol must not stay in the body
// font". These cases are the shapes real papers produce, not one document's text.
test('letters that mean symbols become inline LaTeX', () => {
    assert.equal(
        utils.promoteMathRuns('如图，四棱锥PABCD中，底面ABCD为矩形'),
        '如图，四棱锥$PABCD$中，底面$ABCD$为矩形'
    );
    assert.equal(
        utils.promoteMathRuns('的零点分别为a，b，c，则a，b，c的大小顺序为'),
        '的零点分别为$a$，$b$，$c$，则$a$，$b$，$c$的大小顺序为'
    );
    assert.equal(
        utils.promoteMathRuns('设AP＝1，AD＝√3，三棱锥PABD的体积'),
        '设$AP=1$，$AD=√3$，三棱锥$PABD$的体积'
    );
});

test('a space stays inside a formula, and function names become upright', () => {
    assert.equal(utils.promoteMathRuns('z_{2}=2cos θ'), '$z_{2}=2\\cos  θ$');
    assert.equal(utils.promoteMathRuns('g(x)=log_{2}x'), '$g(x)=\\log _{2}x$');
});

test('what is already maths stays one run with what touches it', () => {
    assert.equal(utils.promoteMathRuns('$z_{1}=m$+1'), '$z_{1}=m+1$');
    assert.equal(utils.promoteMathRuns('i(m\\in R)'), '$i(m\\in R)$');
    assert.doesNotMatch(utils.promoteMathRuns('$z_{1}=m$∈R'), /\$\$/);
    // A bare operator between two formulas stays where it is: the rendering is identical either way.
    assert.equal(utils.promoteMathRuns('$a$·$b$'), '$a$·$b$');
});

test('display maths keeps both of its delimiters', () => {
    assert.equal(utils.promoteMathRuns('前$$x=1$$后'), '前$$x=1$$后');
});

test('a broken delimiter count is repaired, a real display pair is not', () => {
    // A stem that a split cut between two formulas ends up with one "$$" too many - 佛山一模 question 10.
    assert.equal(
        utils.repairMathDelimiters('若 $$P\\left(A\\right)=\\frac{1}{6}$，则（ ）'),
        '若 $P\\left(A\\right)=\\frac{1}{6}$，则（ ）'
    );
    assert.equal(utils.repairMathDelimiters('前$$x=1$$后'), '前$$x=1$$后');
    assert.equal(utils.repairMathDelimiters('前$x=1$后'), '前$x=1$后');
    assert.equal(utils.repairMathDelimiters('没有任何公式'), '没有任何公式');
});

test('things that are not formulas are left alone', () => {
    // An option label belongs to the option reader, not to a formula.
    assert.equal(utils.promoteMathRuns('A. 1 B. 2 C. 3 D. 4'), 'A. 1 B. 2 C. 3 D. 4');
    // A year, a class name and a numbering row are prose.
    assert.equal(utils.promoteMathRuns('2026年7月9日高中数学作业'), '2026年7月9日高中数学作业');
    assert.equal(utils.promoteMathRuns('高一数学作业（九）'), '高一数学作业（九）');
    // An answer blank is not a formula either.
    assert.equal(utils.promoteMathRuns('则λ的取值范围为_____.'), '则$λ$的取值范围为_____.');
});

test('inline tokens survive the pass untouched', () => {
    const token = '[[IMAGE:dimg_1789561760616_szm5rw]]';
    assert.equal(utils.promoteMathRuns(`${token} 9. 如图，在梯形 ABCD 中`), `${token} 9. 如图，在梯形 $ABCD$ 中`);
    assert.equal(
        utils.promoteMathRuns('[[MTEF_UNRESOLVED:rId99]]，令 h(x)=f(x)-k'),
        '[[MTEF_UNRESOLVED:rId99]]，令 $h(x)=f(x)-k$'
    );
});

test('the real question 10 stem comes out fully typeset', () => {
    const stem = '已知复数$z_{1}=m+(4-m^{2})i(m$\\in R)，$z_{2}=2cos$ \u03b8+(\u03bb+3sin\u03b8)i(\u03bb，\u03b8\\in R）并且$z_{1}=z_{2}$，则\u03bb的取值范围为_____.';
    const promoted = utils.promoteMathRuns(stem);

    assert.match(promoted, /i\(m\\in R\)/, 'the "∈ R" joins the formula it belongs to');
    assert.doesNotMatch(promoted, /\$\\in/, 'the command never starts a run of its own after a "$"');
    assert.doesNotMatch(promoted, /\$\$/, 'no seam is left as "$$"');
    assert.ok(promoted.includes('$\u03bb$的取值范围'), 'the Greek letter is a symbol');
    assert.doesNotMatch(promoted, /\$\$/);
});
