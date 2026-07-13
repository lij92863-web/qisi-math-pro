const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Builder = require('../qisi-review-draft-builder.js');
const ROOT = path.resolve(__dirname, '..');

const validatedDraft = (overrides = {}) => ({
    id: 'validated-1',
    questionNumber: '1',
    type: '单选题',
    stem: 'Validated stem',
    options: ['One', 'Two', 'Three', 'Four'],
    answer: '',
    solution: '',
    images: [],
    warnings: ['answer requires teacher review'],
    source: { mode: 'pdf-ai', sourceId: 'pdf-source-1' },
    supportLevel: 'prefix',
    manualReviewRequired: true,
    fieldProvenance: {
        stem: { status: 'controlled-write', controlledWriteAccepted: true },
        answer: { status: 'rejected', reasonCode: 'ownership-rewind' }
    },
    ...overrides
});

test('projects validated drafts into immutable review records without washing evidence', () => {
    const input = [validatedDraft()];
    const snapshot = structuredClone(input);
    const result = Builder.buildReviewDrafts(input, {
        batchId: 'batch-1', now: 1700000000000
    });

    assert.deepEqual(input, snapshot);
    assert.deepEqual(result[0], {
        ...snapshot[0],
        batchId: 'batch-1',
        version: 1,
        order: 1,
        status: 'pending',
        duplicateStatus: 'none',
        selected: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000
    });
    assert.equal(result[0].manualReviewRequired, true);
    assert.equal(result[0].fieldProvenance.answer.status, 'rejected');
    assert.equal(result[0].fieldProvenance.answer.reasonCode, 'ownership-rewind');
    assert.deepEqual(result[0].warnings, snapshot[0].warnings);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result[0].fieldProvenance), true);
});

test('preserves missing optional fields and existing record metadata exactly', () => {
    const missing = validatedDraft({
        id: '', version: 4, createdAt: 1600000000000
    });
    delete missing.solution;
    delete missing.manualReviewRequired;
    const result = Builder.buildReviewDrafts([missing], {
        batchId: 'batch-2', now: 1700000000000
    });

    assert.equal(result[0].id, 'draft_batch-2_1');
    assert.equal(result[0].version, 4);
    assert.equal(result[0].createdAt, 1600000000000);
    assert.equal(Object.hasOwn(result[0], 'solution'), false);
    assert.equal(Object.hasOwn(result[0], 'manualReviewRequired'), false);
    assert.equal(result[0].answer, '');
});

test('fails closed for invalid inputs and context without leaking content', () => {
    for (const input of [null, [], ['PRIVATE DRAFT']]) {
        assert.throws(
            () => Builder.buildReviewDrafts(input, {
                batchId: 'batch-1', now: 1700000000000
            }),
            error => /^REVIEW_DRAFT_/.test(error.code) &&
                !/PRIVATE DRAFT/.test(error.message)
        );
    }
    assert.throws(
        () => Builder.buildReviewDrafts([validatedDraft()], {}),
        error => error.code === 'REVIEW_DRAFT_CONTEXT_INVALID'
    );
});

test('production path builds only after validation and before persistence', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const injected = fs.readFileSync(path.join(ROOT, 'qisi-injected-import-path.js'), 'utf8');
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-review-draft-builder.js'), 'utf8'
    );
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');

    assert.match(app, /Qisi\.ReviewDraftBuilder\.buildReviewDrafts/);
    assert.match(injected, /reviewDrafts\s*=\s*buildReviewDrafts\s*\(/);
    assert.ok(
        injected.indexOf('validatedDrafts = validateDrafts') <
        injected.indexOf('reviewDrafts = buildReviewDrafts')
    );
    assert.ok(
        injected.indexOf('reviewDrafts = buildReviewDrafts') <
        injected.indexOf('await repository.persistReviewDraftBatch')
    );
    assert.doesNotMatch(injected, /selected\.map\(\(candidate/);
    assert.doesNotMatch(injected, /duplicateStatus:\s*'none'/);
    assert.ok(html.indexOf('qisi-review-draft-builder.js') < html.indexOf('app.js'));
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|fetch\s*\(|XMLHttpRequest/);
    assert.doesNotMatch(
        implementation,
        /FormalAdmission|controlledWrite|evaluateDraftAdmission|saveQuestion|db\.|persistReviewDraftBatch/i
    );
});
