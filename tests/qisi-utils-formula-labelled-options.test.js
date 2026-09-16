const test = require('node:test');
const assert = require('node:assert/strict');
const utils = require('../qisi-utils.js');

// Real text of 周二晚测.docx question 4: the four option labels live *inside* the maths, so every
// splitter that looks for a plain "A." left them in the stem - the teacher saw the four options glued
// on one line and the question came out typed 解答题.
const REAL_Q4 = [
    '4. 在 $ΔABC$ 中，已知 $tanA,tanB$ 是x的方程 $x^{2}+p(x+1)+1=0$ 的两个实根，则 $C$ 的大小为（ ）.',
    '$A.\\frac{\\pi }{4}$ $B.\\frac{\\pi }{3}$ $C.\\frac{2\\pi }{3}$ $D.\\frac{3\\pi }{4}$'
].join('\n');

test('a run of label-led formulas is read out of the stem as the options', () => {
    const result = utils.extractFormulaLabelledOptions(REAL_Q4);

    assert.deepEqual(result.options, [
        '$\\frac{\\pi }{4}$', '$\\frac{\\pi }{3}$', '$\\frac{2\\pi }{3}$', '$\\frac{3\\pi }{4}$'
    ]);
    assert.equal(
        result.stem,
        '4. 在 $ΔABC$ 中，已知 $tanA,tanB$ 是x的方程 $x^{2}+p(x+1)+1=0$ 的两个实根，则 $C$ 的大小为（ ）.'
    );
});

test('the run has to start at A, ascend, and hold nothing but whitespace between its parts', () => {
    const startsAtB = '则（ ）\n$B.1$ $C.2$ $D.3$';
    assert.deepEqual(utils.extractFormulaLabelledOptions(startsAtB).options, ['', '', '', '']);

    const outOfOrder = '则（ ）\n$A.1$ $C.2$ $D.3$';
    assert.deepEqual(utils.extractFormulaLabelledOptions(outOfOrder).options, ['', '', '', '']);

    const interrupted = '则（ ）\n$A.1$ （ ） $B.2$ $C.3$';
    assert.deepEqual(utils.extractFormulaLabelledOptions(interrupted).options, ['', '', '', '']);
});

test('an ordinary question and an ordinary option list are left untouched', () => {
    const plain = '已知集合 $A=\\{1,2\\}$，则（ ）\nA. 1 B. 2 C. 3 D. 4';
    const result = utils.extractFormulaLabelledOptions(plain);

    assert.equal(result.stem, plain);
    assert.deepEqual(result.options, ['', '', '', '']);
});

test('a single labelled formula is not an option run', () => {
    const single = '已知 $A.\\frac{1}{2}$ 是某个值，则（ ）';
    assert.deepEqual(utils.extractFormulaLabelledOptions(single).options, ['', '', '', '']);
});
