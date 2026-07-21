const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'qisi-review-composable.js'),
    'utf8'
);
const { useReview } = require('../qisi-review-composable');

const ref = value => ({ value });
const computed = getter => ({ get value() { return getter(); } });

const createFixture = (overrides = {}) => {
    const calls = { notify: [], merged: [], filtered: [] };
    const context = {
        batchImportBatches: ref([]),
        batchDraftQuestions: ref([]),
        ...(overrides.context || {})
    };
    const dependencies = {
        ref,
        computed,
        ReviewDraftState: {
            normalizeDraftEditorNewlines: value => String(value ?? '').replace(/\r\n?/g, '\n'),
            buildDraftEditorProjection: (value, question) => ({ value, question }),
            filterDraftQuestions: (items, filter, getProblems) => {
                calls.filtered.push([items, filter, getProblems]);
                if (filter === 'problems') return items.filter(item => getProblems(item).length);
                return filter === 'all' ? items : items.filter(item => item.status === filter);
            }
        },
        mergeStemWithOptions: (...args) => {
            calls.merged.push(args);
            return `${args[0]}\r\nA. ${args[1][0]}`;
        },
        draftQuestionProblems: question => question.problems || [],
        notify: message => calls.notify.push(message),
        ...(overrides.dependencies || {})
    };
    return {
        calls,
        context,
        dependencies,
        review: useReview(context, dependencies)
    };
};

test('review composable exposes the same factory in Node and the browser namespace', () => {
    const sandbox = { globalThis: {}, module: { exports: {} } };
    vm.runInNewContext(source, sandbox);
    assert.equal(typeof useReview, 'function');
    assert.equal(
        sandbox.globalThis.Qisi.ReviewComposable.useReview,
        sandbox.module.exports.useReview
    );
});

test('construction owns exact legacy defaults, preserves shared refs, and triggers zero effects', () => {
    const fixture = createFixture();
    const { review, context, calls } = fixture;
    assert.equal(review.batchImportBatches, context.batchImportBatches);
    assert.equal(review.batchDraftQuestions, context.batchDraftQuestions);
    assert.deepEqual({
        mode: review.batchImportMode.value,
        filter: review.batchImportFilter.value,
        batch: review.activeBatchId.value,
        question: review.activeDraftQuestionId.value,
        tab: review.activeDraftTab.value,
        toast: review.batchToast.value,
        modal: review.unassignedImageModal.value,
        menu: review.imagePositionMenuId.value,
        editor: review.activeDraftEditorBuffer.value,
        original: review.activeDraftEditorOriginal.value,
        editorQuestion: review.activeDraftEditorQuestionId.value,
        textarea: review.activeDraftEditorTextarea.value
    }, {
        mode: 'list', filter: 'all', batch: '', question: '', tab: 'stem',
        toast: '', modal: false, menu: '', editor: '', original: '',
        editorQuestion: '', textarea: null
    });
    assert.deepEqual(calls, { notify: [], merged: [], filtered: [] });
});

