const test = require('node:test');
const assert = require('node:assert/strict');
const projection = require('../qisi-review-image-projection.js');

const isPreviewable = image => Boolean(image?.url) && image?.displayable !== false;
const isRealFigureRow = image => image?.kind !== 'source-page';
const mergeById = (...lists) => {
    const seen = new Map();
    for (const list of lists) for (const item of list || []) if (item?.id && !seen.has(item.id)) seen.set(item.id, item);
    return [...seen.values()];
};
const ports = (overrides = {}) => ({
    isRealFigureRow,
    isPreviewable,
    mergeById,
    pdfContract: () => null,
    pdfMeta: () => null,
    ...overrides
});

const image = (id, overrides = {}) => ({ id, url: 'blob:' + id, source: 'manual-crop', kind: 'figure', ...overrides });
const question = (overrides = {}) => ({
    id: 'q1',
    batchId: 'b1',
    images: [],
    ...overrides
});

test('projectActiveImages keeps bound and inline figure rows only', () => {
    const q = question({ images: [image('inline'), { id: 'bad', url: '' }] });
    const bound = [image('bound', { questionId: 'q1' }), image('other', { questionId: 'q2' }), { id: 'src', kind: 'source-page', questionId: 'q1', url: 'blob:src' }];
    const result = projection.projectActiveImages({ question: q, boundImages: bound, ...ports() });
    assert.deepEqual(result.map(item => item.id), ['inline', 'bound']);
});

test('projectActiveImages returns nothing without a question id', () => {
    assert.deepEqual(projection.projectActiveImages({ question: {}, boundImages: [image('x', { questionId: undefined })], ...ports() }), []);
    assert.deepEqual(projection.projectActiveImages({ question: null, ...ports() }), []);
});

test('PDF bound rows are limited to ids that the draft still references', () => {
    const q = question({ images: [image('kept')] });
    const bound = [image('kept', { questionId: 'q1' }), image('orphan', { questionId: 'q1' })];
    const result = projection.projectActiveImages({
        question: q, boundImages: bound,
        ...ports({ pdfContract: () => ({ isRecord: true }) })
    });
    assert.deepEqual(result.map(item => item.id), ['kept']);
});

test('projectRealQuestionImages drops source-page and unknown sources from inline rows', () => {
    const q = question({
        images: [
            image('crop', { source: 'manual-crop' }),
            image('auto', { source: 'auto-figure-crop' }),
            image('docx', { source: 'docx-inline-figure' }),
            image('page', { source: 'source-page' }),
            image('unknown', { source: 'imported-elsewhere' })
        ]
    });
    const result = projection.projectRealQuestionImages({ question: q, boundImages: [], ...ports() });
    assert.deepEqual(result.map(item => item.id), ['crop', 'auto', 'docx']);
});

test('projectSourcePageImages maps PDF source pages with stable ids', () => {
    const q = question();
    const result = projection.projectSourcePageImages({
        question: q, batchId: 'b1',
        ...ports({
            pdfContract: () => ({ isRecord: true }),
            pdfMeta: () => ({ sourcePageImages: [{ pageNo: 3, url: 'blob:p3' }] })
        })
    });
    assert.deepEqual(result, [{
        pageNo: 3, url: 'blob:p3', id: 'q1_source_0', batchId: 'b1', questionId: 'q1',
        sourcePage: 3, source: 'source-page', status: 'need_confirm'
    }]);
});

test('projectSourcePageImages builds one source-page row for a single page image', () => {
    const q = question({ sourcePageImage: 'blob:page', sourcePage: 2, sourceFileId: 'f1' });
    const result = projection.projectSourcePageImages({ question: q, batchId: 'b9', ...ports() });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'q1_source_page');
    assert.equal(result[0].batchId, 'b1');
    assert.equal(result[0].sourceFileId, 'f1');
    assert.equal(result[0].sourcePage, 2);
});

test('projectSourcePageImages falls back to the trace page when no page image exists', () => {
    const q = question({ sourcePageImage: '', sourceTrace: { sourcePageImage: 'blob:trace', sourcePage: 5 } });
    const result = projection.projectSourcePageImages({ question: q, ...ports() });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'q1_trace_page');
    assert.equal(result[0].sourcePage, 5);
});

test('projectPreviewImages merges draft rows with real question images without duplicates', () => {
    const q = question({ images: [image('a'), image('b')] });
    const result = projection.projectPreviewImages({ question: q, realQuestionImages: [image('b'), image('c')], ...ports() });
    assert.deepEqual(result.map(item => item.id), ['a', 'b', 'c']);
    assert.deepEqual(projection.projectPreviewImages({ question: null, ...ports() }), []);
});

test('projection fails closed when the owning helpers are missing', () => {
    assert.throws(() => projection.projectActiveImages({ question: question() }),
        error => error.code === 'REVIEW_IMAGE_PROJECTION_FIGURE_HELPER_REQUIRED');
    assert.throws(() => projection.projectActiveImages({ question: question(), isRealFigureRow }),
        error => error.code === 'REVIEW_IMAGE_PROJECTION_PREVIEW_HELPER_REQUIRED');
    assert.throws(() => projection.projectPreviewImages({ question: question(), isRealFigureRow, isPreviewable }),
        error => error.code === 'REVIEW_IMAGE_PROJECTION_MERGE_HELPER_REQUIRED');
});
