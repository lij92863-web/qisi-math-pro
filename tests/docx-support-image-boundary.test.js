const test = require('node:test');
const assert = require('node:assert/strict');
const Utils = require('../qisi-utils.js');
globalThis.Qisi = { ...(globalThis.Qisi || {}), Utils };
const parser = require('../qisi-support-text-parser.js').createSupportTextParser({
    normalizeQuestionKey: String,
    stripQuestionSectionNoise: value => value,
    extractGraphicRefs: value => [...value.matchAll(/\[\[IMAGE:([^\]]+)\]\]/g)].map(match => match[1]),
    normalizeMathTextForLatexSafe: value => value
});
const file = { id: 'image-support-source', filename: 'support.docx' };
const parse = text => parser.parseAnswerAndSolutionItemsFromText(text, file);
const solution = (result, number) => result.solutions.find(row => row.question === number);

test('an image between a printed question number and explicit label never joins the previous solution', () => {
    const result = parse('1.【答案】A\n【详解】FIRST_BODY\n2. [[IMAGE:diagram_2]] 【答案】B\n【详解】SECOND_BODY\n3.【答案】C\n【详解】THIRD_BODY');
    assert.equal(solution(result, '1').solution, 'FIRST_BODY');
    assert.match(solution(result, '2').solution, /SECOND_BODY/);
    assert.doesNotMatch(solution(result, '2').solution, /FIRST_BODY|THIRD_BODY/);
    assert.deepEqual(solution(result, '2').imageRefs, ['diagram_2']);
    assert.equal(solution(result, '3').solution, 'THIRD_BODY');
    assert.equal(result.answers.find(row => row.question === '2').answer, 'B');
});

test('an empty declared answer stays empty while its labelled solution and leading figure are preserved', () => {
    const result = parse('1.【答案】A\n【详解】FIRST_BODY\n2. [[IMAGE:diagram_2]] 【答案】\n【详解】SECOND_BODY。故选：C');
    assert.equal(solution(result, '1').solution, 'FIRST_BODY');
    assert.match(solution(result, '2').solution, /SECOND_BODY/);
    assert.deepEqual(solution(result, '2').imageRefs, ['diagram_2']);
    assert.equal(result.answers.some(row => row.question === '2'), false);
});

test('a numbered step with an image and no explicit label remains inside its solution', () => {
    const result = parse('1.【答案】A\n【详解】FIRST_BODY\n2. [[IMAGE:step_2]] draw the auxiliary line\n3.【答案】B\n【详解】THIRD_BODY');
    assert.match(solution(result, '1').solution, /FIRST_BODY[\s\S]*draw the auxiliary line/);
    assert.deepEqual(solution(result, '1').imageRefs, ['step_2']);
    assert.equal(solution(result, '2'), undefined);
    assert.equal(solution(result, '3').solution, 'THIRD_BODY');
});

test('multiple leading figures retain source identity and their original enclosing evidence range', () => {
    const text = '1.【详解】FIRST_BODY\n2. [[IMAGE:fig:2-a]] [[IMAGE:fig_2.b]] 【解析】SECOND_BODY';
    const row = solution(parse(text), '2');
    assert.ok(row);
    assert.deepEqual(row.imageRefs, ['fig:2-a', 'fig_2.b']);
    assert.equal(row.sourceFileId, file.id);
    const declaration = row.evidence.declarations[0];
    const normalized = Utils.normalizeAnswerSolutionSource(text);
    const raw = normalized.slice(...declaration.range);
    assert.match(raw, /\[\[IMAGE:fig:2-a\]\][\s\S]*\[\[IMAGE:fig_2.b\]\][\s\S]*SECOND_BODY/);
    assert.doesNotMatch(raw, /FIRST_BODY/);
});

test('duplicate labelled image boundaries with different bodies remain an explicit conflict', () => {
    const result = parse('1.【详解】FIRST_BODY\n2. [[IMAGE:first]] 【详解】SECOND_A\n2. [[IMAGE:second]] 【详解】SECOND_B');
    assert.equal(solution(result, '1').solution, 'FIRST_BODY');
    const row = solution(result, '2');
    assert.equal(row.solution, '');
    assert.equal(row.evidence.state, 'conflict');
    assert.equal(row.evidence.declarations.length, 2);
    assert.ok(result.conflicts.some(item => item.question === '2' && item.field === 'solution'));
});

test('ordinary text or math before a label cannot be skipped as an image prefix', () => {
    for (const prefix of ['explanation ', '$x+1$ ', '[[IMAGE:figure]] explanation ']) {
        const result = parse('1.【详解】FIRST_BODY\n2. ' + prefix + '【详解】continuation');
        assert.equal(solution(result, '2'), undefined);
        assert.match(solution(result, '1').solution, /FIRST_BODY[\s\S]*continuation/);
    }
});

test('malformed image tokens do not establish labelled boundaries', () => {
    for (const token of ['[[IMAGE:]]', '[[IMAGE:broken]', '[[IMAGE:two words]]']) {
        const result = parse('1.【详解】FIRST_BODY\n2. ' + token + ' 【详解】continuation');
        assert.equal(solution(result, '2'), undefined);
    }
});
