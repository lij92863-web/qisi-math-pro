const test = require('node:test');
const assert = require('node:assert/strict');
const commit = require('../qisi-review-editor-commit.js');

const ports = (overrides = {}) => ({
    migrateImageTokens: (source, images) => (images.length ? source.replace('[[IMG]]', '[[IMAGE:' + images[0].id + ']]') : source),
    normalizeDuplicates: source => source.replace(/\[\[IMAGE:([^\]]+)\]\].*\[\[IMAGE:\1\]\]/, '[[IMAGE:$1]]'),
    normalizeNewlines: value => String(value ?? '').replace(/\r\n?/g, '\n'),
    buildProjection: (source, question) => {
        const lines = source.split('\n');
        const options = lines.filter(line => /^[A-D][.、]\s*/.test(line)).map(line => line.replace(/^[A-D][.、]\s*/, ''));
        return {
            stem: lines.filter(line => !/^[A-D][.、]\s*/.test(line)).join('\n'),
            options: options.length ? options : ['stored', '', '', ''],
            type: question.type,
            parsedOptions: options.length >= 2
        };
    },
    ...overrides
});

const question = (overrides = {}) => ({ id: 'q1', type: '单选题', ...overrides });

test('planEditorCommit returns null without a question', () => {
    assert.equal(commit.planEditorCommit({ question: null, source: 'x', ...ports() }), null);
});

test('planEditorCommit parses a choice draft and clears the option warning', () => {
    const plan = commit.planEditorCommit({ question: question(), source: 'stem\r\nA. one\r\nB. two', ...ports() });
    assert.equal(plan.editorSource, 'stem\nA. one\nB. two');
    assert.equal(plan.stem, 'stem');
    assert.deepEqual(plan.options, ['one', 'two']);
    assert.equal(plan.optionWarning, null);
    assert.equal(plan.projection.parsedOptions, true);
});

test('planEditorCommit keeps the warning for unparsed choice edits', () => {
    const plan = commit.planEditorCommit({ question: question(), source: 'plain text', ...ports() });
    assert.equal(plan.stem, 'plain text');
    assert.deepEqual(plan.options, ['', '', '', '']);
    assert.equal(plan.optionWarning, commit.OPTION_WARNING);
    assert.equal(plan.projection.parsedOptions, false);
});

test('planEditorCommit treats a non-choice draft as one stem and clears the warning', () => {
    const plan = commit.planEditorCommit({ question: question({ type: '解答题' }), source: 'solution text', ...ports() });
    assert.equal(plan.stem, 'solution text');
    assert.deepEqual(plan.options, ['', '', '', '']);
    assert.equal(plan.optionWarning, null);
});

test('planEditorCommit migrates image tokens before duplicate normalisation', () => {
    const calls = [];
    const plan = commit.planEditorCommit({
        question: question({ type: '解答题' }), source: '[[IMG]]',
        images: [{ id: 'i1' }],
        ...ports({
            migrateImageTokens: (source, images) => { calls.push('migrate'); return source.replace('[[IMG]]', '[[IMAGE:' + images[0].id + ']]'); },
            normalizeDuplicates: source => { calls.push('dedupe'); return source; },
            normalizeNewlines: value => { calls.push('newline'); return String(value); }
        })
    });
    assert.deepEqual(calls, ['migrate', 'dedupe', 'newline']);
    assert.equal(plan.editorSource, '[[IMAGE:i1]]');
});

test('planEditorCommit fails closed without its owning helpers', () => {
    assert.throws(() => commit.planEditorCommit({ question: question(), source: 'x' }),
        error => error.code === 'REVIEW_EDITOR_COMMIT_MIGRATE_HELPER_REQUIRED');
    assert.throws(() => commit.planEditorCommit({ question: question(), source: 'x', migrateImageTokens: (s) => s }),
        error => error.code === 'REVIEW_EDITOR_COMMIT_DUPLICATE_HELPER_REQUIRED');
    assert.throws(() => commit.planEditorCommit({ question: question(), source: 'x', migrateImageTokens: (s) => s, normalizeDuplicates: (s) => s }),
        error => error.code === 'REVIEW_EDITOR_COMMIT_NORMALIZE_HELPER_REQUIRED');
});
