const test = require('node:test');
const assert = require('node:assert/strict');
const Export = require('../qisi-export-service');

test('package image rekey rewrites exact display tokens, retaining raw evidence and unknown tokens', () => {
    const question = { stem: '[[IMAGE:a.b]] [[IMAGE:aXb]] [[FORMULA_IMAGE:a.b]]',
        options: ['\\includegraphics[width=2cm]{a.b}', null, 0], answer: '[[IMAGE:a.b]]',
        solution: '\\includegraphics{missing}', rawText: '[[IMAGE:a.b]]', evidence: { token: '[[IMAGE:a.b]]' } };
    const before = structuredClone(question);
    const next = Export.rekeyQuestionImageTokens(question, new Map([['a.b', 'new-id']]));
    assert.equal(next.stem, '[[IMAGE:new-id]] [[IMAGE:aXb]] [[FORMULA_IMAGE:new-id]]');
    assert.deepEqual(next.options, ['\\includegraphics[width=2cm]{new-id}', null, 0]);
    assert.equal(next.answer, '[[IMAGE:new-id]]'); assert.equal(next.solution, question.solution);
    assert.equal(next.rawText, question.rawText); assert.deepEqual(next.evidence, question.evidence);
    assert.deepEqual(question, before);
    assert.deepEqual(Export.rekeyQuestionImageTokens({ id: 'empty' }, new Map()), { id: 'empty' });
});

test('rekey performs one pass so an output ID matching another input ID is not rewritten twice', () => {
    const result = Export.rekeyQuestionImageTokens({ stem: '[[IMAGE:a]] [[IMAGE:b]]' }, new Map([['a', 'b'], ['b', 'c']]));
    assert.equal(result.stem, '[[IMAGE:b]] [[IMAGE:c]]');
});
