const test = require('node:test');
const assert = require('node:assert/strict');
const readModel = require('../qisi-review-draft-read-model.js');

const helpers = {
    questionNo: (q, index) => String(q?.questionNumber || index + 1),
    countValidOptions: options => (Array.isArray(options) ? options : []).filter(value => String(value || '').trim()).length,
    isChoiceDraft: q => /单选|多选|选择/.test(String(q?.type || '')),
    cleanText: value => String(value ?? '').trim()
};

const draft = (overrides = {}) => ({
    id: 'd1',
    questionNumber: '1',
    status: 'pending',
    type: '单选题',
    stem: 'stem',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    solution: 'solution',
    images: [],
    hasImage: false,
    ...overrides
});

test('draftHasImageToken detects image and formula-image tokens only', () => {
    assert.equal(readModel.draftHasImageToken(draft({ stem: 'x [[IMAGE:img_1]] y' })), true);
    assert.equal(readModel.draftHasImageToken(draft({ options: ['a', '[[FORMULA_IMAGE:f1]]'] })), true);
    assert.equal(readModel.draftHasImageToken(draft({ solution: '\\includegraphics{pic.png}' })), true);
    assert.equal(readModel.draftHasImageToken(draft({ answer: '\\includegraphics[width=4cm]{pic.png}' })), true);
    assert.equal(readModel.draftHasImageToken(draft({ stem: 'plain text', options: ['A', 'B'] })), false);
    assert.equal(readModel.draftHasImageToken({ options: 'not-an-array', stem: '' }), false);
    assert.equal(readModel.draftHasImageToken(null), false);
});

test('summarizeDrafts reports counts and missing number lists without mutating input', () => {
    const drafts = [
        draft({ id: 'a', questionNumber: '1' }),
        draft({ id: 'b', questionNumber: '2', answer: '', solution: '  ' }),
        draft({ id: 'c', questionNumber: '3', options: ['A', 'B'], type: '解答题' }),
        draft({ id: 'd', questionNumber: '4', options: ['A', 'B', 'C'], type: '多选题', stem: '[[IMAGE:i1]]' })
    ];
    const snapshot = JSON.parse(JSON.stringify(drafts));
    const summary = readModel.summarizeDrafts(drafts, helpers);
    assert.deepEqual(summary, {
        total: 4,
        withOptions: 4,
        withAnswers: 3,
        withSolutions: 3,
        withImageTokens: 1,
        missingAnswers: ['2'],
        missingSolutions: ['2'],
        missingOptions: ['4']
    });
    assert.deepEqual(drafts, snapshot);
});

test('summarizeDrafts handles an empty batch and a missing list', () => {
    const empty = readModel.summarizeDrafts([], helpers);
    assert.deepEqual(empty, {
        total: 0, withOptions: 0, withAnswers: 0, withSolutions: 0, withImageTokens: 0,
        missingAnswers: [], missingSolutions: [], missingOptions: []
    });
    assert.equal(readModel.summarizeDrafts(null, helpers).total, 0);
});

test('summarizeDrafts counts a choice question with four options as complete', () => {
    const summary = readModel.summarizeDrafts([draft({ options: ['A', 'B', 'C', 'D'] })], helpers);
    assert.deepEqual(summary.missingOptions, []);
    const incomplete = readModel.summarizeDrafts([draft({ options: ['A', 'B', 'C', ''] })], helpers);
    assert.deepEqual(incomplete.missingOptions, ['1']);
});

test('summarizeDrafts fails closed when the owning helpers are absent', () => {
    assert.throws(() => readModel.summarizeDrafts([draft()], {}), error => error.code === 'REVIEW_DRAFT_READ_MODEL_STATE_REQUIRED');
    assert.throws(() => readModel.summarizeDrafts([draft()], {
        questionNo: () => '1', countValidOptions: () => 4, isChoiceDraft: () => true
    }), error => error.code === 'REVIEW_DRAFT_READ_MODEL_UTILS_REQUIRED');
});

test('filterDrafts keeps status, problem and image filters distinct', () => {
    const drafts = [
        draft({ id: 'p', status: 'pending' }),
        draft({ id: 'r', status: 'reviewed' }),
        draft({ id: 's', status: 'submitted' }),
        draft({ id: 'i', status: 'pending', hasImage: true }),
        draft({ id: 'x', status: 'pending' })
    ];
    const ids = (filter, problemsOf) => readModel.filterDrafts(drafts, filter, problemsOf).map(item => item.id);
    assert.deepEqual(ids('pending'), ['p', 'i', 'x']);
    assert.deepEqual(ids('reviewed'), ['r']);
    assert.deepEqual(ids('submitted'), ['s']);
    assert.deepEqual(ids('images'), ['i']);
    assert.deepEqual(ids('problems', q => (q.id === 'x' ? ['missing'] : [])), ['x']);
    assert.deepEqual(ids('all'), ['p', 'r', 's', 'i', 'x']);
    // Unknown filters must not silently drop rows.
    assert.equal(readModel.filterDrafts(drafts, 'unknown'), drafts);
    assert.throws(() => readModel.filterDrafts(drafts, 'problems'), error => error.code === 'REVIEW_DRAFT_READ_MODEL_PROBLEMS_REQUIRED');
});

test('filterDrafts never mutates its input', () => {
    const drafts = [draft({ id: 'p' })];
    const snapshot = JSON.parse(JSON.stringify(drafts));
    readModel.filterDrafts(drafts, 'images');
    readModel.filterDrafts(drafts, 'pending');
    assert.deepEqual(drafts, snapshot);
});
