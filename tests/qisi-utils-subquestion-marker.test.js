const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../qisi-utils.js');

// 武汉四调 states "15．(1)" where an answer would be: the line is the first sub-question of a
// three-part 解答, so the value in the answer slot is the marker "(1)" and not an answer.
test('a bracketed sub-question marker is not an answer value', () => {
    for (const value of ['(1)', '（1）', '(1) $e$', '(2)　由题意得', '(12)', '（Ⅲ）证明：']) {
        assert.equal(
            utils.isSubQuestionMarkerValue(value),
            true,
            `${JSON.stringify(value)} is the start of a solution, not an answer`
        );
    }
});

test('a bracketed answer that carries a value is left alone', () => {
    for (const value of ['(0,1)', '(-∞,0)', '(1,2)', '（-1，2）', '[0,1)', '(0,2]$', '', '   ',
        '√3/3', 'C', '(a,b)', '${x|x>1}$']) {
        assert.equal(
            utils.isSubQuestionMarkerValue(value),
            false,
            `${JSON.stringify(value)} is a real value and must survive`
        );
    }
});
