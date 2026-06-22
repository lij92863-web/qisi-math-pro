const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    normalizeAnswerSolutionSource,
    splitAnswerSolutionSections
} = require('../qisi-utils.js');

describe('normalizeAnswerSolutionSource', () => {
    it('normal text: cleans whitespace and newlines', () => {
        const result = normalizeAnswerSolutionSource('hello  world\r\n\n\nfoo');
        assert.equal(result.includes('hello'), true);
    });
    it('empty string: returns empty string', () => {
        assert.equal(normalizeAnswerSolutionSource(''), '');
    });
    it('null: returns empty string', () => {
        assert.equal(normalizeAnswerSolutionSource(null), '');
    });
    it('undefined: returns empty string', () => {
        assert.equal(normalizeAnswerSolutionSource(undefined), '');
    });
    it('whitespace-only: returns empty string', () => {
        assert.equal(normalizeAnswerSolutionSource('   \r\n  '), '');
    });
    it('fullwidth spaces: converts to halfwidth', () => {
        const result = normalizeAnswerSolutionSource('题　目');
        assert.ok(!result.includes('　'));
    });
    it('output is string', () => {
        assert.equal(typeof normalizeAnswerSolutionSource('test'), 'string');
    });
    it('no mutation: input unchanged', () => {
        const input = 'test\r\nvalue';
        normalizeAnswerSolutionSource(input);
        assert.equal(input, 'test\r\nvalue');
    });
});

describe('splitAnswerSolutionSections', () => {
    it('text with 解析 header: splits correctly', () => {
        const result = splitAnswerSolutionSections('题目内容\n解析：解题步骤');
        assert.equal(result.answerPart, '题目内容');
        assert.ok(result.solutionPart.includes('解题步骤'));
    });
    it('text with 解答 header: splits correctly', () => {
        const result = splitAnswerSolutionSections('问题\n解答：答案详情');
        assert.equal(result.answerPart, '问题');
        assert.equal(result.solutionPart, '答案详情');
    });
    it('text without solution header: returns same in both parts', () => {
        const result = splitAnswerSolutionSections('纯题目内容');
        assert.equal(result.answerPart, '纯题目内容');
        assert.equal(result.solutionPart, '纯题目内容');
    });
    it('empty input: returns empty object', () => {
        const result = splitAnswerSolutionSections('');
        assert.equal(result.answerPart, '');
        assert.equal(result.solutionPart, '');
    });
    it('null input: returns empty object fields', () => {
        const result = splitAnswerSolutionSections(null);
        assert.equal(result.answerPart, '');
        assert.equal(result.solutionPart, '');
    });
    it('representative project case: exam answer-solution', () => {
        const result = splitAnswerSolutionSections('答案：A\n解析：由题意可知');
        assert.ok(result.answerPart.includes('答案'));
        assert.ok(result.solutionPart.includes('由题意'));
    });
    it('output shape: always has answerPart and solutionPart', () => {
        const inputs = ['test', '', null, 'x\n解析：y'];
        for (const input of inputs) {
            const result = splitAnswerSolutionSections(input);
            assert.ok('answerPart' in result);
            assert.ok('solutionPart' in result);
        }
    });
    it('integration: normalize → split pipeline', () => {
        const normalized = normalizeAnswerSolutionSource('test\r\n解析：foo\r\nbar');
        const split = splitAnswerSolutionSections(normalized);
        assert.ok('answerPart' in split);
        assert.ok('solutionPart' in split);
    });
    it('app.js explicit call: normalizeAnswerSolutionSource', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        assert.match(app, /window\.Qisi\.Utils\.normalizeAnswerSolutionSource\s*\(/);
    });
    it('app.js explicit call: splitAnswerSolutionSections', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        assert.match(app, /window\.Qisi\.Utils\.splitAnswerSolutionSections\s*\(/);
    });
    it('app.js: no naked normalizeAnswerSolutionSource calls', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const naked = app.split(/\r?\n/).filter(l =>
            l.includes('normalizeAnswerSolutionSource(') &&
            !l.includes('window.Qisi.Utils.normalizeAnswerSolutionSource(')
        );
        assert.deepEqual(naked, []);
    });
    it('app.js: no naked splitAnswerSolutionSections calls', () => {
        const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
        const naked = app.split(/\r?\n/).filter(l =>
            l.includes('splitAnswerSolutionSections(') &&
            !l.includes('window.Qisi.Utils.splitAnswerSolutionSections(')
        );
        assert.deepEqual(naked, []);
    });
});
