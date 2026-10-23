const test = require('node:test');
const assert = require('node:assert/strict');
const projection = require('../qisi-review-editor-projection.js');

const mergeStemWithOptions = (stem, options, type) =>
    [stem, ...(type === '单选题' || type === '多选题' ? options.map((option, index) => String.fromCharCode(65 + index) + '. ' + option) : [])]
        .filter(Boolean).join('\n');
const normalizeNewlines = value => String(value ?? '').replace(/\r\n?/g, '\n');
const splitChoiceSource = text => {
    const lines = String(text || '').split('\n');
    const options = lines.filter(line => /^[A-D][.、]\s*/.test(line)).map(line => line.replace(/^[A-D][.、]\s*/, ''));
    if (options.length < 2) return null;
    return { stem: lines.filter(line => !/^[A-D][.、]\s*/.test(line)).join('\n'), options };
};
const normalizePreviewOptions = question => (Array.isArray(question?.options) ? question.options : []).map(value => String(value || ''));

const ports = (overrides = {}) => ({ mergeStemWithOptions, normalizeNewlines, splitChoiceSource, normalizePreviewOptions, ...overrides });

const question = (overrides = {}) => ({
    id: 'q1',
    type: '单选题',
    stem: 'stem',
    options: ['A', 'B', 'C', 'D'],
    ...overrides
});

test('buildEditorSource returns an empty string without a question', () => {
    assert.equal(projection.buildEditorSource({}, ports()), '');
    assert.equal(projection.buildEditorSource({ question: null, ...ports() }), '');
});

test('buildEditorSource prefers the stored editor source and normalises newlines', () => {
    const result = projection.buildEditorSource({ question: question({ editorSource: 'a\r\nb' }), ...ports() });
    assert.equal(result, 'a\nb');
});

test('buildEditorSource merges stem and options when no editor source exists', () => {
    const result = projection.buildEditorSource({ question: question({ editorSource: '' }), ...ports() });
    assert.equal(result, 'stem\nA. A\nB. B\nC. C\nD. D');
});

test('buildEditorSource delegates to the PDF contract when the draft has one', () => {
    const contract = { editorSource: () => 'pdf-source' };
    const result = projection.buildEditorSource({ question: question(), ...ports({ pdfContract: () => contract }) });
    assert.equal(result, 'pdf-source');
});

test('buildEditorSource keeps a stored editor source even for PDF drafts', () => {
    const contract = { editorSource: () => 'pdf-source' };
    const result = projection.buildEditorSource({ question: question({ editorSource: 'typed' }), ...ports({ pdfContract: () => contract }) });
    assert.equal(result, 'typed');
});

test('buildEditorProjection parses a choice draft with option lines', () => {
    const result = projection.buildEditorProjection({ source: 'new stem\nA. one\nB. two', question: question(), ...ports() });
    assert.deepEqual(result, { stem: 'new stem', options: ['one', 'two'], type: '单选题', parsedOptions: true });
});

test('buildEditorProjection falls back to stored options when option lines are missing', () => {
    const result = projection.buildEditorProjection({ source: 'plain stem', question: question(), ...ports() });
    assert.deepEqual(result, { stem: 'plain stem', options: ['A', 'B', 'C', 'D'], type: '单选题', parsedOptions: false });
});

test('buildEditorProjection keeps non-choice drafts as a single stem', () => {
    const result = projection.buildEditorProjection({ source: 'solution text', question: question({ type: '解答题' }), ...ports() });
    assert.deepEqual(result, { stem: 'solution text', options: ['', '', '', ''], type: '解答题', parsedOptions: false });
});

test('buildEditorProjection delegates to the PDF contract when present', () => {
    const contract = { projectEditorSource: (source, question) => ({ pdf: source, id: question.id }) };
    const result = projection.buildEditorProjection({ source: 's', question: question(), ...ports({ pdfContract: () => contract }) });
    assert.deepEqual(result, { pdf: 's', id: 'q1' });
});

test('editor projection fails closed when the owning helpers are missing', () => {
    assert.throws(() => projection.buildEditorSource({ question: question() }),
        error => error.code === 'REVIEW_EDITOR_PROJECTION_MERGE_HELPER_REQUIRED');
    assert.throws(() => projection.buildEditorProjection({ source: 'x', question: question({ type: '解答题' }) }),
        error => error.code === 'REVIEW_EDITOR_PROJECTION_NORMALIZE_HELPER_REQUIRED');
    assert.throws(() => projection.buildEditorProjection({ source: 'x', question: question(), normalizeNewlines }),
        error => error.code === 'REVIEW_EDITOR_PROJECTION_SPLIT_HELPER_REQUIRED');
});


test('readonly source and preview preserve frozen zero, partial and full option evidence', () => {
    for (const options of [[], ['first', 'second'], ['first', 'second', 'third', 'fourth']]) {
        const q = Object.freeze(question({ options: Object.freeze(options) }));
        const before = JSON.stringify(q);
        const source = projection.buildEditorSource({ question: q, ...ports() });
        assert.match(source, /stem/);
        const preview = projection.buildEditorProjection({ source: 'unparsed source', question: q, ...ports() });
        assert.deepEqual(preview.options, options);
        assert.equal(preview.parsedOptions, false);
        assert.equal(JSON.stringify(q), before);
    }
});
