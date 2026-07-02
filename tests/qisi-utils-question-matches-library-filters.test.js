const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { questionMatchesLibraryFilters } = require('../qisi-utils.js');

const hasText = (value) => String(value || '').trim().length > 0;

describe('questionMatchesLibraryFilters', () => {
    const baseQuestion = {
        stem: 'Find the area of triangle ABC.',
        answer: 'A',
        solution: 'Use base times height.',
        type: '单选题',
        diff: '中等',
        grade: '高一',
        images: [{ id: 'img-1' }]
    };

    it('matches an unfiltered question', () => {
        assert.equal(questionMatchesLibraryFilters(baseQuestion, { hasText }), true);
    });

    it('filters by keyword across stem answer and solution', () => {
        assert.equal(questionMatchesLibraryFilters(baseQuestion, { keyword: 'triangle', hasText }), true);
        assert.equal(questionMatchesLibraryFilters(baseQuestion, { keyword: 'parabola', hasText }), false);
    });

    it('filters by type diff and grade', () => {
        assert.equal(questionMatchesLibraryFilters(baseQuestion, {
            filters: { type: '单选题', diff: '中等', grade: '高一' },
            hasText
        }), true);
        assert.equal(questionMatchesLibraryFilters(baseQuestion, {
            filters: { type: '解答题' },
            hasText
        }), false);
    });

    it('uses meta fallback for diff and grade', () => {
        const q = { ...baseQuestion, diff: '', grade: '', meta: { diff: '困难', grade: '高二' } };
        assert.equal(questionMatchesLibraryFilters(q, {
            filters: { diff: '困难', grade: '高二' },
            hasText
        }), true);
    });

    it('filters by answer and image state', () => {
        assert.equal(questionMatchesLibraryFilters(baseQuestion, {
            filters: { answerState: 'hasAnswer', imageState: 'hasImage' },
            hasText
        }), true);
        assert.equal(questionMatchesLibraryFilters({ ...baseQuestion, solution: '', images: [] }, {
            filters: { answerState: 'hasAnswer' },
            hasText
        }), false);
        assert.equal(questionMatchesLibraryFilters({ ...baseQuestion, images: [] }, {
            filters: { imageState: 'hasImage' },
            hasText
        }), false);
    });

    it('rejects empty questions', () => {
        assert.equal(questionMatchesLibraryFilters(null, { hasText }), false);
    });
});