test('recent batches sort by createdAt without mutating the shared list and cap at twelve', () => {
    const batches = Array.from({ length: 14 }, (_, index) => ({
        id: `batch-${index}`,
        createdAt: index
    })).reverse();
    const originalOrder = batches.map(item => item.id);
    const fixture = createFixture({ context: { batchImportBatches: ref(batches) } });
    assert.deepEqual(
        fixture.review.recentBatchImportBatches.value.map(item => item.createdAt),
        [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
    );
    assert.deepEqual(batches.map(item => item.id), originalOrder);
});

test('active batch and question preserve legacy selection and first-question fallback', () => {
    const batches = ref([{ id: 'b1' }, { id: 'b2' }]);
    const questions = ref([{ id: 'q1' }, { id: 'q2' }]);
    const fixture = createFixture({
        context: { batchImportBatches: batches, batchDraftQuestions: questions }
    });
    fixture.review.activeBatchId.value = 'b2';
    fixture.review.activeDraftQuestionId.value = 'q2';
    assert.equal(fixture.review.activeBatch.value, batches.value[1]);
    assert.equal(fixture.review.activeDraftQuestion.value, questions.value[1]);
    fixture.review.activeDraftQuestionId.value = 'missing';
    assert.equal(fixture.review.activeDraftQuestion.value, questions.value[0]);
    fixture.review.activeBatchId.value = 'missing';
    assert.equal(fixture.review.activeBatch.value, null);
});

test('editor source prefers editorSource and otherwise delegates exact stem, options, and type', () => {
    const fixture = createFixture();
    assert.equal(
        fixture.review.buildDraftEditorSource({ editorSource: 'one\r\ntwo' }),
        'one\ntwo'
    );
    assert.equal(fixture.calls.merged.length, 0);
    const question = { stem: '题干', options: ['甲', '乙'], type: '单选题' };
    assert.equal(fixture.review.buildDraftEditorSource(question), '题干\nA. 甲');
    assert.deepEqual(fixture.calls.merged[0], [
        '题干', ['甲', '乙'], '单选题'
    ]);
});

test('editor dirty and preview track the owned buffer and selected question identity', () => {
    const question = { id: 'q1', type: '解答题' };
    const fixture = createFixture({
        context: { batchDraftQuestions: ref([question]) }
    });
    fixture.review.activeDraftEditorOriginal.value = 'before';
    fixture.review.activeDraftEditorBuffer.value = 'after';
    assert.equal(fixture.review.activeDraftEditorDirty.value, true);
    assert.deepEqual(fixture.review.activeDraftEditorPreview.value, {
        value: 'after',
        question
    });
    fixture.review.activeDraftEditorBuffer.value = 'before';
    assert.equal(fixture.review.activeDraftEditorDirty.value, false);
});

test('draft filtering delegates list identity, current filter, and problem function', () => {
    const questions = ref([
        { id: 'q1', status: 'pending', problems: ['x'] },
        { id: 'q2', status: 'reviewed', problems: [] }
    ]);
    const fixture = createFixture({ context: { batchDraftQuestions: questions } });
    assert.equal(fixture.review.filteredDraftQuestions.value, questions.value);
    fixture.review.batchImportFilter.value = 'problems';
    assert.deepEqual(fixture.review.filteredDraftQuestions.value, [questions.value[0]]);
    assert.equal(fixture.calls.filtered.at(-1)[0], questions.value);
    assert.equal(fixture.calls.filtered.at(-1)[1], 'problems');
});

test('image menu toggling and editor discard preserve exact UI behavior', () => {
    const fixture = createFixture();
    fixture.review.toggleImagePositionMenu(' image-1 ');
    assert.equal(fixture.review.imagePositionMenuId.value, 'image-1');
    fixture.review.toggleImagePositionMenu('image-1');
    assert.equal(fixture.review.imagePositionMenuId.value, '');
    fixture.review.imagePositionMenuId.value = 'image-2';
    fixture.review.toggleImagePositionMenu();
    assert.equal(fixture.review.imagePositionMenuId.value, '');

    fixture.review.activeDraftEditorOriginal.value = 'saved';
    fixture.review.activeDraftEditorBuffer.value = 'dirty';
    fixture.review.discardActiveDraftEditorChanges();
    assert.equal(fixture.review.activeDraftEditorBuffer.value, 'saved');
    assert.deepEqual(fixture.calls.notify, ['已放弃未保存修改。']);
});

test('shared refs and exercised dependencies fail loudly at their boundary', () => {
    assert.throws(
        () => useReview({}, { ref, computed }),
        /context\.batchImportBatches ref/
    );
    const fixture = createFixture({
        dependencies: { ReviewDraftState: {} }
    });
    assert.throws(
        () => fixture.review.buildDraftEditorSource({ editorSource: 'x' }),
        /ReviewDraftState\.normalizeDraftEditorNewlines/
    );
});

test('module source contains no hidden browser, storage, network, clock, or AI dependencies', () => {
    assert.doesNotMatch(
        source,
        /\b(?:window|document|fetch|indexedDB|localStorage|sessionStorage|XMLHttpRequest|navigator)\b|\bdb\.|Date\.now|Math\.random|setTimeout|setInterval|\/api\/(?:ai|ocr)/
    );
});
