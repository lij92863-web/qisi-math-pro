const test = require('node:test');
const assert = require('node:assert/strict');
const merge = require('../qisi-library-external-merge.js');

const helpers = {
    getMatchInfo: external => ({ matchedQuestion: external.match ?? null }),
    fillQuestion: (local, external) => ({ ...local, filledFrom: external.id }),
    copyQuestion: external => ({ copiedFrom: external.id })
};

const item = (overrides = {}) => ({ question: { id: 'e1' }, action: 'add', ...overrides });

test('countUnresolved counts only skipped similar/conflict rows', () => {
    const items = [
        { status: 'similar', action: 'skip' },
        { status: 'answerConflict', action: 'skip' },
        { status: 'similar', action: 'fill' },
        { status: 'new', action: 'skip' }
    ];
    assert.equal(merge.countUnresolved(items), 2);
    assert.equal(merge.countUnresolved(null), 0);
});

test('buildMergeOperations covers skip, fill and add branches', () => {
    const operations = merge.buildMergeOperations({
        items: [
            item({ action: 'skip' }),
            item({ question: { id: 'e2', match: { id: 'local1', updatedAt: 7 } }, action: 'fill' }),
            item({ question: { id: 'e3' }, action: 'fill', matchedQuestionId: 'local2' }),
            item({ question: { id: 'e4' }, action: 'add' }),
            item({ question: { id: 'e5' }, action: 'unknown' })
        ],
        findQuestion: id => ({ id, updatedAt: 9 }),
        ...helpers
    });
    assert.deepEqual(operations, [
        { action: 'skip', externalId: 'e1' },
        { action: 'fill', externalId: 'e2', question: { id: 'local1', updatedAt: 7, filledFrom: 'e2' }, expectedUpdatedAt: 7 },
        { action: 'fill', externalId: 'e3', question: { id: 'local2', updatedAt: 9, filledFrom: 'e3' }, expectedUpdatedAt: 9 },
        { action: 'add', externalId: 'e4', question: { copiedFrom: 'e4' } }
    ]);
});

test('buildMergeOperations turns an unresolved fill into an add', () => {
    const operations = merge.buildMergeOperations({
        items: [item({ question: { id: 'e9' }, action: 'fill', matchedQuestionId: 'missing' })],
        findQuestion: () => null,
        ...helpers
    });
    assert.deepEqual(operations, [{ action: 'add', externalId: 'e9', question: { copiedFrom: 'e9' } }]);
});

test('buildMergeOperations skips rows without a question and empty input', () => {
    assert.deepEqual(merge.buildMergeOperations({ items: [{}], ...helpers }), []);
    assert.deepEqual(merge.buildMergeOperations({ items: null, ...helpers }), []);
});

test('buildMergeOperations fails closed without its helpers', () => {
    assert.throws(() => merge.buildMergeOperations({ items: [item()], copyQuestion: x => x }),
        error => error.code === 'LIBRARY_EXTERNAL_MERGE_MATCH_HELPER_REQUIRED');
    assert.throws(() => merge.buildMergeOperations({ items: [item()], getMatchInfo: () => null }),
        error => error.code === 'LIBRARY_EXTERNAL_MERGE_FILL_HELPER_REQUIRED');
    assert.throws(() => merge.buildMergeOperations({ items: [item()], getMatchInfo: () => null, fillQuestion: x => x }),
        error => error.code === 'LIBRARY_EXTERNAL_MERGE_COPY_HELPER_REQUIRED');
});
