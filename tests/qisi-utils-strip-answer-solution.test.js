const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { stripAnswerSolution } = require('../qisi-utils.js');

describe('stripAnswerSolution', () => {
    it('normal input: extracts answer and solution', () => {
        const result = stripAnswerSolution('题目内容【答案】A【解析】解题过程');
        assert.equal(result.stem, '题目内容');
        assert.equal(result.answer, 'A');
        assert.ok(result.solution.includes('解题过程'));
    });

    it('empty input: returns empty object', () => {
        const result = stripAnswerSolution('');
        assert.equal(result.stem, '');
        assert.equal(result.answer, '');
        assert.equal(result.solution, '');
    });

    it('null input: returns empty object', () => {
        const result = stripAnswerSolution(null);
        assert.equal(result.stem, '');
        assert.equal(result.answer, '');
        assert.equal(result.solution, '');
    });

    it('undefined input: returns empty object', () => {
        const result = stripAnswerSolution(undefined);
        assert.equal(result.stem, '');
        assert.equal(result.answer, '');
        assert.equal(result.solution, '');
    });

    it('no answer or solution: returns full text as stem', () => {
        const result = stripAnswerSolution('纯题目内容');
        assert.equal(result.stem, '纯题目内容');
        assert.equal(result.answer, '');
        assert.equal(result.solution, '');
    });

    it('answer only: extracts answer', () => {
        const result = stripAnswerSolution('题目【答案】ABD');
        assert.equal(result.stem, '题目');
        assert.equal(result.answer, 'ABD');
        assert.equal(result.solution, '');
    });

    it('solution only: extracts solution', () => {
        const result = stripAnswerSolution('题目【解析】详细解答');
        assert.equal(result.stem, '题目');
        assert.equal(result.answer, '');
        assert.ok(result.solution.includes('详细解答'));
    });

    it('boundary: minimal content', () => {
        const result = stripAnswerSolution('【答案】A');
        assert.equal(result.answer, 'A');
    });

    it('representative real case: exam question', () => {
        const result = stripAnswerSolution('已知三角形ABC中，AB=AC，求角B的度数。【答案】B【解析】由等腰三角形性质可得');
        assert.ok(result.stem.includes('三角形'));
        assert.equal(result.answer, 'B');
        assert.ok(result.solution.includes('等腰三角形'));
    });

    it('no mutation: does not modify input', () => {
        const input = '题目【答案】A【解析】解';
        const original = input;
        stripAnswerSolution(input);
        assert.equal(input, original);
    });

    it('output shape consistency: always returns object with stem/answer/solution', () => {
        const inputs = ['test', '', null, undefined, '【答案】A', '【解析】解'];
        for (const input of inputs) {
            const result = stripAnswerSolution(input);
            assert.equal(typeof result, 'object', `Failed for input: ${JSON.stringify(input)}`);
            assert.ok('stem' in result, `Missing stem for input: ${JSON.stringify(input)}`);
            assert.ok('answer' in result, `Missing answer for input: ${JSON.stringify(input)}`);
            assert.ok('solution' in result, `Missing solution for input: ${JSON.stringify(input)}`);
        }
    });

    it('malformed input: handles non-string gracefully', () => {
        const result = stripAnswerSolution(12345);
        assert.equal(typeof result, 'object');
        assert.ok('stem' in result);
    });

    it('full-width answer: handles Ａ-Ｄ', () => {
        const result = stripAnswerSolution('题目【答案】ＡＢＣ');
        assert.equal(result.answer, 'ＡＢＣ');
    });

    it('app.js explicit call: uses window.Qisi.Utils.stripAnswerSolution', () => {
        const fs = require('node:fs');
        const path = require('node:path');

        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

        assert.match(app, /window\.Qisi\.Utils\.stripAnswerSolution\s*\(/);
    });

    it('app.js: no naked stripAnswerSolution calls', () => {
        const fs = require('node:fs');
        const path = require('node:path');

        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

        const nakedCalls = app
            .split(/\r?\n/)
            .filter(line => line.includes('stripAnswerSolution('))
            .filter(line => !line.includes('window.Qisi.Utils.stripAnswerSolution('));

        assert.deepEqual(nakedCalls, []);
    });
});
